import { getConversationWithUser, listConversationMessages, sendConversationMessage, type ApiConversation, type ApiMessage } from '@/lib/auth';

export type ChatEvent = { type: 'message.created'; message: ApiMessage };

export interface ChatTransport {
  open(username: string): Promise<ApiConversation>;
  loadMessages(conversationId: string, after?: string | null): Promise<{ items: ApiMessage[]; nextCursor: string | null }>;
  send(conversationId: string, content: string, clientMessageId?: string): Promise<ApiMessage>;
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
    return getConversationWithUser(this.accessToken, username);
  }

  async loadMessages(conversationId: string, after?: string | null) {
    const page = await listConversationMessages(this.accessToken, conversationId, after);
    return { items: page.items, nextCursor: page.next_cursor };
  }

  send(conversationId: string, content: string, clientMessageId = crypto.randomUUID()) {
    return sendConversationMessage(this.accessToken, conversationId, content, clientMessageId);
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
        for (const message of page.items) {
          onEvent({ type: 'message.created', message });
        }
        if (page.items.length > 0) cursor = page.nextCursor ?? page.items[page.items.length - 1].id;
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
