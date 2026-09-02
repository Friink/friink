import Link from 'next/link';
import type { ReactNode } from 'react';

const mentionPattern = /(^|[^A-Za-z0-9_@])(@[A-Za-z0-9][A-Za-z0-9._-]{0,63})/g;

type MentionTextProps = {
  children: string;
};

export function MentionText({ children }: MentionTextProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of children.matchAll(mentionPattern)) {
    const fullMatch = match[0];
    const prefix = match[1] || '';
    const mention = match[2];
    const matchStart = match.index ?? 0;
    const mentionStart = matchStart + prefix.length;

    if (mentionStart > lastIndex) {
      parts.push(children.slice(lastIndex, mentionStart));
    }
    parts.push(
      <Link className="mention-link" key={`${mentionStart}-${mention}`} href={`/${encodeURIComponent(mention.slice(1))}`}>
        {mention}
      </Link>,
    );
    lastIndex = mentionStart + mention.length;

    if (!fullMatch) break;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  return <>{parts}</>;
}
