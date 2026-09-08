from pydantic import BaseModel, Field


class AuthOperationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    confirm: bool = True
