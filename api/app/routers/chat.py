import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import ChatContextResponse, ConversationListResponse, ConversationResponse, MessagePageResponse, MessageResponse, SendMessageRequest
from app.services.chat import accept_request, get_chat_context, list_conversations, list_messages, send_message, send_message_to_user, set_conversation_setting

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=ConversationListResponse)
async def conversations(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ConversationListResponse:
    return await list_conversations(session, current_user)


@router.post("/conversations/with/{username}", response_model=ChatContextResponse)
async def conversation_with_user(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ChatContextResponse:
    return await get_chat_context(session, current_user, username)


@router.post("/conversations/with/{username}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message_for_user(username: str, payload: SendMessageRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> MessageResponse:
    message, _ = await send_message_to_user(session, current_user, username, payload.content, payload.client_message_id)
    return message


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePageResponse)
async def messages(
    conversation_id: uuid.UUID,
    after: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MessagePageResponse:
    return await list_messages(session, current_user, conversation_id, after)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MessageResponse:
    return await send_message(session, current_user, conversation_id, payload.content, payload.client_message_id)


@router.post("/conversations/{conversation_id}/accept", response_model=ConversationResponse)
async def accept_chat_request(conversation_id: uuid.UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ConversationResponse:
    return await accept_request(session, current_user, conversation_id)


@router.patch("/conversations/{conversation_id}/settings", response_model=ConversationResponse)
async def update_chat_settings(conversation_id: uuid.UUID, muted: bool | None = Query(default=None), archived: bool | None = Query(default=None), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ConversationResponse:
    if muted is None and archived is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide muted or archived.")
    return await set_conversation_setting(session, current_user, conversation_id, muted=muted, archived=archived)
