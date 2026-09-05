import uuid
import secrets
from datetime import timedelta

from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.models.auth_session import AuthSession
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginChallengeResponse,
    LoginVerifyRequest,
    EmailChangeStartRequest,
    EmailChangeStartResponse,
    EmailChangeVerifyRequest,
    ProfilePictureConfirmRequest,
    ProfilePictureConfirmResponse,
    ProfilePictureUploadUrlRequest,
    ProfilePictureUploadUrlResponse,
    PublicUserResponse,
    RefreshResponse,
    AuthSessionResponse,
    SignupRequest,
    SignupCompleteRequest,
    SignupEmailStartRequest,
    SignupEmailVerifyResponse,
    SignupStartResponse,
    SignupVerifyRequest,
    TokenResponse,
    UpdateSetupRequest,
    UpdateCurrentUserRequest,
    UsernameAvailabilityResponse,
    UserResponse,
)
from app.services.auth import authenticate_user, change_password, complete_signup_email_reservation, complete_signup_reservation, create_user, get_user_by_username, is_username_available, start_signup_email_reservation, start_signup_reservation, update_current_user, user_id_from_subject, verify_signup_email_reservation
from app.services.email_change import complete_email_change, start_email_change
from app.services.auth_debug import log_auth_failure, log_refresh_token_event, log_token_issued, log_token_verification_failure
from app.services.auth_errors import AuthErrorCode, auth_error_detail
from app.services.email import EmailDeliveryError, EmailService
from app.services.profile_media import profile_picture_url_for
from app.services.security import TokenValidationError, create_access_token, decode_token
from app.services.session_ops import commit
from app.services.login_challenges import create_login_challenge, derive_pending_device_identifier, get_login_challenge, verify_login_challenge
from app.services.session_service import (
    DEVICE_COOKIE_NAME,
    create_auth_session,
    device_signals_changed,
    get_recognized_device,
    get_or_create_recognized_device,
    get_refresh_token,
    get_refresh_token_for_update,
    issue_refresh_token,
    list_active_auth_sessions,
    revoke_auth_session,
    revoke_refresh_family,
    revoke_refresh_family_for_session,
    revoke_refresh_token,
)
from app.services.token_context import get_auth_flow_context
from app.services.storage import StorageNotConfiguredError, StorageObjectError, StorageService

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

REFRESH_COOKIE_NAME = "friink_refresh_token"


def require_allowed_origin(request: Request, settings: Settings) -> None:
    """Reject browser cross-site auth requests while allowing non-browser clients."""
    origin = request.headers.get("origin")
    if not origin:
        return
    allowed_origins = {
        str(settings.frontend_url).rstrip("/"),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://staging.friink.com",
    }
    if origin.rstrip("/") not in allowed_origins:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request origin is not allowed.")


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
async def signup(
    payload: SignupRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    require_allowed_origin(request, settings)
    if settings.signup_otp_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup is available through email verification.")
    return user_response(await create_user(session, payload, EmailService(settings)), settings)


@router.post("/signup/start", response_model=SignupStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def signup_start(
    payload: SignupRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> SignupStartResponse:
    require_allowed_origin(request, settings)
    if settings.signup_otp_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup is available through email verification.")
    token = secrets.token_urlsafe(32)
    return SignupStartResponse(
        verification_required=settings.signup_otp_enabled,
        reservation_token=token,
        message="If the signup details can be accepted, verification instructions will be sent.",
    )


@router.post("/signup/email/start", response_model=SignupStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def signup_email_start(
    payload: SignupEmailStartRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> SignupStartResponse:
    require_allowed_origin(request, settings)
    if not settings.signup_otp_enabled:
        return SignupStartResponse(
            verification_required=False,
            reservation_token=secrets.token_urlsafe(32),
            message="If the signup details can be accepted, verification instructions will be sent.",
        )
    try:
        token = await start_signup_email_reservation(session, str(payload.email), EmailService(settings))
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Verification email could not be sent. Please try again later.") from exc
    return SignupStartResponse(
        verification_required=True,
        reservation_token=token,
        message="If the signup details can be accepted, verification instructions will be sent.",
    )


@router.post("/signup/email/verify", response_model=SignupEmailVerifyResponse)
async def signup_email_verify(
    payload: SignupVerifyRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> SignupEmailVerifyResponse:
    require_allowed_origin(request, settings)
    if not settings.signup_otp_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup verification is not available.")
    await verify_signup_email_reservation(session, payload.reservation_token, payload.otp)
    return SignupEmailVerifyResponse()


@router.post("/signup/complete", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup_complete(
    payload: SignupCompleteRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    require_allowed_origin(request, settings)
    if not settings.signup_otp_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup completion is not available.")
    data = SignupRequest.model_validate(payload.model_dump(exclude={"reservation_token"}))
    return user_response(await complete_signup_email_reservation(session, payload.reservation_token, data), settings)


def set_device_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=DEVICE_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.environment.lower() not in {"development", "test"},
        samesite="none" if settings.environment.lower() not in {"development", "test"} else "lax",
        max_age=int(timedelta(days=365).total_seconds()),
        path="/",
    )


def user_response(user: User, settings: Settings) -> UserResponse:
    values = {name: getattr(user, name) for name in UserResponse.model_fields if name != "id"}
    values["id"] = user.public_id
    return UserResponse.model_validate(values).model_copy(
        update={"profile_picture_url": profile_picture_url_for(user, settings)}
    )


def public_user_response(user: User, settings: Settings) -> PublicUserResponse:
    values = {name: getattr(user, name) for name in PublicUserResponse.model_fields if name != "id"}
    values["id"] = user.public_id
    return PublicUserResponse.model_validate(values).model_copy(
        update={"profile_picture_url": profile_picture_url_for(user, settings)}
    )


@router.post("/signup/verify", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup_verify(
    payload: SignupVerifyRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    require_allowed_origin(request, settings)
    if not settings.signup_otp_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup verification is not available.")
    return user_response(await complete_signup_reservation(session, payload.reservation_token, payload.otp), settings)


@router.get("/username-availability", response_model=UsernameAvailabilityResponse)
async def username_availability(
    username: str = Query(min_length=1, max_length=64),
    session: Session = Depends(get_session),
) -> UsernameAvailabilityResponse:
    try:
        normalized_username = UpdateCurrentUserRequest(username=username).username
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    assert normalized_username is not None
    return UsernameAvailabilityResponse(
        username=normalized_username,
        available=await is_username_available(session, normalized_username),
    )


async def _issue_login_session(
    user: User,
    request: Request,
    response: Response,
    session: Session,
    settings: Settings,
    raw_device_identifier: str | None,
) -> TokenResponse:
    access_token = create_access_token(user.id)
    recognized_device, device_identifier, _recognized = get_or_create_recognized_device(
        session, user.id, request, raw_device_identifier
    )
    auth_session = create_auth_session(session, user.id, request, device_id=recognized_device.id)
    issued_refresh = issue_refresh_token(session, user.id, settings, session_id=auth_session.id)
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
    set_device_cookie(response, device_identifier, settings)
    return TokenResponse(access_token=access_token, user=user_response(user, settings))


@router.post("/login", response_model=TokenResponse | LoginChallengeResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse | LoginChallengeResponse:
    require_allowed_origin(request, settings)
    user = await authenticate_user(session, payload.identifier, payload.password)
    raw_device_identifier = request.cookies.get(DEVICE_COOKIE_NAME)
    recognized_device = get_recognized_device(session, user.id, raw_device_identifier)
    requires_risk_challenge = bool(settings.login_risk_otp_enabled and settings.resend_api_key.strip()) and (
        recognized_device is None or device_signals_changed(session, recognized_device, request)
    )
    if requires_risk_challenge:
        challenge, challenge_token, otp_code = create_login_challenge(
            session, user, recognized_device.id if recognized_device else None, settings
        )
        try:
            await EmailService(settings).send_login_otp(user.email, otp_code)
        except EmailDeliveryError as exc:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Verification email could not be sent. Please try again later.",
            ) from exc
        await commit(session)
        return LoginChallengeResponse(
            challenge_token=challenge_token,
            message="We sent a verification code to your email to approve this login.",
        )
    return await _issue_login_session(user, request, response, session, settings, raw_device_identifier)


@router.post("/login/verify", response_model=TokenResponse)
async def login_verify(
    payload: LoginVerifyRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    require_allowed_origin(request, settings)
    challenge = get_login_challenge(session, payload.challenge_token)
    user = session.get(User, challenge.user_id) if challenge else None
    if not challenge or not user or user.account_locked:
        if user and user.account_locked:
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Your account is locked. Contact support.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")
    if not verify_login_challenge(session, challenge, user, payload.otp):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")
    challenge.consumed_at = datetime.now(UTC)
    raw_device_identifier = request.cookies.get(DEVICE_COOKIE_NAME)
    if challenge.device_id:
        if not raw_device_identifier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")
    else:
        raw_device_identifier = derive_pending_device_identifier(payload.challenge_token, settings)
    return await _issue_login_session(user, request, response, session, settings, raw_device_identifier)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RefreshResponse:
    require_allowed_origin(request, settings)
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
        replacement = session.get(type(token_record), token_record.replaced_by_id) if token_record.replaced_by_id else None
        grace_is_valid = (
            token_record.rotated_at is not None
            and token_record.revoked_at is None
            and token_record.reuse_grace_used_at is None
            and (now - token_record.rotated_at).total_seconds() <= settings.refresh_token_reuse_grace_seconds
            and replacement is not None
            and replacement.revoked_at is None
            and replacement.expires_at > now
        )
        if grace_is_valid:
            token_record.reuse_grace_used_at = now
            user = session.get(User, token_record.user_id)
            auth_session = session.get(AuthSession, token_record.session_id) if token_record.session_id else None
            if not user or user.account_locked or (auth_session and auth_session.revoked_at is not None):
                if user and user.account_locked:
                    revoke_refresh_family(session, token_record.family_id, "account_locked", now)
                    await commit(session)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=auth_error_detail("Your account is locked. Contact support.", AuthErrorCode.SESSION_NOT_FOUND),
                    )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.REFRESH_TOKEN_INVALID))
            if auth_session:
                auth_session.last_active_at = now
            issued_refresh = issue_refresh_token(session, user.id, settings, family_id=token_record.family_id, session_id=token_record.session_id)
            access_token = create_access_token(user.id)
            await commit(session)
            log_refresh_token_event(
                event="auth_refresh_token_grace_replayed",
                flow="refresh_exchange",
                token_id=str(token_record.id),
                family_id=str(token_record.family_id),
                user_id=str(user.id),
                reason="immediately_previous_token",
            )
            set_refresh_cookie(response, issued_refresh.raw_token, settings)
            return RefreshResponse(access_token=access_token)
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
    if user.account_locked:
        revoke_refresh_family(session, token_record.family_id, "account_locked", now)
        await commit(session)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Your account is locked. Contact support.", AuthErrorCode.SESSION_NOT_FOUND),
        )
    auth_session = session.get(AuthSession, token_record.session_id) if token_record.session_id else None
    if auth_session and auth_session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_error_detail("Invalid refresh token.", AuthErrorCode.REFRESH_TOKEN_INVALID))
    if auth_session:
        auth_session.last_active_at = now
    issued_refresh = issue_refresh_token(session, user.id, settings, family_id=token_record.family_id, session_id=token_record.session_id)
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
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    require_allowed_origin(request, settings)
    if refresh_token:
        token_record = get_refresh_token_for_update(session, refresh_token)
        if token_record:
            if token_record.session_id:
                auth_session = session.get(AuthSession, token_record.session_id)
                if auth_session:
                    revoke_auth_session(session, auth_session)
                else:
                    revoke_refresh_family(session, token_record.family_id, "logout")
            else:
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


async def get_optional_user(token: str | None = Depends(optional_oauth2_scheme), session: Session = Depends(get_session)) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, "access")
        return session.get(User, user_id_from_subject(str(payload.get("sub", ""))))
    except TokenValidationError:
        return None


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    return user_response(current_user, settings)


@router.get("/sessions", response_model=list[AuthSessionResponse])
async def sessions(
    request: Request,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[AuthSessionResponse]:
    current_session_id = None
    if refresh_token:
        token_record = get_refresh_token(session, refresh_token)
        if token_record and token_record.user_id == current_user.id and token_record.revoked_at is None and token_record.rotated_at is None:
            current_session_id = token_record.session_id

    return [
        AuthSessionResponse(
            id=auth_session.id,
            device_label=auth_session.device_label or "Unknown device",
            browser=auth_session.browser,
            operating_system=auth_session.operating_system,
            created_at=auth_session.created_at,
            last_active_at=auth_session.last_active_at,
            current=auth_session.id == current_session_id,
        )
        for auth_session in list_active_auth_sessions(session, current_user.id)
    ]


@router.post("/sessions/{session_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    auth_session = session.get(AuthSession, session_id)
    if not auth_session or auth_session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    if auth_session.revoked_at is None:
        revoke_auth_session(session, auth_session)
        await commit(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_other_sessions(
    request: Request,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    current_session_id = None
    if refresh_token:
        token_record = get_refresh_token(session, refresh_token)
        if token_record and token_record.user_id == current_user.id and token_record.revoked_at is None and token_record.rotated_at is None:
            current_session_id = token_record.session_id

    for auth_session in list_active_auth_sessions(session, current_user.id):
        if auth_session.id != current_session_id:
            revoke_auth_session(session, auth_session, "logout_others")
    await commit(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users/{username}", response_model=PublicUserResponse)
async def get_public_user(
    username: str,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
    settings: Settings = Depends(get_settings),
) -> PublicUserResponse:
    user = await get_user_by_username(session, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if current_user and current_user.id != user.id:
        from app.services.blocking import is_blocked
        if is_blocked(session, current_user.id, user.id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile unavailable.")
    return public_user_response(user, settings)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateCurrentUserRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    if payload.email is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email changes require ownership verification.",
        )
    return user_response(await update_current_user(session, current_user, payload), settings)


@router.post("/me/email/change/start", response_model=EmailChangeStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_my_email_change(
    payload: EmailChangeStartRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> EmailChangeStartResponse:
    require_allowed_origin(request, settings)
    try:
        challenge_token, message = await start_email_change(
            session, current_user, str(payload.email), payload.current_password, EmailService(settings)
        )
    except EmailDeliveryError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification email could not be sent. Please try again later.",
        ) from exc
    return EmailChangeStartResponse(challenge_token=challenge_token, message=message)


@router.post("/me/email/change/verify", response_model=UserResponse)
async def verify_my_email_change(
    payload: EmailChangeVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    require_allowed_origin(request, settings)
    return user_response(
        await complete_email_change(session, current_user, payload.challenge_token, payload.otp),
        settings,
    )


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    await change_password(session, current_user, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me/setup", response_model=UserResponse)
async def update_setup(
    payload: UpdateSetupRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    current_user.setup_step = payload.step
    current_user.setup_completed = payload.completed
    await commit(session)
    return user_response(current_user, settings)


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

    previous_key = current_user.profile_picture_key

    if previous_key and previous_key != payload.object_key:
        try:
            storage.delete_object(previous_key, current_user.id, allow_legacy_key=True)
        except StorageNotConfiguredError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        except (StorageObjectError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The previous profile picture could not be removed.") from exc

    updated_at = datetime.now(UTC)
    current_user.profile_picture_key = payload.object_key
    current_user.profile_picture_url = None
    current_user.profile_picture_updated_at = updated_at
    await commit(session)

    return ProfilePictureConfirmResponse(
        profile_picture_url=profile_picture_url_for(current_user, settings),
        profile_picture_updated_at=current_user.profile_picture_updated_at,
    )
