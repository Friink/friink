from datetime import UTC, datetime, timedelta
import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.auth_challenge import LoginChallenge
from app.models.auth_session import AuthSession
from app.models.chat import Conversation, ConversationSetting, Message, UserBlock
from app.models.connection import FollowRequest
from app.models.identity_history import UserEmailHistory, UserUsernameHistory
from app.models.notification import Notification
from app.models.notification_outbox import NotificationOutbox
from app.models.otp import OtpCode
from app.models.post import Post, PostLike, PostMedia, PostSave
from app.models.recognized_device import RecognizedDevice
from app.models.refresh_token import RefreshToken
from app.models.security_event import SecurityEvent
from app.models.signup_reservation import SignupReservation
from app.models.user import User
from app.services.login_challenges import create_login_challenge, get_login_challenge, verify_login_challenge
from app.services.session_ops import commit
from app.services.session_service import list_active_auth_sessions, revoke_auth_session
from app.services.security import verify_password

ACTIVE = "active"
DEACTIVATED = "deactivated"
PENDING_DELETION = "pending_deletion"
DELETED = "deleted"
DEACTIVATION_COOLDOWN = timedelta(hours=24)


def ensure_active(user: User) -> None:
    if user.lifecycle_status != ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account is not active.")


def lifecycle_display_name(user: User) -> str:
    return "Account Deleted" if user.lifecycle_status == DELETED else "Friink User" if user.lifecycle_status != ACTIVE else (user.display_name or user.username)


def lifecycle_profile_picture(user: User):
    return None if user.lifecycle_status != ACTIVE else user.profile_picture_url


def _verify_current_password(user: User, current_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")


def _revoke_everything(session: Session, user: User, reason: str) -> None:
    for auth_session in list_active_auth_sessions(session, user.id):
        revoke_auth_session(session, auth_session, reason)
    session.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC), revocation_reason=reason)
    )
    session.execute(
        RecognizedDevice.__table__.update()
        .where(RecognizedDevice.user_id == user.id, RecognizedDevice.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def deactivate_account(session: Session, user: User, current_password: str) -> None:
    ensure_active(user)
    _verify_current_password(user, current_password)
    now = datetime.now(UTC)
    if user.reactivation_cooldown_until and user.reactivation_cooldown_until > now:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Account deactivation is temporarily unavailable after reactivation.")
    user.lifecycle_status = DEACTIVATED
    user.deactivated_at = now
    _revoke_everything(session, user, "account_deactivated")
    await commit(session)


def start_lifecycle_challenge(session: Session, user: User, settings: Settings, *, kind: str) -> tuple[str, str]:
    _challenge, raw_token, otp_code = create_login_challenge(session, user, None, settings, kind=kind)
    return raw_token, otp_code


async def start_deletion(session: Session, user: User, current_password: str, settings: Settings) -> tuple[str | None, str | None]:
    ensure_active(user)
    _verify_current_password(user, current_password)
    if not settings.otp_enabled:
        return None, None
    return start_lifecycle_challenge(session, user, settings, kind="deletion")


async def confirm_deletion(session: Session, user: User, token: str | None, otp: str | None, settings: Settings) -> None:
    ensure_active(user)
    challenge = None
    if settings.otp_enabled:
        challenge = get_login_challenge(session, token or "")
        if not challenge or challenge.user_id != user.id or challenge.kind != "deletion" or not verify_login_challenge(session, challenge, user, otp or ""):
            await commit(session)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")
    now = datetime.now(UTC)
    user.lifecycle_status = PENDING_DELETION
    user.deactivated_at = now
    user.deletion_requested_at = now
    user.deletion_deadline = now + timedelta(days=settings.account_deletion_grace_days)
    user.deletion_request_id = uuid.uuid4()
    user.deletion_warning_sent_at = None
    if challenge:
        challenge.consumed_at = now
    _revoke_everything(session, user, "account_pending_deletion")
    await commit(session)


def reactivate_account(session: Session, user: User, challenge: LoginChallenge | None) -> None:
    now = datetime.now(UTC)
    user.lifecycle_status = ACTIVE
    user.deactivated_at = None
    user.reactivation_cooldown_until = now + DEACTIVATION_COOLDOWN
    if challenge and challenge.kind == "reactivation_pending_deletion":
        user.deletion_requested_at = None
        user.deletion_deadline = None
        user.deletion_request_id = None
        user.deletion_warning_sent_at = None
    if challenge:
        challenge.consumed_at = now


def anonymize_deleted_identity(user: User) -> None:
    suffix = str(user.id).replace("-", "")[:20]
    user.email = f"deleted-{suffix}@deleted.invalid"
    user.username = f"deleted-{suffix}"
    user.username_key = user.username.casefold()
    user.display_name = "Account Deleted"
    user.about = None
    user.location = None
    user.profile_picture_url = None
    user.profile_picture_key = None
    user.lifecycle_status = DELETED
    user.deleted_at = datetime.now(UTC)


def process_pending_deletions(session: Session, settings: Settings, *, now: datetime | None = None, limit: int = 50) -> int:
    now = now or datetime.now(UTC)
    users = list(session.execute(select(User).where(User.lifecycle_status == PENDING_DELETION, User.deletion_deadline <= now).with_for_update(skip_locked=True).limit(limit)).scalars().all())
    processed = 0
    for user in users:
        try:
            post_ids = session.execute(select(Post.id).where(Post.user_id == user.id)).scalars().all()
            if post_ids:
                session.execute(
                    update(Post)
                    .where(or_(Post.parent_post_id.in_(post_ids), Post.quoted_post_id.in_(post_ids)))
                    .values(parent_post_id=None, quoted_post_id=None)
                )
                session.execute(delete(PostMedia).where(PostMedia.post_id.in_(post_ids)))
                session.execute(delete(PostLike).where(PostLike.post_id.in_(post_ids)))
                session.execute(delete(PostSave).where(PostSave.post_id.in_(post_ids)))
                session.execute(delete(Post).where(Post.id.in_(post_ids)))
            session.execute(delete(FollowRequest).where((FollowRequest.requester_id == user.id) | (FollowRequest.recipient_id == user.id)))
            session.execute(delete(UserBlock).where((UserBlock.blocker_id == user.id) | (UserBlock.blocked_id == user.id)))
            session.execute(delete(Notification).where((Notification.recipient_user_id == user.id) | (Notification.actor_user_id == user.id)))
            session.execute(delete(NotificationOutbox).where(NotificationOutbox.event_id.in_(select(SecurityEvent.id).where(SecurityEvent.user_id == user.id))))
            session.execute(delete(ConversationSetting).where(ConversationSetting.user_id == user.id))
            session.execute(delete(OtpCode).where(OtpCode.user_id == user.id))
            session.execute(delete(LoginChallenge).where(LoginChallenge.user_id == user.id))
            session.execute(delete(RecognizedDevice).where(RecognizedDevice.user_id == user.id))
            session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="deleted"))
            session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="deleted"))
            user.deletion_failure_at = None
            user.deletion_failure_reason = None
            anonymize_deleted_identity(user)
            processed += 1
        except Exception as exc:
            session.rollback()
            failed = session.get(User, user.id)
            if failed:
                failed.deletion_failure_at = datetime.now(UTC)
                failed.deletion_failure_reason = str(exc)[:500]
                session.commit()
    if processed:
        session.commit()
    return processed
