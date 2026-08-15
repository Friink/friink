"use client";

import React, { useState } from 'react';
import type { Screen } from '@/lib/data';

type FooterProps = {
  activeScreen: Screen;
  onPost?: (text: string) => void;
  onSendMessage?: (text: string) => void;
};

export function Footer({ activeScreen, onPost, onSendMessage }: FooterProps) {
  const [message, setMessage] = useState('');
  const [postText, setPostText] = useState('');

  return (
    <footer className={`app-footer app-footer--${activeScreen}`} aria-hidden={false}>
      <div className="app-footer-bg" />

      {/* Default floating controls */}
      {activeScreen !== 'post' && activeScreen !== 'messages' && (
        <div className="footer-floating">
          <div className="footer-pill">
            <button className="icon-plain" aria-label="Create post">
              <i className="fa-solid fa-pen" />
            </button>
            <button className="icon-plain" aria-label="Search">
              <i className="fa-solid fa-magnifying-glass" />
            </button>
            <button className="icon-plain" aria-label="Notifications">
              <i className="fa-solid fa-bell" />
            </button>
          </div>
        </div>
      )}

      {/* Post composer actions (when composing a post) */}
      {activeScreen === 'post' && (
        <div className="footer-post-actions">
          <div className="footer-post-left">
            <button className="post-option" type="button" aria-label="Attach file">
              <i className="fa-solid fa-paperclip" />
            </button>
          </div>
          <div className="footer-post-right">
            <button className="post-option" type="button" aria-label="Post settings">
              <i className="fa-solid fa-gear" />
            </button>
            <button
              className="primary-button post-submit"
              type="button"
              onClick={() => {
                if (onPost && postText.trim()) {
                  onPost(postText.trim());
                  setPostText('');
                }
              }}
              disabled={!postText.trim()}
            >
              Post
            </button>
          </div>
        </div>
      )}

      {/* Chat composer has been reverted from the footer. The messages composer remains in `MessagesScreen`. */}
    </footer>
  );
}

export default Footer;
