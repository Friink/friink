export type Post = {
  id: number;
  name: string;
  handle: string;
  initials: string;
  tone: string;
  date: string;
  text: string;
  connectionType: 'followers' | 'following';
  isConnection: boolean;
  isStarred: boolean;
  replies: number;
  reactions: number;
};

export type Screen = 'home' | 'profile' | 'connections' | 'starred' | 'post' | 'search' | 'messages' | 'settings' | 'floating';

export type NavItem = {
  id: Screen;
  label: string;
  icon: string;
};

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'connections', label: 'Connections', icon: 'fa-solid fa-users' },
  { id: 'post', label: 'Post', icon: 'fa-solid fa-pen' },
  { id: 'search', label: 'Search', icon: 'fa-solid fa-magnifying-glass' },
  { id: 'messages', label: 'Messages', icon: 'fa-solid fa-envelope' },
];

export const sidebarNavItems: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: 'fa-solid fa-user' },
  { id: 'connections', label: 'Connections', icon: 'fa-solid fa-user-group' },
  { id: 'starred', label: 'Starred', icon: 'fa-solid fa-star' },
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
    connectionType: 'followers',
    isConnection: true,
    isStarred: true,
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
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
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
    connectionType: 'following',
    isConnection: false,
    isStarred: true,
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

export type Connection = {
  id: number;
  name: string;
  handle: string;
  initials: string;
  tone: string;
  relationship: 'follower' | 'following' | 'mutual';
  status: 'connected' | 'request';
};

export const initialConnections: Connection[] = [
  {
    id: 1,
    name: 'Maya Chen',
    handle: '@mayachen',
    initials: 'MC',
    tone: 'coral',
    relationship: 'mutual',
    status: 'connected',
  },
  {
    id: 2,
    name: 'Jon Bell',
    handle: '@jonbell',
    initials: 'JB',
    tone: 'sage',
    relationship: 'following',
    status: 'connected',
  },
  {
    id: 3,
    name: 'Priya Shah',
    handle: '@priyashah',
    initials: 'PS',
    tone: 'sun',
    relationship: 'follower',
    status: 'connected',
  },
  {
    id: 4,
    name: 'Alina Ross',
    handle: '@alinaross',
    initials: 'AR',
    tone: 'coral',
    relationship: 'follower',
    status: 'request',
  },
];
