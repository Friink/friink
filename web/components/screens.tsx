import { navItems } from '@/lib/data';

function ScreenHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="screen-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{copy}</p></div>;
}

export function QuestionsScreen() {
  return <><ScreenHeading eyebrow="Ask your people" title="Questions" copy="Small questions are a good way to start a conversation." /><div className="question-prompt"><span className="prompt-spark">✦</span><div><strong>What are you curious about?</strong><p>Ask your circle anything, big or small.</p></div><button className="primary-button">Ask a question</button></div><div className="section-heading"><h2>Recent questions</h2><button className="text-button">See all <span>→</span></button></div><div className="question-list"><div className="question-card"><div className="question-meta"><span className="avatar avatar-coral">MC</span><span><strong>Maya Chen</strong> asked <small>25 min ago</small></span></div><p>What is one place you would return to in a heartbeat?</p><div className="question-footer"><span>12 answers</span><button className="text-button">Answer →</button></div></div><div className="question-card"><div className="question-meta"><span className="avatar avatar-sage">JB</span><span><strong>Jon Bell</strong> asked <small>1 hr ago</small></span></div><p>What are you listening to on repeat this week?</p><div className="question-footer"><span>7 answers</span><button className="text-button">Answer →</button></div></div></div></>;
}

export function MessagesScreen() {
  return <><ScreenHeading eyebrow="Stay close" title="Messages" copy="Your conversations, collected in one calm place." /><div className="message-search">⌕ <span>Search conversations</span></div><div className="message-list"><div className="message-row unread"><span className="avatar avatar-coral">MC</span><div><div className="message-title"><strong>Maya Chen</strong><small>10:42 AM</small></div><p>That sounds perfect. I&apos;ll send you the address!</p></div><span className="unread-dot" /></div><div className="message-row"><span className="avatar avatar-sage">JB</span><div><div className="message-title"><strong>Jon Bell</strong><small>Yesterday</small></div><p>Thanks for the ceramics recommendation.</p></div></div><div className="message-row"><span className="avatar avatar-sun">PS</span><div><div className="message-title"><strong>Priya Shah</strong><small>Mon</small></div><p>Are we still on for Thursday?</p></div></div></div></>;
}

export function SearchScreen() {
  return <><ScreenHeading eyebrow="Find your people" title="Search" copy="Look through your Friink space." /><div className="message-search">⌕ <span>Search Friink</span></div></>;
}

export function CalendarScreen() {
  return <><ScreenHeading eyebrow="Make time" title="Calendar" copy="A gentle view of the moments you have planned." /><div className="calendar-top"><button className="icon-button">‹</button><strong>August 2026</strong><button className="icon-button">›</button></div><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((day, index) => <span className="calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: 31 }, (_, index) => <span className={`calendar-day${[5, 11, 17, 22].includes(index + 1) ? ' has-event' : ''}${index + 1 === 11 ? ' today' : ''}`} key={index}>{index + 1}</span>)}</div><div className="section-heading"><h2>Coming up</h2><button className="primary-button">＋ Add event</button></div><div className="event-list"><div className="event-row"><span className="event-date">17<span>MON</span></span><div><strong>Sunday market</strong><small>10:00 AM · With Maya</small></div><span className="event-dot coral-dot" /></div><div className="event-row"><span className="event-date">22<span>SAT</span></span><div><strong>Dinner at Luma</strong><small>7:30 PM · With your circle</small></div><span className="event-dot green-dot" /></div></div></>;
}

export function DirectoryScreen() {
  return <><ScreenHeading eyebrow="Your people" title="Directory" copy="Everyone you care about, easy to find." /><div className="message-search">⌕ <span>Search your directory</span></div><div className="directory-section"><p className="directory-label">A · 2 people</p><div className="directory-row"><span className="avatar avatar-mint">AM</span><div><strong>Alex Morgan</strong><small>You · 34 connections</small></div><button className="icon-button">···</button></div><div className="directory-row"><span className="avatar avatar-coral">AL</span><div><strong>Alina Ross</strong><small>12 shared connections</small></div><button className="icon-button">···</button></div></div><div className="directory-section"><p className="directory-label">J · 1 person</p><div className="directory-row"><span className="avatar avatar-sage">JB</span><div><strong>Jon Bell</strong><small>8 shared connections</small></div><button className="icon-button">···</button></div></div></>;
}

export function ScreenForNav({ activeNav }: { activeNav: string }) {
  if (activeNav === 'Questions') return <QuestionsScreen />;
  if (activeNav === 'Messages') return <MessagesScreen />;
  if (activeNav === 'Calendar') return <CalendarScreen />;
  if (activeNav === 'Directory') return <DirectoryScreen />;
  return null;
}

export function MobileNav() {
  return navItems.slice(0, 4).map((item) => <span key={item.label}>{item.label}</span>);
}
