import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet, fetchUpstream } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reverse?lat=..&lon=..
 * Reverse geocoding proxy (BigDataCloud free client API) so the
 * "use my location" button can show a proper city name.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Valid lat and lon are required.' }, { status: 400 });
  }

  const key = `rev:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cacheGet<{ name: string }>(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

  try {
    const res = await fetchUpstream(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Reverse geocode failed.' }, { status: 502 });
    }
    const json = await res.json();
    const name: string =
      json.city || json.locality || json.principalSubdivision || 'My Location';
    const payload = { name };
    cacheSet(key, payload, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Reverse geocode failed.' }, { status: 502 });
  }
}
