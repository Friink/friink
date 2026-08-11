export function FriinkLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`friink-logo ${className}`.trim()} aria-label="Friink">
      <img src="/brand/logoBlack.svg" alt="" />
    </span>
  );
}
