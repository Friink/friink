from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class SubscriptionGrantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_code: str = Field(pattern=r"^friink_(free|pro|pro_plus)$")
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    expires_at: datetime | None = None
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_expiry_choice(self) -> "SubscriptionGrantRequest":
        if self.duration_days is not None and self.expires_at is not None:
            raise ValueError("Choose a duration or a custom expiry date, not both.")
        return self

class SubscriptionRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1, max_length=500)

class SubscriptionResponse(BaseModel):
    plan_code: str
    plan_name: str
    expires_at: datetime | None
    status: str
    assignment_id: str | None
    assignment_status: str | None = None
    entitlements: list[str] = Field(default_factory=list)

class SubscriptionAssignmentResponse(SubscriptionResponse):
    user_id: str
    starts_at: datetime | None
    reason: str | None
    created_at: datetime | None
    revoked_at: datetime | None

class PlanResponse(BaseModel):
    code: str
    name: str
    description: str
    active: bool
