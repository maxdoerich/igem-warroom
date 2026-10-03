/**
 * Sequential single-hue (amber) ramp for activity heat on the dark surface:
 * dim = quiet, bright = hot. One hue only, so it reads as magnitude, never category.
 */
const STOPS = ['#5c4318', '#8f6316', '#c98a1c', '#f2b13a', '#ffd88a', '#fff1d1'].map(hexToRgb);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** t in [0,1] → css rgb string along the amber ramp. */
export function heatColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Log-normalise heat against the current max so a single hyperactive team doesn't wash out the rest. */
export function heatScale(maxHeat: number) {
  const denom = Math.log1p(Math.max(maxHeat, 3));
  return (heat: number) => Math.log1p(heat) / denom;
}

export const HEAT_GRADIENT_CSS = `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(heatColor).join(', ')})`;

/** Marker radius (px at zoom 1) from total team commits; area ∝ commits. */
export function markerRadius(commits: number): number {
  return 2.5 + Math.sqrt(commits) * 0.45;
}
