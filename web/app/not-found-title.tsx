'use client';

import { useEffect } from 'react';

export function NotFoundTitle() {
  useEffect(() => {
    document.title = 'Friink | Error (404)';
  }, []);

  return null;
}
