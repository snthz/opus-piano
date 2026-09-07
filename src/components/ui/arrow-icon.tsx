export function ArrowIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronIcon({ className = "w-5 h-5", dir = "right" }: { className?: string; dir?: "left" | "right" | "down" | "up" }) {
  const d = dir === "left" ? "m14 6-6 6 6 6" : dir === "down" ? "m6 9 6 6 6-6" : dir === "up" ? "m6 15 6-6 6 6" : "m10 6 6 6-6 6";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
