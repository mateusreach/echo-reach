/** Calendar-day geometry, independent of timezone/DST and of the data source. */
const DAY = 86_400_000;
const ordinal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

export function monthScale(year: number, month: number) {
  const start = Date.UTC(year, month, 1) / DAY;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clamp = (n: number) => Math.max(0, Math.min(days, n));
  return {
    days,
    /** Inclusive approved-through date. */
    covered: (iso?: string | null) => (iso ? (clamp(ordinal(iso) - start + 1) / days) * 100 : 0),
    /** Inclusive interval, clipped to this month. Null when fully outside it. */
    interval: (from: string, to: string) => {
      const left = clamp(ordinal(from) - start);
      const right = clamp(ordinal(to) - start + 1);
      return right > left
        ? { left: (left / days) * 100, width: ((right - left) / days) * 100 }
        : null;
    },
    /** Center of the actual day. Never clamps an off-screen milestone to an edge. */
    marker: (iso?: string | null) => {
      if (!iso) return null;
      const offset = ordinal(iso) - start;
      return offset >= 0 && offset < days ? ((offset + 0.5) / days) * 100 : null;
    },
  };
}
