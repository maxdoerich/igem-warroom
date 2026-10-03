const nf = new Intl.NumberFormat('en-US');

export const fmtInt = (n: number) => nf.format(n);

export function fmtCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export function fmtAgo(t: number | null, now = Date.now()): string {
  if (!t) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'FROZEN';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function fmtUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

export const REGION_LABEL: Record<string, string> = {
  europe: 'Europe',
  'north-america': 'N. America',
  'latin-america': 'Latin America',
  'asia-pacific': 'Asia-Pacific',
  africa: 'Africa',
  asia: 'Asia',
  'middle-east': 'Middle East',
  oceania: 'Oceania',
};

export const regionLabel = (r: string | null) => (r ? (REGION_LABEL[r] ?? r) : '—');

export const SECTION_LABEL: Record<string, string> = {
  'high-school': 'High school',
  undergrad: 'Undergrad',
  overgrad: 'Overgrad',
};

export const sectionLabel = (s: string | null) => (s ? (SECTION_LABEL[s] ?? s) : 'Other');
