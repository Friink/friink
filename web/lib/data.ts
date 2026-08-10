export type Post = {
  id: number;
  name: string;
  initials: string;
  tone: string;
  time: string;
  text: string;
  tags: string[];
  replies: number;
  reactions: number;
};

export const posts: Post[] = [
  {
    id: 1,
    name: 'Maya Chen',
    initials: 'MC',
    tone: 'coral',
    time: '12 min ago',
    text: 'Finally booked the little cabin by the lake. A quiet weekend is exactly what I needed.',
    tags: ['slow weekend', 'plans'],
    replies: 8,
    reactions: 24,
  },
  {
    id: 2,
    name: 'Jon Bell',
    initials: 'JB',
    tone: 'sage',
    time: '48 min ago',
    text: 'Does anyone have a great recommendation for a beginner-friendly ceramics class?',
    tags: ['recommendation'],
    replies: 14,
    reactions: 11,
  },
  {
    id: 3,
    name: 'Priya Shah',
    initials: 'PS',
    tone: 'sun',
    time: '2 hrs ago',
    text: 'The best conversations happen when nobody is rushing to the next thing.',
    tags: ['thoughts'],
    replies: 5,
    reactions: 36,
  },
];

export const navItems = [
  { label: 'Home', icon: '⌂' },
  { label: 'Questions', icon: '?' },
  { label: 'Messages', icon: '◌', count: 3 },
  { label: 'Calendar', icon: '□' },
  { label: 'Directory', icon: '⌕' },
];
