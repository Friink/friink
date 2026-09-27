import { permanentRedirect } from 'next/navigation';

export default function SubscriptionsPage() {
  permanentRedirect('/settings/subscription');
}
