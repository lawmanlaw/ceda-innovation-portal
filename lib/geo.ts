import { REGIONS, TOWNS, LNG0, LAT0, COS } from '@/lib/bw-map';

// Location facts worked out from an idea's pin, using the census district outlines in bw-map.ts.

export const project = (lat: number, lng: number) => ({ x: (lng - LNG0) * 100 * COS, y: (LAT0 - lat) * 100 });

// CEDA branch offices (town-centre coordinates)
export const CEDA_OFFICES: { name: string; lat: number; lng: number }[] = [
  { name: 'Gaborone (head office)', lat: -24.6545, lng: 25.9086 },
  { name: 'Francistown', lat: -21.17, lng: 27.508 },
  { name: 'Selebi-Phikwe', lat: -21.979, lng: 27.842 },
  { name: 'Molepolole', lat: -24.4067, lng: 25.495 },
  { name: 'Kanye', lat: -24.9667, lng: 25.3333 },
  { name: 'Ghanzi', lat: -21.697, lng: 21.645 },
  { name: 'Kasane', lat: -17.803, lng: 25.152 },
  { name: 'Letlhakane', lat: -21.417, lng: 25.59 },
  { name: 'Palapye', lat: -22.546, lng: 27.125 },
  { name: 'Maun', lat: -19.983, lng: 23.42 },
  { name: 'Hukuntsi', lat: -23.998, lng: 21.783 },
  { name: 'Shakawe', lat: -18.36, lng: 21.842 },
];

export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Even-odd point in polygon over every ring of an SVG path made of M/L/Z commands
function inside(d: string, x: number, y: number) {
  let hit = false;
  for (const ring of d.split('M').filter(Boolean)) {
    const pts = ring.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number));
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

export type LocationFacts = { district: string; urban: boolean; population: number; office: string; officeKm: number };

export function locationFacts(lat: number, lng: number): LocationFacts | null {
  const { x, y } = project(lat, lng);
  const town = TOWNS.find((t) => inside(t.d, x, y));
  const region = town ? null : REGIONS.find((r) => inside(r.d, x, y));
  const area = town ?? region;
  if (!area) return null;
  const near = CEDA_OFFICES.map((o) => ({ ...o, d: km(lat, lng, o.lat, o.lng) })).sort((a, b) => a.d - b.d)[0];
  return { district: area.name, urban: Boolean(town), population: area.pop, office: near.name, officeKm: Math.round(near.d) };
}

// A representative point for a district or town, for "near me" when only the profile district is known
export function districtPoint(name: string | null | undefined): { lat: number; lng: number } | null {
  const t = TOWNS.find((x) => x.name === name);
  const r = REGIONS.find((x) => x.name === name);
  const p = t ? { x: t.x, y: t.y } : r ? { x: r.lx, y: r.ly } : null;
  return p ? { lat: LAT0 - p.y / 100, lng: p.x / (100 * COS) + LNG0 } : null;
}
