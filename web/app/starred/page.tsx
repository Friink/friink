import { redirect } from 'next/navigation';

export default function LegacyStarredPage() {
  redirect('/saved/posts');
}
