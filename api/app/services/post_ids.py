import secrets
import string


def generate_public_id() -> str:
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
