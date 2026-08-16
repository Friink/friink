"use client";

import GlobalError from '@/app/error';

export default function ErrorPreview() {
  const error = new Error('Preview: simulated error') as Error & { digest?: string };
  error.digest = '500';

  return <GlobalError error={error} reset={() => window.location.reload()} />;
}
