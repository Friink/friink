type CountPillProps = {
  count: number;
};

export function CountPill({ count }: CountPillProps) {
  if (count <= 0) return null;

  const label = count > 9 ? '9+' : String(count);

  return <span className="count-pill" aria-hidden="true">{label}</span>;
}
