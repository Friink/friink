from app.models.user import User


class EmailService:
    async def send_registration_successful(self, user: User) -> None:
        return None
