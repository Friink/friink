from datetime import date
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker

from app.db import Base
from app.models.notification import Notification
from app.models.professional_registration import ProfessionalRegistration
from app.models.staff import StaffPermission
from app.models.subscription import Plan, PlanEntitlement, SubscriptionAssignment
from app.models.user import User
from app.services.professional_registration import cancel, decide, directory_eligible, response, submit


@pytest.fixture
def registration_session():
    path = Path.cwd() / f".professional-registration-test-{uuid.uuid4().hex}.sqlite3"
    engine = create_engine(f"sqlite+pysqlite:///{path}")
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _record):
        connection.create_function("char_length", 1, len)
    Base.metadata.create_all(engine)
    with sessionmaker(engine)() as session:
        yield session
    engine.dispose(); path.unlink(missing_ok=True)


def user(name: str, staff: bool = False) -> User:
    return User(public_id=f"public-{name}-{uuid.uuid4().hex}", email=f"{name}-{uuid.uuid4().hex}@example.com", username=name, username_key=name, password_hash="hash", date_of_birth=date(1990, 1, 1), is_staff=staff)


def test_registration_reject_reapply_approve_revoke(registration_session: Session):
    applicant = user("applicant"); staff = user("staff", True)
    registration_session.add_all([applicant, staff, StaffPermission(key="professional_registration.manage", display_name="Manage registrations")])
    registration_session.commit()
    first = submit(registration_session, applicant, "Institute", "ID-1")
    assert first.status == "pending"
    assert response(registration_session, applicant)["show_registered_badge"] is False
    with pytest.raises(HTTPException) as duplicate:
        submit(registration_session, applicant, "Other", "ID-2")
    assert duplicate.value.status_code == 409
    decide(registration_session, staff, first, "reject", "Please provide a clearer credential ID.")
    assert first.status == "rejected"
    second = submit(registration_session, applicant, "Institute", "ID-2")
    decide(registration_session, staff, second, "approve", None)
    assert response(registration_session, applicant)["show_registered_badge"] is True
    decide(registration_session, staff, second, "revoke", "Registration has expired.")
    current = response(registration_session, applicant)
    assert current["show_registered_badge"] is False
    assert current["status"] == "revoked"
    assert registration_session.scalar(select(Notification).where(Notification.recipient_user_id == applicant.id, Notification.type == "professional_registration_approved")) is not None


def test_cancel_is_available_while_pending(registration_session: Session):
    applicant = user("cancel")
    registration_session.add(applicant); registration_session.commit()
    submit(registration_session, applicant, "Institute", "ID")
    cancelled = cancel(registration_session, applicant)
    assert cancelled.status == "cancelled"


def test_directory_requires_entitlement_and_professional_status(registration_session: Session):
    applicant = user("directory"); free = Plan(code="friink_free", name="Free", description="Free"); pro = Plan(code="friink_pro", name="Pro", description="Pro")
    pro.entitlements.append(PlanEntitlement(entitlement_key="professional_directory"))
    registration_session.add_all([applicant, free, pro]); registration_session.flush()
    registration_session.add(SubscriptionAssignment(user_id=applicant.id, plan_id=pro.id, starts_at=__import__("datetime").datetime.now(__import__("datetime").UTC), granted_by_user_id=applicant.id, reason="test"))
    registration_session.commit()
    assert not directory_eligible(registration_session, applicant)
    applicant.use_intent = "professional"; registration_session.commit()
    assert directory_eligible(registration_session, applicant)
