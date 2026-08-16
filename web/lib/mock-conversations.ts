export const mockConversations = [
  {
    id: 1,
    name: 'Maya Chen',
    handle: '@mayachen',
    initials: 'MC',
    tone: 'coral',
    time: '10:42 AM',
    preview: "That sounds perfect. I'll send you the address!",
    unread: true,
    messages: [
      { id: 1, from: 'them', text: 'Found a little cabin by the lake for the weekend.', time: '10:38 AM' },
      { id: 2, from: 'me', text: "That sounds perfect. I'll send you the address!", time: '10:42 AM' },
    ],
  },
  {
    id: 2,
    name: 'Jon Bell',
    handle: '@jonbell',
    initials: 'JB',
    tone: 'sage',
    time: 'Yesterday',
    preview: 'Thanks for the ceramics recommendation.',
    unread: false,
    messages: [{ id: 1, from: 'them', text: 'Thanks for the ceramics recommendation.', time: 'Yesterday' }],
  },
  {
    id: 3,
    name: 'Priya Shah',
    handle: '@priyashah',
    initials: 'PS',
    tone: 'sun',
    time: 'Mon',
    preview: 'Are we still on for Thursday?',
    unread: false,
    messages: [{ id: 1, from: 'them', text: 'Are we still on for Thursday?', time: 'Mon' }],
  },
];

export type Conversation = typeof mockConversations[number];
