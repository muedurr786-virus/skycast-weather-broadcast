import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet, fetchUpstream } from '@/lib/cache';
import type { WeatherData } from '@/lib/weather';

export const dynamic = 'force-dynamic';

/**
 * GET /api/weather?lat=..&lon=..
 * Server-side proxy for Open-Meteo forecast + air quality with a 5-minute
 * memory cache and 429 retry. Keeps the client light and rate-limit safe.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Valid lat and lon are required.' }, { status: 400 });
  }

  const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cacheGet<{ weather: WeatherData; aqi: number | null }>(key);
  if (cached && !cached.stale) {
    return NextResponse.json(cached.value);
  }

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  });

  try {
    const [wxRes, airRes] = await Promise.all([
      fetchUpstream(`https://api.open-meteo.com/v1/forecast?${params.toString()}`),
      fetchUpstream(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=us_aqi`
      ).catch(() => null),
    ]);

    if (!wxRes.ok) {
      // Stale-if-error: better to show slightly old data than nothing.
      if (cached) {
        return NextResponse.json(cached.value);
      }
      return NextResponse.json(
        { error: 'Weather service is temporarily unavailable.' },
        { status: 502 }
      );
    }

    const weather = (await wxRes.json()) as WeatherData;

    let aqi: number | null = null;
    if (airRes && airRes.ok) {
      const air = await airRes.json();
      const value = air?.current?.us_aqi;
      if (typeof value === 'number') aqi = Math.round(value);
    }

    const payload = { weather, aqi };
    cacheSet(key, payload, 5 * 60 * 1000, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch {
    // Stale-if-error fallback
    if (cached) {
      return NextResponse.json(cached.value);
    }
    return NextResponse.json(
      { error: 'Weather service is temporarily unavailable.' },
      { status: 502 }
    );
  }
}
