export function SparkMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="SPARK Logo"
      data-testid="img-logo-mark"
    >
      <path
        d="M16 1.5c1.4 7.2 7.3 13.1 14.5 14.5C23.3 17.4 17.4 23.3 16 30.5 14.6 23.3 8.7 17.4 1.5 16 8.7 14.6 14.6 8.7 16 1.5Z"
        fill="currentColor"
      />
      <path
        d="M24.6 3.4c.5 2.6 2.6 4.7 5.2 5.2-2.6.5-4.7 2.6-5.2 5.2-.5-2.6-2.6-4.7-5.2-5.2 2.6-.5 4.7-2.6 5.2-5.2Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export function SparkLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2" data-testid="link-logo">
      <span className="text-primary">
        <SparkMark size={compact ? 22 : 26} />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight leading-none">
          SPARK
        </span>
      )}
    </span>
  );
}
