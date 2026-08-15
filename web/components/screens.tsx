import React, { useState } from 'react';
import { navItems } from '@/lib/data';

function ScreenHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="screen-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{copy}</p></div>;
}

export function QuestionsScreen() {
  return <><ScreenHeading eyebrow="Ask your people" title="Questions" copy="Small questions are a good way to start a conversation." /><div className="question-prompt"><span className="prompt-spark">✦</span><div><strong>What are you curious about?</strong><p>Ask your circle anything, big or small.</p></div><button className="primary-button">Ask a question</button></div><div className="section-heading"><h2>Recent questions</h2><button className="text-button">See all <span>→</span></button></div><div className="question-list"><div className="question-card"><div className="question-meta"><span className="avatar avatar-coral">MC</span><span><strong>Maya Chen</strong> asked <small>25 min ago</small></span></div><p>What is one place you would return to in a heartbeat?</p><div className="question-footer"><span>12 answers</span><button className="text-button">Answer →</button></div></div><div className="question-card"><div className="question-meta"><span className="avatar avatar-sage">JB</span><span><strong>Jon Bell</strong> asked <small>1 hr ago</small></span></div><p>What are you listening to on repeat this week?</p><div className="question-footer"><span>7 answers</span><button className="text-button">Answer →</button></div></div></div></>;
}

export function MessagesScreen() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState([
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
        { id: 2, from: 'me', text: 'That sounds perfect. I\'ll send you the address!', time: '10:42 AM' },
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
  ]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversation) return;

    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id
      ? { ...conversation, preview: text, time: 'Just now', messages: [...conversation.messages, { id: Date.now(), from: 'me', text, time: 'Just now' }] }
      : conversation));
    setDraft('');
  }

  if (activeConversation) {
    return (
      <section className="messages-screen chat-screen">
        <div className="chat-header">
          <button className="icon-plain" type="button" onClick={() => setActiveConversationId(null)} aria-label="Back to messages">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <span className={`user-avatar avatar-${activeConversation.tone}`}>{activeConversation.initials}</span>
          <div className="chat-contact">
            <strong>{activeConversation.name}</strong>
            <span>{activeConversation.handle}</span>
          </div>
          <button className="icon-plain chat-more" type="button" aria-label="Conversation options">
            <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
          </button>
        </div>
        <div className="chat-messages">
          <p className="chat-date">Today</p>
          {activeConversation.messages.map((message) => (
            <div className={`chat-bubble-row ${message.from === 'me' ? 'mine' : ''}`} key={message.id}>
              <div className="chat-bubble">
                <p>{message.text}</p>
                <small>{message.time}</small>
              </div>
            </div>
          ))}
        </div>
        <form className="chat-composer" onSubmit={sendMessage}>
          <button className="icon-plain" type="button" aria-label="Attach file">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Message" />
          <button className="chat-send" type="submit" disabled={!draft.trim()} aria-label="Send message">
            <i className="fa-solid fa-arrow-up" aria-hidden="true" />
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="messages-screen">
      <div className="messages-toolbar">
        <h1>Messages</h1>
        <button className="icon-plain" type="button" aria-label="New message">
          <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
        </button>
      </div>
      <label className="message-search">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input placeholder="Search conversations" aria-label="Search conversations" />
      </label>
      <div className="message-list">
        {conversations.map((conversation) => (
          <button
            className={`message-row${conversation.unread ? ' unread' : ''}`}
            key={conversation.id}
            type="button"
            onClick={() => setActiveConversationId(conversation.id)}
          >
            <span className={`user-avatar avatar-${conversation.tone}`}>{conversation.initials}</span>
            <span className="message-row-copy">
              <span className="message-title"><strong>{conversation.name}</strong><small>{conversation.time}</small></span>
              <span className="message-preview">{conversation.preview}</span>
            </span>
            {conversation.unread && <span className="unread-dot" />}
          </button>
        ))}
      </div>
    </section>
  );
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
