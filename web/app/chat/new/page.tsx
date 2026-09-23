import { permanentRedirect } from 'next/navigation';

export default function NewChatCompatibilityPage() {
  permanentRedirect('/chats/new');
}
