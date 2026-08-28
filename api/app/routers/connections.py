import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.connections import ConnectionListResponse, ConnectionStatusResponse, FollowRequestResponse, SendFollowRequestPayload
from app.services.connections import (
    accept_follow_request,
    cancel_follow_request,
    get_connection_status,
    get_user_for_public_connections,
    list_followers,
    list_following,
    list_incoming_pending,
    list_outgoing_pending,
    reject_follow_request,
    remove_connection,
    send_follow_request,
    serialize_follow_request,
)

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/requests", response_model=FollowRequestResponse, status_code=status.HTTP_201_CREATED)
async def send_request(
    payload: SendFollowRequestPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowRequestResponse:
    return serialize_follow_request(await send_follow_request(session, current_user, payload))


@router.post("/requests/{request_id}/accept", response_model=FollowRequestResponse)
async def accept_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowRequestResponse:
    return serialize_follow_request(await accept_follow_request(session, current_user, request_id))


@router.post("/requests/{request_id}/reject", response_model=FollowRequestResponse)
async def reject_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowRequestResponse:
    return serialize_follow_request(await reject_follow_request(session, current_user, request_id))


@router.post("/requests/{request_id}/cancel", response_model=FollowRequestResponse)
async def cancel_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowRequestResponse:
    return serialize_follow_request(await cancel_follow_request(session, current_user, request_id))


@router.delete("/{request_id}", response_model=FollowRequestResponse)
async def delete_connection(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowRequestResponse:
    return serialize_follow_request(await remove_connection(session, current_user, request_id))


@router.get("/users/{username}/followers", response_model=ConnectionListResponse)
async def followers(username: str, session: Session = Depends(get_session)) -> ConnectionListResponse:
    return await list_followers(session, await get_user_for_public_connections(session, username))


@router.get("/users/{username}/following", response_model=ConnectionListResponse)
async def following(username: str, session: Session = Depends(get_session)) -> ConnectionListResponse:
    return await list_following(session, await get_user_for_public_connections(session, username))


@router.get("/requests/incoming", response_model=list[FollowRequestResponse])
async def incoming_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FollowRequestResponse]:
    return [serialize_follow_request(request) for request in await list_incoming_pending(session, current_user)]


@router.get("/requests/outgoing", response_model=list[FollowRequestResponse])
async def outgoing_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FollowRequestResponse]:
    return [serialize_follow_request(request) for request in await list_outgoing_pending(session, current_user)]


@router.get("/status/{username}", response_model=ConnectionStatusResponse)
async def status_for_user(
    username: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionStatusResponse:
    return await get_connection_status(session, current_user, username)
