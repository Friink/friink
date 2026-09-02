import { permanentRedirect } from 'next/navigation';

export default function AppHomePage() {
  permanentRedirect('/home/explore');
}
