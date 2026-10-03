import fs from 'node:fs';
import { createRequire } from 'node:module';
import { geoContains, geoDistance } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { ISO3 } from './iso.ts';

const EARTH_KM = 6371;
/** A point at sea counts as "in" the country within this distance of its outline (coastal cities, 1:50m simplification). */
const SEA_TOLERANCE_KM = 75;
/** A point inside a neighbouring country is accepted this close to the border (e.g. Shenzhen vs Hong Kong). */
const BORDER_TOLERANCE_KM = 25;

type CountryFeature = Feature<Polygon | MultiPolygon>;

let countries: CountryFeature[] | null = null;
/** Several features can share one ISO numeric id (e.g. Australia and its external territories). */
let byNumeric: Map<number, CountryFeature[]> | null = null;

function load() {
  if (countries) return;
  const require = createRequire(import.meta.url);
  const topo = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as Topology;
  const fc = feature(topo, topo.objects.countries as GeometryCollection);
  countries = fc.features as CountryFeature[];
  byNumeric = new Map();
  for (const f of countries) {
    const id = Number(f.id);
    byNumeric.set(id, [...(byNumeric.get(id) ?? []), f]);
  }
}

function distanceToOutlineKm(f: CountryFeature, p: [number, number]): number {
  const rings: Position[][] = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
  let min = Infinity;
  for (const ring of rings) for (const v of ring) min = Math.min(min, geoDistance(p, v as [number, number]));
  return min * EARTH_KM;
}

export type CoordCheck = 'inside' | 'near' | 'wrong' | 'unknown-country';

/** Is (lat, lng) plausibly located in the given ISO 3166-1 alpha-3 country? */
export function checkCountry(lat: number, lng: number, iso3: string | null): CoordCheck {
  load();
  const num = iso3 ? ISO3[iso3]?.[1] : undefined;
  const parts = num !== undefined ? byNumeric!.get(num) : undefined;
  if (!parts) return 'unknown-country';
  const p: [number, number] = [lng, lat];
  if (parts.some((f) => geoContains(f, p))) return 'inside';
  const other = countries!.find((c) => !parts.includes(c) && geoContains(c, p));
  const dist = Math.min(...parts.map((f) => distanceToOutlineKm(f, p)));
  return dist <= (other ? BORDER_TOLERANCE_KM : SEA_TOLERANCE_KM) ? 'near' : 'wrong';
}
