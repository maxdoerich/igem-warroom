import { db } from '../db/db.ts';
import { sleep } from '../sources/http.ts';
import { ISO3 } from './iso.ts';
import { checkCountry } from './validate.ts';

/**
 * Fallback geocoding for teams the iGEM registry gives no usable coordinates
 * (null, or the 0,0 "Null Island" placeholder). Uses OpenStreetMap Nominatim,
 * respecting its policy: identifying User-Agent, ≤1 request/s, results cached forever.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'igem-warroom/0.1 (local dashboard; https://github.com/tkreusel/igem-warroom)';
const MIN_INTERVAL_MS = 1100;

db.exec(`
CREATE TABLE IF NOT EXISTS geocode_cache (
  query      TEXT PRIMARY KEY,          -- "<iso2>|<free text>"
  lat        REAL,                      -- NULL = no result
  lng        REAL,
  label      TEXT,
  fetched_at INTEGER NOT NULL
);`);

export function hasValidCoords(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return false; // Null Island placeholder
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Present, not a placeholder, and actually in (or right next to) the team's country. */
export function usableCoords(lat: number | null, lng: number | null, iso3: string | null): boolean {
  return hasValidCoords(lat, lng) && checkCountry(lat!, lng!, iso3) !== 'wrong';
}

let lastRequest = 0;

async function lookup(text: string, iso2: string | undefined): Promise<{ lat: number; lng: number } | null> {
  const key = `${iso2 ?? ''}|${text}`;
  const cached = db.prepare('SELECT lat, lng FROM geocode_cache WHERE query = ?').get(key) as
    | { lat: number | null; lng: number | null }
    | undefined;
  if (cached) return cached.lat !== null && cached.lng !== null ? { lat: cached.lat, lng: cached.lng } : null;

  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const url = new URL(NOMINATIM);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', text);
  if (iso2) url.searchParams.set('countrycodes', iso2.toLowerCase());
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = hits[0];
  db.prepare('INSERT OR REPLACE INTO geocode_cache (query, lat, lng, label, fetched_at) VALUES (?, ?, ?, ?, ?)').run(
    key,
    hit ? Number(hit.lat) : null,
    hit ? Number(hit.lon) : null,
    hit?.display_name ?? null,
    Date.now(),
  );
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

/** "Chennai 602105" → "Chennai"; "Qingdao, Shandong Province" stays as is. */
const cleanCity = (city: string) => city.replace(/\b\d{4,}\b/g, '').replace(/\s+/g, ' ').trim();

interface MissingRow {
  id: number;
  name: string;
  institution: string | null;
  city: string | null;
  country: string | null;
}

/** Fill coordinates for teams lacking them: institution first (precise), then city (approximate). */
export async function fillMissingCoordinates(log: (msg: string) => void = console.log) {
  const rows = (
    db.prepare('SELECT id, name, institution, city, country, lat, lng FROM teams').all() as unknown as (MissingRow & {
      lat: number | null;
      lng: number | null;
    })[]
  ).filter((r) => !usableCoords(r.lat, r.lng, r.country));
  if (!rows.length) return { fixed: 0, failed: [] as string[] };
  log(`[geo] ${rows.length} teams without usable registry coordinates; geocoding…`);

  const update = db.prepare('UPDATE teams SET lat = ?, lng = ?, coord_source = ? WHERE id = ?');
  const clear = db.prepare("UPDATE teams SET lat = NULL, lng = NULL, coord_source = 'missing' WHERE id = ?");
  const failed: string[] = [];
  let fixed = 0;
  for (const r of rows) {
    const iso2 = r.country ? ISO3[r.country]?.[0] : undefined;
    const city = r.city ? cleanCity(r.city) : null;
    // [query, precision, restrict to country code]. The unrestricted last resort covers places OSM files
    // under another country code (e.g. Hong Kong); every hit is checked against the country outline anyway.
    const attempts: [string, 'institution' | 'city', boolean][] = [];
    if (r.institution && city) attempts.push([`${r.institution}, ${city}`, 'institution', true]);
    if (r.institution) attempts.push([r.institution, 'institution', true]);
    if (city) attempts.push([city, 'city', true], [city, 'city', false]);

    let done = false;
    for (const [q, source, restrict] of attempts) {
      try {
        const hit = await lookup(q, restrict ? iso2 : undefined);
        if (hit && checkCountry(hit.lat, hit.lng, r.country) !== 'wrong') {
          update.run(hit.lat, hit.lng, source, r.id);
          fixed++;
          done = true;
          break;
        }
      } catch (err) {
        log(`[geo] lookup failed for ${r.name}: ${String(err)}`);
        break; // network trouble: retry on the next sync rather than hammering
      }
    }
    if (!done) {
      // Never leave 0,0 in place — an unplaceable team is better off the map than in the Atlantic.
      clear.run(r.id);
      failed.push(r.name);
    }
  }
  log(`[geo] placed ${fixed}/${rows.length} teams${failed.length ? `; unplaced: ${failed.join(', ')}` : ''}`);
  return { fixed, failed };
}
