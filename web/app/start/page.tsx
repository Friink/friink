import type { Metadata } from 'next';
import { StartClient } from './start-client';

export const metadata: Metadata = {
  title: 'Friink | Get started',
};

export default function StartPage() {
  return <StartClient />;
}
