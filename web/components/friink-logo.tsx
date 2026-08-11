export function FriinkLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`friink-logo ${className}`.trim()} aria-label="Friink">
      i<span>i</span>
    </span>
  );
}
