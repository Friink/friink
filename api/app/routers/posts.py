import logging
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.security import decode_token
from app.services.auth import user_id_from_subject
from app.config import Settings, get_settings
from app.schemas.posts import CreatePostRequest, FeedContextResponse, FeedPageResponse, LikeActorPageResponse, PostMediaCleanupRequest, PostMediaConfirmRequest, PostMediaConfirmResponse, PostMediaUploadUrlItem, PostMediaUploadUrlRequest, PostMediaUploadUrlResponse, PostResponse, ReactionResponse
from app.services.post_media import PostMediaObjectError, PostMediaStorageNotConfiguredError, PostMediaStorageService
from app.services.posts import can_view_post, create_post, delete_post, get_feed_context, get_newer_posts, get_post, get_post_by_public_id, get_post_for_response, get_post_replies, get_posts_page, serialize_post
from app.services.reactions import list_like_actors, list_starred_posts, set_like, set_star
from app.services.session_ops import rollback

router = APIRouter(prefix="/posts", tags=["posts"])
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
logger = logging.getLogger("friink.posts")


def _post_media_request_id() -> str:
    return uuid.uuid4().hex[:12]


def _post_media_http_error(*, stage: str, request_id: str, status_code: int, message: str, error: Exception) -> HTTPException:
    logger.exception(
        "post_media_failure stage=%s request_id=%s error_type=%s error=%s",
        stage,
        request_id,
        type(error).__name__,
        str(error),
    )
    return HTTPException(
        status_code=status_code,
        detail=f"{message} Reference: {request_id}.",
        headers={
            "X-Friink-Post-Media-Stage": stage,
            "X-Friink-Request-Id": request_id,
        },
    )


def _cleanup_post_media(storage: PostMediaStorageService, storage_keys: list[str], user_id: uuid.UUID, request_id: str) -> None:
    for key in storage_keys:
        try:
            storage.delete(key, user_id)
        except Exception:
            logger.exception(
                "post_media_cleanup_failure request_id=%s user_id=%s storage_key=%s",
                request_id,
                user_id,
                key,
            )


async def get_optional_current_user(
    request: Request,
    token: str | None = Depends(optional_oauth2_scheme),
    session: Session = Depends(get_session),
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, "access")
        user_id = user_id_from_subject(str(payload.get("sub", "")))
    except Exception:
        return None
    return session.get(User, user_id)


@router.post("/media/upload-url", response_model=PostMediaUploadUrlResponse)
async def create_post_media_upload_urls(
    payload: PostMediaUploadUrlRequest,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> PostMediaUploadUrlResponse:
    storage = PostMediaStorageService(settings)
    request_id = _post_media_request_id()
    try:
        items = [storage.create_upload(current_user.id) for _ in range(payload.count)]
    except PostMediaStorageNotConfiguredError as exc:
        raise _post_media_http_error(
            stage="upload_plan_storage_config",
            request_id=request_id,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message="Post-media upload storage is not configured.",
            error=exc,
        ) from exc
    except Exception as exc:
        raise _post_media_http_error(
            stage="upload_plan_generation",
            request_id=request_id,
            status_code=status.HTTP_502_BAD_GATEWAY,
            message="The API could not create the post-media upload plan.",
            error=exc,
        ) from exc
    return PostMediaUploadUrlResponse(
        items=[
            PostMediaUploadUrlItem(
                upload_url=item.upload_url,
                public_url=item.public_url,
                object_key=item.object_key,
            )
            for item in items
        ]
    )


@router.post("/media/confirm", response_model=PostMediaConfirmResponse)
async def confirm_post_media_upload(
    payload: PostMediaConfirmRequest,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> PostMediaConfirmResponse:
    storage = PostMediaStorageService(settings)
    request_id = _post_media_request_id()
    try:
        storage.confirm(payload.object_key, current_user.id)
    except ValueError as exc:
        raise _post_media_http_error(
            stage="object_key_validation",
            request_id=request_id,
            status_code=status.HTTP_400_BAD_REQUEST,
            message="The post-media object key is invalid.",
            error=exc,
        ) from exc
    except PostMediaStorageNotConfiguredError as exc:
        raise _post_media_http_error(
            stage="object_verification_storage_config",
            request_id=request_id,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message="Post-media upload storage is not configured.",
            error=exc,
        ) from exc
    except PostMediaObjectError as exc:
        raise _post_media_http_error(
            stage="object_verification",
            request_id=request_id,
            status_code=status.HTTP_502_BAD_GATEWAY,
            message="The uploaded post image could not be verified.",
            error=exc,
        ) from exc
    except Exception as exc:
        raise _post_media_http_error(
            stage="object_verification_unexpected",
            request_id=request_id,
            status_code=status.HTTP_502_BAD_GATEWAY,
            message="The API encountered an unexpected post-image verification error.",
            error=exc,
        ) from exc
    return PostMediaConfirmResponse(
        object_key=payload.object_key,
        public_url=storage.public_url(payload.object_key),
    )


@router.post("/media/cleanup", status_code=status.HTTP_204_NO_CONTENT)
async def cleanup_post_media_uploads(
    payload: PostMediaCleanupRequest,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> Response:
    storage = PostMediaStorageService(settings)
    request_id = _post_media_request_id()
    for key in payload.storage_keys:
        try:
            storage.delete(key, current_user.id)
        except (ValueError, PostMediaStorageNotConfiguredError, PostMediaObjectError) as exc:
            logger.warning(
                "post_media_cleanup_failure request_id=%s user_id=%s storage_key=%s error_type=%s error=%s",
                request_id,
                current_user.id,
                key,
                type(exc).__name__,
                str(exc),
            )
        except Exception as exc:
            logger.exception(
                "post_media_cleanup_unexpected_failure request_id=%s user_id=%s storage_key=%s",
                request_id,
                current_user.id,
                key,
            )
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers={"X-Friink-Request-Id": request_id},
    )


@router.get("", response_model=FeedPageResponse)
async def list_posts(
    cursor: str | None = None,
    limit: int = 20,
    feed: Literal["explore", "following"] = "explore",
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await get_posts_page(session, limit=limit, cursor=cursor, viewer=current_user, feed=feed)


@router.get("/updates", response_model=list[PostResponse])
async def list_post_updates(
    after_created_at: datetime,
    after_id: uuid.UUID,
    limit: int = 20,
    feed: Literal["explore", "following"] = "explore",
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> list[PostResponse]:
    return [serialize_post(post, viewer=current_user, session=session) for post in await get_newer_posts(session, after_created_at=after_created_at, after_post_id=after_id, limit=limit, viewer=current_user, feed=feed)]


@router.get("/starred", response_model=FeedPageResponse)
async def get_starred_posts(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await list_starred_posts(session, current_user, cursor, limit)


@router.get("/context/{post_id}", response_model=FeedContextResponse)
async def get_post_context(
    post_id: uuid.UUID,
    before_limit: int = 10,
    after_limit: int = 10,
    feed: Literal["explore", "following"] = "explore",
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> FeedContextResponse:
    context = await get_feed_context(session, post_id, before_limit=before_limit, after_limit=after_limit, viewer=current_user, feed=feed)
    if not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return context


@router.get("/public/{public_id}", response_model=PostResponse)
async def get_public_post_route(public_id: str, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post_by_public_id(session, public_id)
    if not post or not can_view_post(session, current_user, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post, viewer=current_user, session=session)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post_route(post_id: uuid.UUID, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post(session, post_id)
    if not post or not can_view_post(session, current_user, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post, viewer=current_user, session=session)


@router.post("/{post_id}/like", response_model=ReactionResponse)
async def like_post(post_id: uuid.UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ReactionResponse:
    return await set_like(session, current_user, post_id, True)


@router.delete("/{post_id}/like", response_model=ReactionResponse)
async def unlike_post(post_id: uuid.UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ReactionResponse:
    return await set_like(session, current_user, post_id, False)


@router.post("/{post_id}/star", response_model=ReactionResponse)
async def star_post(post_id: uuid.UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ReactionResponse:
    return await set_star(session, current_user, post_id, True)


@router.delete("/{post_id}/star", response_model=ReactionResponse)
async def unstar_post(post_id: uuid.UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ReactionResponse:
    return await set_star(session, current_user, post_id, False)


@router.get("/{post_id}/likes", response_model=LikeActorPageResponse)
async def get_post_like_actors(
    post_id: uuid.UUID,
    query: str = "",
    cursor: str | None = None,
    limit: int = 24,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LikeActorPageResponse:
    return await list_like_actors(session, current_user, post_id, query, cursor, limit)


@router.get("/{post_id}/replies", response_model=list[PostResponse])
async def list_post_replies(post_id: uuid.UUID, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> list[PostResponse]:
    return [serialize_post(post, viewer=current_user, session=session) for post in await get_post_replies(session, post_id, viewer=current_user)]


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post_route(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        await delete_post(session, current_user, post_id, PostMediaStorageService(settings))
    except PostMediaStorageNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except PostMediaObjectError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_route(
    payload: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> PostResponse:
    storage = PostMediaStorageService(settings)
    media_keys = [item.storage_key for item in payload.media or []]
    request_id = _post_media_request_id()
    try:
        for key in media_keys:
            try:
                storage.confirm(key, current_user.id)
            except ValueError as exc:
                raise _post_media_http_error(
                    stage="object_key_validation",
                    request_id=request_id,
                    status_code=status.HTTP_400_BAD_REQUEST,
                    message="The post-media object key is invalid.",
                    error=exc,
                ) from exc
            except PostMediaStorageNotConfiguredError as exc:
                raise _post_media_http_error(
                    stage="object_verification_storage_config",
                    request_id=request_id,
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    message="Post-media upload storage is not configured.",
                    error=exc,
                ) from exc
            except PostMediaObjectError as exc:
                raise _post_media_http_error(
                    stage="object_verification",
                    request_id=request_id,
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    message="The uploaded post image could not be verified.",
                    error=exc,
                ) from exc
            except Exception as exc:
                raise _post_media_http_error(
                    stage="object_verification_unexpected",
                    request_id=request_id,
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    message="The API encountered an unexpected post-image verification error.",
                    error=exc,
                ) from exc
        payload = payload.model_copy(update={
            "media": [item.model_copy(update={"url": storage.public_url(item.storage_key)}) for item in payload.media or []]
        })
        try:
            post = await create_post(session, current_user, payload)
        except HTTPException:
            await rollback(session)
            raise
        except Exception as exc:
            await rollback(session)
            raise _post_media_http_error(
                stage="post_database_association",
                request_id=request_id,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="The uploaded images were verified, but the post could not be saved.",
                error=exc,
            ) from exc
    except HTTPException:
        _cleanup_post_media(storage, media_keys, current_user.id, request_id)
        raise
    except Exception as exc:
        _cleanup_post_media(storage, media_keys, current_user.id, request_id)
        raise _post_media_http_error(
            stage="post_creation_unexpected",
            request_id=request_id,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="The post could not be completed after the image upload.",
            error=exc,
        ) from exc
    try:
        response_post = await get_post_for_response(session, post.id)
        return serialize_post(response_post, viewer=current_user, session=session)
    except Exception as exc:
        raise _post_media_http_error(
            stage="post_response_serialization",
            request_id=request_id,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="The post was saved, but the API could not prepare its response.",
            error=exc,
        ) from exc
