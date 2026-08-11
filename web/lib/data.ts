export type Post = {
  id: number;
  name: string;
  handle: string;
  initials: string;
  tone: string;
  date: string;
  text: string;
  replies: number;
  reactions: number;
};

export type Screen = 'home' | 'post';

export type NavItem = {
  id: Screen;
  label: string;
  icon: string;
};

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'post', label: 'Post', icon: 'fa-solid fa-pen' },
];

export const initialPosts: Post[] = [
  {
    id: 1,
    name: 'Maya Chen',
    handle: '@mayachen',
    initials: 'MC',
    tone: 'coral',
    date: '19 Mar 2024',
    text: 'Finally booked the little cabin by the lake. A quiet weekend is exactly what I needed.',
    replies: 8,
    reactions: 24,
  },
  {
    id: 2,
    name: 'Jon Bell',
    handle: '@jonbell',
    initials: 'JB',
    tone: 'sage',
    date: '18 Mar 2024',
    text: 'Does anyone have a great recommendation for a beginner-friendly ceramics class?',
    replies: 14,
    reactions: 11,
  },
  {
    id: 3,
    name: 'Priya Shah',
    handle: '@priyashah',
    initials: 'PS',
    tone: 'sun',
    date: '17 Mar 2024',
    text: 'The best conversations happen when nobody is rushing to the next thing.',
    replies: 5,
    reactions: 36,
  },
];

export const currentUser = {
  name: 'Alex Morgan',
  handle: '@alexmorgan',
  initials: 'AM',
  tone: 'mint',
};
