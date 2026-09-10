from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class SubscriptionGrantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_code: str = Field(pattern=r"^friink_(free|pro|pro_plus)$")
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    reason: str = Field(min_length=1, max_length=500)

class SubscriptionRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1, max_length=500)

class SubscriptionResponse(BaseModel):
    plan_code: str
    plan_name: str
    expires_at: datetime | None
    status: str
    assignment_id: str | None

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
