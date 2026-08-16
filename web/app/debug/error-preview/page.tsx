"use client";

import GlobalError from '@/app/error';

export default function ErrorPreview() {
  return (
    <GlobalError
      error={{ message: 'Preview: simulated error', digest: '500' }}
      reset={() => window.location.reload()}
    />
  );
}
