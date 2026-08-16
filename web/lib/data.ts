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
  {
    id: 4,
    name: 'Alina Ross',
    handle: '@alinaross',
    initials: 'AR',
    tone: 'coral',
    date: '16 Mar 2024',
    text: 'I keep a tiny notebook in my bag for weird ideas that should become rituals.',
    connectionType: 'followers',
    isConnection: true,
    isStarred: false,
    replies: 9,
    reactions: 18,
  },
  {
    id: 5,
    name: 'Leo Park',
    handle: '@leopark',
    initials: 'LP',
    tone: 'mint',
    date: '15 Mar 2024',
    text: 'The best day starts with sunlight on the kitchen counter and a long walk with no plan.',
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
    replies: 12,
    reactions: 29,
  },
  {
    id: 6,
    name: 'Nia Patel',
    handle: '@niapatel',
    initials: 'NP',
    tone: 'sun',
    date: '14 Mar 2024',
    text: 'Still thinking about the conversation where someone said “slow living” was a radical act.',
    connectionType: 'followers',
    isConnection: false,
    isStarred: true,
    replies: 7,
    reactions: 21,
  },
  {
    id: 7,
    name: 'Omar Ali',
    handle: '@omarali',
    initials: 'OA',
    tone: 'sage',
    date: '13 Mar 2024',
    text: 'Small habits really do create the shape of a whole life over time.',
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
    replies: 11,
    reactions: 26,
  },
  {
    id: 8,
    name: 'Sara Kim',
    handle: '@sarakim',
    initials: 'SK',
    tone: 'coral',
    date: '12 Mar 2024',
    text: 'Would love to hear what “good rest” looks like for people on busy weeks.',
    connectionType: 'followers',
    isConnection: false,
    isStarred: false,
    replies: 6,
    reactions: 15,
  },
  {
    id: 9,
    name: 'Theo Grant',
    handle: '@theogrant',
    initials: 'TG',
    tone: 'mint',
    date: '11 Mar 2024',
    text: 'A plain table, decent coffee, and a conversation that lasts way longer than planned.',
    connectionType: 'following',
    isConnection: true,
    isStarred: true,
    replies: 13,
    reactions: 31,
  },
  {
    id: 10,
    name: 'Rita Gomez',
    handle: '@ritagomez',
    initials: 'RG',
    tone: 'sun',
    date: '10 Mar 2024',
    text: 'This week I’m trying to say yes to the things that feel warm instead of urgent.',
    connectionType: 'followers',
    isConnection: true,
    isStarred: false,
    replies: 8,
    reactions: 23,
  },
  {
    id: 11,
    name: 'Dev Carter',
    handle: '@devcarter',
    initials: 'DC',
    tone: 'sage',
    date: '9 Mar 2024',
    text: 'The most useful tiny change this month was making one part of my evenings slower.',
    connectionType: 'following',
    isConnection: false,
    isStarred: false,
    replies: 10,
    reactions: 20,
  },
  {
    id: 12,
    name: 'Iris Chen',
    handle: '@irischen',
    initials: 'IC',
    tone: 'coral',
    date: '8 Mar 2024',
    text: 'I’ve been collecting places where I can just sit and watch the world for a while.',
    connectionType: 'followers',
    isConnection: true,
    isStarred: true,
    replies: 15,
    reactions: 34,
  },
  {
    id: 13,
    name: 'Noah Lee',
    handle: '@noahlee',
    initials: 'NL',
    tone: 'mint',
    date: '7 Mar 2024',
    text: 'As long as I keep learning the language of patience, everything seems more possible.',
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
    replies: 9,
    reactions: 19,
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
