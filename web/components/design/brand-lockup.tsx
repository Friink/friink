type BrandLockupProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function BrandLockup({ className = '', size = 'md' }: BrandLockupProps) {
  return (
    <div className={`brand-lockup brand-lockup-${size} ${className}`.trim()} aria-label="Friink">
      <img className="brand-lockup-wordmark" src="/brand/logoFullBrand.svg" alt="Friink" />
    </div>
  );
}
