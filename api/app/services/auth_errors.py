from enum import StrEnum


class AuthErrorCode(StrEnum):
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    TOKEN_MALFORMED = "TOKEN_MALFORMED"
    TOKEN_SIGNATURE_MISMATCH = "TOKEN_SIGNATURE_MISMATCH"
    TOKEN_SCHEMA_INVALID = "TOKEN_SCHEMA_INVALID"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    REFRESH_TOKEN_MISSING = "REFRESH_TOKEN_MISSING"
    REFRESH_TOKEN_INVALID = "REFRESH_TOKEN_INVALID"


CLIENT_SAFE_TOKEN_ERROR_CODES = {
    AuthErrorCode.TOKEN_EXPIRED,
    AuthErrorCode.SESSION_NOT_FOUND,
    AuthErrorCode.REFRESH_TOKEN_MISSING,
    AuthErrorCode.REFRESH_TOKEN_INVALID,
}


def auth_error_detail(message: str, code: AuthErrorCode) -> dict[str, str]:
    client_code = code if code in CLIENT_SAFE_TOKEN_ERROR_CODES else AuthErrorCode.TOKEN_INVALID
    return {"message": message, "code": client_code.value}
