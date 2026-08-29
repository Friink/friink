from fastapi import Header


async def get_auth_flow_context(
    x_friink_auth_context: str | None = Header(default=None, alias="X-Friink-Auth-Context"),
) -> str | None:
    return x_friink_auth_context
