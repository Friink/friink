from datetime import timedelta

from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    ProfilePictureConfirmRequest,
    ProfilePictureConfirmResponse,
    ProfilePictureUploadUrlRequest,
    ProfilePictureUploadUrlResponse,
    PublicUserResponse,
    RefreshResponse,
    SignupRequest,
    TokenResponse,
    UpdateSetupRequest,
    UpdateCurrentUserRequest,
    UserResponse,
)
from app.services.auth import authenticate_user, create_user, get_user_by_username, update_current_user, user_id_from_subject
from app.services.auth_debug import log_auth_failure, log_refresh_token_event, log_token_issued, log_token_verification_failure
from app.services.auth_errors import AuthErrorCode, auth_error_detail
from app.services.email import EmailService
from app.services.security import TokenValidationError, create_access_token, decode_token
from app.services.session_ops import commit
from app.services.session_service import (
    get_refresh_token_for_update,
    issue_refresh_token,
    revoke_refresh_family,
    revoke_refresh_token,
)
from app.services.token_context import get_auth_flow_context
from app.services.storage import StorageNotConfiguredError, StorageObjectError, StorageService

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

REFRESH_COOKIE_NAME = "friink_refresh_token"


def set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        max_age=int(timedelta(days=settings.refresh_token_expire_days).total_seconds()),
        path="/",
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, session: Session = Depends(get_session)) -> User:
    return await create_user(session, payload, EmailService())


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = await authenticate_user(session, payload.email, payload.password)
    access_token = create_access_token(user.id)
    issued_refresh = issue_refresh_token(session, user.id, settings)
    await commit(session)
    log_token_issued(flow="fresh_login", token_type="access", token=access_token, user_id=str(user.id))
    log_refresh_token_event(
        event="auth_refresh_token_issued",
        flow="fresh_login",
        token_id=str(issued_refresh.record.id),
        family_id=str(issued_refresh.record.family_id),
        user_id=str(user.id),
    )
    set_refresh_cookie(response, issued_refresh.raw_token, settings)
    return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RefreshResponse:
    if not refresh_token:
        log_auth_failure(
            flow="refresh_exchange",
            token_type="refresh",
            code=AuthErrorCode.REFRESH_TOKEN_MISSING,
            reason="Refresh cookie was not present.",
            settings=settings,
            request_path=str(request.url.path),
            request_method=request.method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Missing refresh token.", AuthErrorCode.REFRESH_TOKEN_MISSING),
        )
    token_record = get_refresh_token_for_update(session, refresh_token)
    if not token_record:
        log_auth_failure(
            flow="refresh_exchange",
            token_type="refresh",
            code=AuthErrorCode.REFRESH_TOKEN_INVALID,
            reason="Refresh token was not found in the server-side token store.",
            settings=settings,
            request_path=str(request.url.path),
            request_method=request.method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.REFRESH_TOKEN_INVALID),
        )

    now = datetime.now(UTC)
    if token_record.rotated_at is not None or token_record.revoked_at is not None:
        revoke_refresh_family(session, token_record.family_id, "reuse_detected", now)
        await commit(session)
        log_refresh_token_event(
            event="auth_refresh_token_reuse_detected",
            flow="refresh_exchange",
            token_id=str(token_record.id),
            family_id=str(token_record.family_id),
            user_id=str(token_record.user_id),
            reason="dead_token_presented",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.REFRESH_TOKEN_INVALID),
        )

    if token_record.expires_at <= now:
        revoke_refresh_token(session, token_record, "expired", now)
        await commit(session)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.TOKEN_EXPIRED),
        )

    user_id = token_record.user_id
    user = session.get(User, user_id)
    if not user:
        revoke_refresh_family(session, token_record.family_id, "family_revoked", now)
        await commit(session)
        log_auth_failure(
            flow="refresh_exchange",
            token_type="refresh",
            code=AuthErrorCode.SESSION_NOT_FOUND,
            reason="Refresh token subject did not match an existing user.",
            settings=settings,
            request_path=str(request.url.path),
            request_method=request.method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.SESSION_NOT_FOUND),
        )
    issued_refresh = issue_refresh_token(session, user.id, settings, family_id=token_record.family_id)
    token_record.rotated_at = now
    token_record.replaced_by_id = issued_refresh.record.id
    access_token = create_access_token(user.id)
    await commit(session)
    log_token_issued(flow="refresh_exchange", token_type="access", token=access_token, user_id=str(user.id))
    log_refresh_token_event(
        event="auth_refresh_token_rotated",
        flow="refresh_exchange",
        token_id=str(issued_refresh.record.id),
        family_id=str(issued_refresh.record.family_id),
        user_id=str(user.id),
    )
    set_refresh_cookie(response, issued_refresh.raw_token, settings)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    if refresh_token:
        token_record = get_refresh_token_for_update(session, refresh_token)
        if token_record:
            revoke_refresh_family(session, token_record.family_id, "logout")
            await commit(session)
            log_refresh_token_event(
                event="auth_refresh_token_family_revoked",
                flow="logout",
                token_id=str(token_record.id),
                family_id=str(token_record.family_id),
                user_id=str(token_record.user_id),
                reason="logout",
            )
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    auth_flow_context: str | None = Depends(get_auth_flow_context),
) -> User:
    try:
        payload = decode_token(token, "access")
    except TokenValidationError as exc:
        if exc.original:
            log_token_verification_failure(
                flow=auth_flow_context or "authenticated_request",
                token_type="access",
                token=token,
                exception=exc.original,
                settings=settings,
                request_path=str(request.url.path),
                request_method=request.method,
            )
        log_auth_failure(
            flow=auth_flow_context or "authenticated_request",
            token_type="access",
            code=exc.code,
            reason=str(exc),
            settings=settings,
            request_path=str(request.url.path),
            request_method=request.method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid access token.", exc.code),
        ) from exc
    user_id = user_id_from_subject(str(payload.get("sub", "")))
    user = session.get(User, user_id)
    if not user:
        log_auth_failure(
            flow=auth_flow_context or "authenticated_request",
            token_type="access",
            code=AuthErrorCode.SESSION_NOT_FOUND,
            reason="Access token subject did not match an existing user.",
            settings=settings,
            request_path=str(request.url.path),
            request_method=request.method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid access token.", AuthErrorCode.SESSION_NOT_FOUND),
        )
    return user


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/users/{username}", response_model=PublicUserResponse)
async def get_public_user(username: str, session: Session = Depends(get_session)) -> User:
    user = await get_user_by_username(session, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateCurrentUserRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    return await update_current_user(session, current_user, payload)


@router.patch("/me/setup", response_model=UserResponse)
async def update_setup(
    payload: UpdateSetupRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    current_user.setup_step = payload.step
    current_user.setup_completed = payload.completed
    await commit(session)
    return current_user


@router.post("/me/profile-picture/upload-url", response_model=ProfilePictureUploadUrlResponse)
async def create_profile_picture_upload_url(
    payload: ProfilePictureUploadUrlRequest,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ProfilePictureUploadUrlResponse:
    try:
        upload = StorageService(settings).generate_upload_url(current_user.id, payload.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except StorageNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return ProfilePictureUploadUrlResponse(
        upload_url=upload.upload_url,
        public_url=upload.public_url,
        object_key=upload.object_key,
    )


@router.post("/me/profile-picture/confirm", response_model=ProfilePictureConfirmResponse)
async def confirm_profile_picture_upload(
    payload: ProfilePictureConfirmRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ProfilePictureConfirmResponse:
    storage = StorageService(settings)
    try:
        storage.confirm_object(payload.object_key, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except StorageNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except StorageObjectError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The profile picture upload could not be completed.") from exc

    previous_key = None
    if current_user.profile_picture_url and settings.r2_public_url:
        prefix = f"{settings.r2_public_url.rstrip('/')}/"
        if current_user.profile_picture_url.startswith(prefix):
            previous_key = current_user.profile_picture_url[len(prefix):]

    if previous_key and previous_key != payload.object_key:
        try:
            storage.delete_object(previous_key, current_user.id, allow_legacy_key=True)
        except StorageNotConfiguredError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        except (StorageObjectError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The previous profile picture could not be removed.") from exc

    updated_at = datetime.now(UTC)
    current_user.profile_picture_url = f"{settings.r2_public_url.rstrip('/')}/{payload.object_key}"
    current_user.profile_picture_updated_at = updated_at
    await commit(session)

    return ProfilePictureConfirmResponse(
        profile_picture_url=current_user.profile_picture_url,
        profile_picture_updated_at=current_user.profile_picture_updated_at,
    )
