import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import ConversationListResponse, ConversationResponse, MessagePageResponse, MessageResponse, SendMessageRequest
from app.services.chat import get_or_create_conversation, list_conversations, list_messages, send_message, serialize_conversation

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=ConversationListResponse)
async def conversations(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ConversationListResponse:
    return await list_conversations(session, current_user)


@router.post("/conversations/with/{username}", response_model=ConversationResponse)
async def conversation_with_user(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ConversationResponse:
    conversation = await get_or_create_conversation(session, current_user, username)
    return serialize_conversation(conversation, current_user.id)


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
