import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet, fetchUpstream } from '@/lib/cache';
import type { GeoLocation } from '@/lib/weather';

export const dynamic = 'force-dynamic';

/**
 * GET /api/geocode?q=..
 * City search proxy for the Open-Meteo geocoding API, cached for 1 hour.
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const key = `geo:${query.toLowerCase()}`;
  const cached = cacheGet<{ results: GeoLocation[] }>(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=6&language=en&format=json`;

  try {
    const res = await fetchUpstream(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Search service unavailable.' }, { status: 502 });
    }
    const json = await res.json();
    const raw = Array.isArray(json.results) ? json.results : [];
    const results: GeoLocation[] = raw.map(
      (r: { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string }) => ({
        id: `g${r.id}`,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country,
        admin1: r.admin1,
      })
    );
    const payload = { results };
    cacheSet(key, payload, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Search service unavailable.' }, { status: 502 });
  }
}
