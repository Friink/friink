const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeOfDayFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function toValidDate(timestamp: string | Date): Date | null {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameLocalCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatRelativeTime(timestamp: string | Date): string {
  const date = toValidDate(timestamp);
  if (!date) {
    return '';
  }

  const now = new Date();
  if (!isSameLocalCalendarDay(date, now)) {
    return fullDateFormatter.format(date);
  }

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }

  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m`;
  }

  return timeOfDayFormatter.format(date);
}
