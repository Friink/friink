from datetime import datetime
from pydantic import BaseModel, Field
class StepUpRequest(BaseModel): password: str = Field(min_length=1)
class RoleCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$"); display_name: str = Field(min_length=1, max_length=120); permissions: set[str] = set()
class RoleUpdate(BaseModel): display_name: str | None = Field(default=None, min_length=1, max_length=120); permissions: set[str] | None = None
class AssignmentRequest(BaseModel): role_key: str = Field(min_length=2, max_length=64); assigned: bool = True
class ReasonRequest(BaseModel): reason: str = Field(min_length=1, max_length=500)
class GrantRequest(BaseModel): permission: str = Field(min_length=3, max_length=100); granted: bool = True
class StaffStatusRequest(BaseModel): enabled: bool
class StaffMe(BaseModel): permissions: list[str]; privileged_expires_at: datetime
class RoleResponse(BaseModel): key: str; display_name: str; system: bool; permissions: list[str]
class StaffUserResponse(BaseModel): id: str; username: str; display_name: str | None; email: str; is_staff: bool; account_locked: bool; permissions: list[str]
class AuditResponse(BaseModel): event_type: str; payload: dict; created_at: datetime
