import base64
import binascii
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.profile_save import ProfileSave
from app.models.user import User
from app.schemas.profile_saves import ProfileSaveStatusResponse, SavedProfilePageResponse, SavedProfileResponse
from app.services.auth import get_user_by_username
from app.services.profile_media import profile_picture_url_for
from app.services.session_ops import commit

PROFILE_SAVE_PAGE_SIZE = 20


def _encode_cursor(created_at: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{row_id}".encode()).decode()


def _decode_cursor(value: str) -> tuple[datetime, uuid.UUID]:
    try:
        decoded = base64.urlsafe_b64decode(value.encode()).decode()
        date_value, row_id = decoded.split("|", 1)
        return datetime.fromisoformat(date_value), uuid.UUID(row_id)
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid cursor.") from exc


def _is_available(profile: User) -> bool:
    return profile.lifecycle_status == "active" and profile.deleted_at is None


def _serialize_saved_profile(saved: ProfileSave, profile: User) -> SavedProfileResponse:
    available = _is_available(profile)
    return SavedProfileResponse(
        id=str(profile.public_id),
        username=profile.username if available else None,
        display_name=profile.display_name if available else None,
        profile_picture_url=profile_picture_url_for(profile) if available else None,
        show_professional_badge=profile.show_professional_badge if available else False,
        available=available,
    )


async def get_profile_save_status(session: Session, viewer: User, username: str) -> ProfileSaveStatusResponse:
    profile = await get_user_by_username(session, username)
    if not profile or profile.id == viewer.id or not _is_available(profile):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile unavailable.")
    saved = session.execute(
        select(ProfileSave.id).where(ProfileSave.profile_id == profile.id, ProfileSave.user_id == viewer.id)
    ).scalar_one_or_none() is not None
    return ProfileSaveStatusResponse(username=profile.username, saved=saved)


async def set_profile_save(session: Session, viewer: User, username: str, active: bool) -> ProfileSaveStatusResponse:
    profile = await get_user_by_username(session, username)
    if not profile or profile.id == viewer.id or not _is_available(profile):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile unavailable.")
    existing = session.execute(
        select(ProfileSave).where(ProfileSave.profile_id == profile.id, ProfileSave.user_id == viewer.id)
    ).scalar_one_or_none()
    if active and not existing:
        session.add(ProfileSave(profile_id=profile.id, user_id=viewer.id))
    elif not active and existing:
        session.delete(existing)
    await commit(session)
    return ProfileSaveStatusResponse(username=profile.username, saved=active)


async def list_saved_profiles(session: Session, viewer: User, cursor: str | None, limit: int) -> SavedProfilePageResponse:
    page_size = max(1, min(limit, PROFILE_SAVE_PAGE_SIZE))
    statement = (
        select(ProfileSave, User)
        .join(User, User.id == ProfileSave.profile_id)
        .where(ProfileSave.user_id == viewer.id)
        .order_by(ProfileSave.created_at.desc(), ProfileSave.id.desc())
    )
    if cursor:
        created_at, row_id = _decode_cursor(cursor)
        statement = statement.where(
            or_(ProfileSave.created_at < created_at, and_(ProfileSave.created_at == created_at, ProfileSave.id < row_id))
        )
    rows = list(session.execute(statement.limit(page_size + 1)).all())
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    return SavedProfilePageResponse(
        items=[_serialize_saved_profile(saved, profile) for saved, profile in rows],
        next_cursor=_encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None,
        has_more=has_more,
    )


async def remove_saved_profile(session: Session, viewer: User, profile_public_id: str) -> None:
    existing = session.execute(
        select(ProfileSave)
        .join(User, User.id == ProfileSave.profile_id)
        .where(ProfileSave.user_id == viewer.id, User.public_id == profile_public_id)
    ).scalar_one_or_none()
    if existing:
        session.delete(existing)
        await commit(session)
