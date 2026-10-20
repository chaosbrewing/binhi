export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo ${compact ? "logo-compact" : ""}`} aria-label="BINHI">
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--accent)" />
        <path d="M32 50c0-14 6-24 20-30-2 14-8 24-20 30Zm0 0c0-10-5-18-16-22 2 10 7 18 16 22Z" fill="#dff7e8" />
        <path d="M32 50V30" stroke="#dff7e8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!compact && <span className="logo-word">BINHI</span>}
    </span>
  );
}
