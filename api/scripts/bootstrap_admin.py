"""Create the reserved Friink superadmin account without storing its password."""

from datetime import date
from getpass import getpass

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.identity_history import UserEmailHistory, UserUsernameHistory
from app.models.user import User
from app.services.security import hash_password


def main() -> None:
    settings = get_settings()
    engine = create_engine(settings.async_database_url, connect_args=settings.async_connect_args)
    with Session(engine) as session:
        existing = session.execute(select(User).where(func.lower(User.email) == "admin@friink.com")).scalar_one_or_none()
        if existing:
            raise SystemExit("admin@friink.com already exists; refusing to overwrite it.")
        password = getpass("Initial password for admin@friink.com: ")
        confirmation = getpass("Confirm initial password: ")
        if password != confirmation:
            raise SystemExit("Passwords do not match.")
        user = User(
            email="admin@friink.com",
            username="admin",
            username_key="admin",
            display_name="Friink Admin",
            password_hash=hash_password(password),
            date_of_birth=date(1900, 1, 1),
            is_verified=True,
            is_staff=True,
            setup_step=2,
            setup_completed=True,
        )
        session.add(user)
        session.flush()
        session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="created"))
        session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="created"))
        session.commit()
        print("Created the initial staff account admin@friink.com (@admin).")


if __name__ == "__main__":
    main()
