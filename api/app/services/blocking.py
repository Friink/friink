import base64
import binascii
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.models.chat import UserBlock
from app.models.connection import FollowRequest
from app.models.user import User
from app.schemas.blocking import BlockedUserListResponse, BlockedUserResponse
from app.services.auth import get_user_by_username
from app.services.session_ops import commit

BLOCK_PAGE_SIZE = 24

def _encode_cursor(value: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{value.isoformat()}|{row_id}".encode()).decode()

def _decode_cursor(value: str) -> tuple[datetime, uuid.UUID]:
    try:
        date_value, id_value = base64.urlsafe_b64decode(value.encode()).decode().split("|", 1)
        return datetime.fromisoformat(date_value), uuid.UUID(id_value)
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid cursor.") from exc

async def block_user(session: Session, actor: User, username: str) -> None:
    target = await get_user_by_username(session, username)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot block yourself.")
    existing = session.execute(select(UserBlock).where(UserBlock.blocker_id == actor.id, UserBlock.blocked_id == target.id)).scalar_one_or_none()
    if not existing:
        session.add(UserBlock(blocker_id=actor.id, blocked_id=target.id))
    session.execute(delete(FollowRequest).where(or_(and_(FollowRequest.requester_id == actor.id, FollowRequest.recipient_id == target.id), and_(FollowRequest.requester_id == target.id, FollowRequest.recipient_id == actor.id))))
    await commit(session)

async def unblock_user(session: Session, actor: User, username: str) -> None:
    target = await get_user_by_username(session, username)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    session.execute(delete(UserBlock).where(UserBlock.blocker_id == actor.id, UserBlock.blocked_id == target.id))
    await commit(session)

def is_blocked(session: Session, first_id: uuid.UUID, second_id: uuid.UUID) -> bool:
    return session.execute(select(UserBlock.id).where(or_(and_(UserBlock.blocker_id == first_id, UserBlock.blocked_id == second_id), and_(UserBlock.blocker_id == second_id, UserBlock.blocked_id == first_id))).limit(1)).scalar_one_or_none() is not None

async def list_blocked(session: Session, actor: User, query: str, cursor: str | None, limit: int) -> BlockedUserListResponse:
    statement = select(UserBlock, User).join(User, User.id == UserBlock.blocked_id).where(UserBlock.blocker_id == actor.id)
    needle = query.strip().lower()
    if needle:
        statement = statement.where(or_(User.username.ilike(f"%{needle}%"), User.display_name.ilike(f"%{needle}%")))
    if cursor:
        created_at, row_id = _decode_cursor(cursor)
        statement = statement.where(or_(UserBlock.created_at < created_at, and_(UserBlock.created_at == created_at, UserBlock.id < row_id)))
    result = session.execute(statement.order_by(UserBlock.created_at.desc(), UserBlock.id.desc()).limit(min(limit, BLOCK_PAGE_SIZE) + 1)).all()
    has_more = len(result) > min(limit, BLOCK_PAGE_SIZE)
    rows = result[:min(limit, BLOCK_PAGE_SIZE)]
    return BlockedUserListResponse(items=[BlockedUserResponse(id=user.id, username=user.username, display_name=user.display_name, profile_picture_url=user.profile_picture_url, blocked_at=block.created_at) for block, user in rows], next_cursor=_encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None)
