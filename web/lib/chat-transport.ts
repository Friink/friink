import { getChatContext, listConversationMessages, markConversationRead, sendConversationMessage, type ApiChatContext, type ApiMessage, type ApiMessagePage } from '@/lib/auth';

export type ChatEvent = { type: 'messages.updated'; page: ApiMessagePage };

export interface ChatTransport {
  open(username: string): Promise<ApiChatContext>;
  loadMessages(conversationId: string, after?: string | null): Promise<ApiMessagePage>;
  send(conversationId: string, content: string, clientMessageId?: string): Promise<ApiMessage>;
  markRead(conversationId: string, messageId: string): ReturnType<typeof markConversationRead>;
  subscribe(conversationId: string, after: string | null, onEvent: (event: ChatEvent) => void): () => void;
}

export class PollingChatTransport implements ChatTransport {
  private readonly accessToken: string;
  private readonly intervalMs: number;

  constructor(accessToken: string, intervalMs = 4000) {
    this.accessToken = accessToken;
    this.intervalMs = intervalMs;
  }

  open(username: string) {
    return getChatContext(this.accessToken, username);
  }

  async loadMessages(conversationId: string, after?: string | null) {
    return listConversationMessages(this.accessToken, conversationId, after);
  }

  send(conversationId: string, content: string, clientMessageId = crypto.randomUUID()) {
    return sendConversationMessage(this.accessToken, conversationId, content, clientMessageId);
  }

  markRead(conversationId: string, messageId: string) {
    return markConversationRead(this.accessToken, conversationId, messageId);
  }

  subscribe(conversationId: string, after: string | null, onEvent: (event: ChatEvent) => void) {
    let cursor = after;
    let stopped = false;
    let timer: number | null = null;
    let busy = false;

    const poll = async () => {
      if (stopped || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const page = await this.loadMessages(conversationId, cursor);
        onEvent({ type: 'messages.updated', page });
        if (page.items.length > 0) cursor = page.next_cursor ?? page.items[page.items.length - 1].id;
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (!stopped) timer = window.setTimeout(async () => { await poll(); schedule(); }, this.intervalMs);
    };
    const resume = () => { void poll(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    void poll();
    schedule();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }
}
