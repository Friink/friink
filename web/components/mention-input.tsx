"use client";

import { useEffect, useRef } from 'react';
import { getPublicUser } from '@/lib/auth';

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  maxLength?: number;
  multiline?: boolean;
};

function textOffset(root: HTMLElement, container: Node, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === container) return total + offset;
    total += node.textContent?.length ?? 0;
  }
  return total;
}

function setTextRange(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startOffset = 0;
  let endOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (!startNode && start >= total && start <= total + length) {
      startNode = node;
      startOffset = start - total;
    }
    if (end >= total && end <= total + length) {
      endNode = node;
      endOffset = end - total;
      break;
    }
    total += length;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function MentionInput({ value, onChange, placeholder, ariaLabel, disabled = false, maxLength, multiline = true }: MentionInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastValueRef.current) return;
    if (editor.textContent !== value) editor.textContent = value;
    lastValueRef.current = value;
  }, [value]);

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.querySelectorAll<HTMLElement>('.composer-mention-token').forEach((token) => {
      const username = token.dataset.username;
      const label = token.querySelector('.composer-mention-label')?.textContent;
      if (!username || label === `@${username}`) return;
      token.replaceWith(document.createTextNode(label || ''));
    });

    const nextValue = editor.textContent ?? '';
    if (!nextValue) editor.blur();
    if (typeof maxLength === 'number' && nextValue.length > maxLength) {
      editor.textContent = nextValue.slice(0, maxLength);
      lastValueRef.current = editor.textContent;
      onChange(editor.textContent);
      return;
    }
    lastValueRef.current = nextValue;
    onChange(nextValue);
  }

  async function resolveMentionBeforeSpace() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const caretOffset = textOffset(editor, range.endContainer, range.endOffset);
    const beforeCaret = (editor.textContent ?? '').slice(0, caretOffset);
    const match = beforeCaret.match(/(^|\s)@([A-Za-z0-9][A-Za-z0-9._-]{0,63})$/);
    if (!match) return;

    const username = match[2];
    const mentionStart = caretOffset - username.length - 1;
    try {
      const user = await getPublicUser(username);
      const mentionRange = setTextRange(editor, mentionStart, caretOffset);
      if (!mentionRange || !editor.isConnected) return;

      const token = document.createElement('span');
      token.className = 'composer-mention-token';
      token.dataset.username = user.username;
      token.contentEditable = 'true';

      const image = document.createElement('img');
      image.className = 'composer-mention-avatar';
      image.src = user.profilePictureUrl || '/media/profile.jpg';
      image.alt = '';
      image.contentEditable = 'false';

      const label = document.createElement('span');
      label.className = 'composer-mention-label';
      label.textContent = `@${user.username}`;
      label.contentEditable = 'true';

      token.append(image, label);
      mentionRange.deleteContents();
      mentionRange.insertNode(token);
      mentionRange.setStartAfter(token);
      mentionRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(mentionRange);
      handleInput();
    } catch {
      // Unknown usernames remain ordinary editable text and will not notify anyone.
    }
  }

  return (
    <div
      ref={editorRef}
      className={`composer-mention-editor${multiline ? '' : ' composer-mention-editor-single-line'}`}
      contentEditable={!disabled}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline}
      data-placeholder={placeholder}
      data-empty={value.length === 0 ? 'true' : 'false'}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={(event) => {
        if (event.key === ' ') void resolveMentionBeforeSpace();
      }}
    />
  );
}
