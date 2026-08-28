export type Post = {
  id: string;
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
  quotedPost?: {
    id: string | null;
    authorUsername: string | null;
    content: string;
    unavailable: boolean;
  } | null;
};

export type Screen = 'home' | 'profile' | 'connections' | 'starred' | 'search' | 'messages' | 'notifications' | 'settings' | 'floating';

export type NavItem = {
  id: Screen;
  label: string;
  icon: string;
};

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'connections', label: 'Connections', icon: 'fa-solid fa-users' },
  { id: 'search', label: 'Search', icon: 'fa-solid fa-magnifying-glass' },
  { id: 'messages', label: 'Chat', icon: 'fa-solid fa-envelope' },
];

export const sidebarNavItems: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: 'fa-solid fa-user' },
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'connections', label: 'Connections', icon: 'fa-solid fa-user-group' },
  { id: 'messages', label: 'Chat', icon: 'fa-solid fa-envelope' },
  { id: 'starred', label: 'Starred', icon: 'fa-solid fa-star' },
];

export const initialPosts: Post[] = [];

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

export type ConnectionRequest = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  status: 'pending';
  createdAt: string;
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
