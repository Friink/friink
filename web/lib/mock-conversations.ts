function isoOffsetFromNow(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString();
}

export const mockConversations = [
  {
    id: 1,
    name: 'Maya Chen',
    handle: '@mayachen',
    initials: 'MC',
    tone: 'coral',
    createdAt: isoOffsetFromNow(22 * 60 * 1000),
    preview: "That sounds perfect. I'll send you the address!",
    unread: true,
    muted: false,
    request: false,
    messages: [
      { id: 1, from: 'them', text: 'Found a little cabin by the lake for the weekend.', createdAt: isoOffsetFromNow(26 * 60 * 1000) },
      { id: 2, from: 'me', text: "That sounds perfect. I'll send you the address!", createdAt: isoOffsetFromNow(22 * 60 * 1000) },
    ],
  },
  {
    id: 2,
    name: 'Jon Bell',
    handle: '@jonbell',
    initials: 'JB',
    tone: 'sage',
    createdAt: isoOffsetFromNow(26 * 60 * 60 * 1000),
    preview: 'Thanks for the ceramics recommendation.',
    unread: false,
    muted: false,
    request: false,
    messages: [{ id: 1, from: 'them', text: 'Thanks for the ceramics recommendation.', createdAt: isoOffsetFromNow(26 * 60 * 60 * 1000) }],
  },
  {
    id: 3,
    name: 'Priya Shah',
    handle: '@priyashah',
    initials: 'PS',
    tone: 'sun',
    createdAt: '2026-08-24T11:00:00Z',
    preview: 'Are we still on for Thursday?',
    unread: false,
    muted: false,
    request: false,
    messages: [{ id: 1, from: 'them', text: 'Are we still on for Thursday?', createdAt: '2026-08-24T11:00:00Z' }],
  },
];

export type Conversation = typeof mockConversations[number];
