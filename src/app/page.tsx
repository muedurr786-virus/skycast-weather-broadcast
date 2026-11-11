'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Droplets,
  Gauge,
  Leaf,
  Navigation2,
  Radio,
  RefreshCw,
  Sunrise,
  Sunset,
  Thermometer,
  Umbrella,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { WeatherScene } from '@/components/weather-scene';
import { SearchBar } from '@/components/search-bar';
import { HourlyStrip, type HourPoint } from '@/components/hourly-strip';
import { DailyForecast, type DayPoint } from '@/components/daily-forecast';
import { BroadcastScript } from '@/components/broadcast-script';
import {
  aqiLabel,
  fetchWeatherBundle,
  fmtDepth,
  fmtSpeed,
  fmtTemp,
  generateBroadcastScript,
  locationClock,
  weatherInfo,
  type GeoLocation,
  type Unit,
  type WeatherData,
} from '@/lib/weather';

const QUICK_CITIES: GeoLocation[] = [
  { id: 'dhaka', name: 'Dhaka', latitude: 23.7104, longitude: 90.4074, country: 'Bangladesh' },
  { id: 'new-york', name: 'New York', latitude: 40.7128, longitude: -74.006, country: 'United States' },
  { id: 'london', name: 'London', latitude: 51.5072, longitude: -0.1276, country: 'United Kingdom' },
  { id: 'tokyo', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, country: 'Japan' },
  { id: 'dubai', name: 'Dubai', latitude: 25.2048, longitude: 55.2708, country: 'United Arab Emirates' },
  { id: 'sydney', name: 'Sydney', latitude: -33.8688, longitude: 151.2093, country: 'Australia' },
];

const REFRESH_MS = 10 * 60 * 1000;

type Status = 'loading' | 'ready' | 'error';

export default function Home() {
  const [selected, setSelected] = useState<GeoLocation | null>(null);
  const [unit, setUnit] = useState<Unit>('C');
  const [data, setData] = useState<WeatherData | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [now, setNow] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();

  // ---- restore saved location / unit on first mount (deferred to a microtask) ----
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedUnit = localStorage.getItem('skycast.unit');
        if (savedUnit === 'C' || savedUnit === 'F') setUnit(savedUnit);
        const savedLoc = localStorage.getItem('skycast.location');
        if (savedLoc) {
          const parsed = JSON.parse(savedLoc) as GeoLocation;
          if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            setSelected(parsed);
            setHydrated(true);
            return;
          }
        }
      } catch {
        // ignore corrupted storage and fall back to the default city
      }
      setSelected(QUICK_CITIES[0]);
      setHydrated(true);
    });
  }, []);

  // ---- persist only after restore has finished, so we never overwrite saved values ----
  useEffect(() => {
    if (hydrated && selected) {
      localStorage.setItem('skycast.location', JSON.stringify(selected));
    }
  }, [selected, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem('skycast.unit', unit);
  }, [unit, hydrated]);

  // ---- data loading (with one automatic client-side retry) ----
  const fetchAll = useCallback(
    async (loc: GeoLocation, silent = false) => {
      if (!silent) setStatus('loading');
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const bundle = await fetchWeatherBundle(loc.latitude, loc.longitude);
          setData(bundle.weather);
          setAqi(bundle.aqi);
          setStatus('ready');
          return;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          if (!silent) {
            setStatus('error');
            toast({
              title: 'Broadcast interrupted',
              description: 'Could not load weather data. Please retry.',
              variant: 'destructive',
            });
          }
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!selected) return;
    const id = setTimeout(() => fetchAll(selected, false), 0);
    return () => clearTimeout(id);
  }, [selected, fetchAll]);

  // ---- auto refresh every 10 minutes ----
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => fetchAll(selected, true), REFRESH_MS);
    return () => clearInterval(id);
  }, [selected, fetchAll]);

  // ---- ticking clock ----
  useEffect(() => {
    const tick = () => setNow(new Date());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  // ---- derived data ----
  const info = data ? weatherInfo(data.current.weather_code) : null;
  const isDay = data ? data.current.is_day === 1 : true;

  const clock = useMemo(() => {
    if (!now || !data) return { time: '--:--:--', date: 'Live local time' };
    return locationClock(now, data.utc_offset_seconds);
  }, [now, data]);

  const hours = useMemo<HourPoint[]>(() => {
    if (!data) return [];
    const { hourly, current } = data;
    const stamp = current.time.slice(0, 13);
    let idx = hourly.time.findIndex((t) => t.slice(0, 13) === stamp);
    if (idx < 0) idx = 0;
    return hourly.time.slice(idx, idx + 24).map((t, i) => ({
      time: t.slice(11, 16),
      temp: hourly.temperature_2m[idx + i],
      code: hourly.weather_code[idx + i],
      isDay: (hourly.is_day?.[idx + i] ?? 1) === 1,
      pop: hourly.precipitation_probability?.[idx + i] ?? 0,
    }));
  }, [data]);

  const days = useMemo<DayPoint[]>(() => {
    if (!data) return [];
    const d = data.daily;
    return d.time.map((date, i) => ({
      date,
      name:
        i === 0
          ? 'Today'
          : new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      pop: d.precipitation_probability_max?.[i] ?? 0,
    }));
  }, [data]);

  const scriptPlace = selected ? [selected.name, selected.country].filter(Boolean).join(', ') : '';
  const script = useMemo(
    () => (data && scriptPlace ? generateBroadcastScript(data, scriptPlace, unit) : ''),
    [data, scriptPlace, unit]
  );

  const metrics = useMemo(() => {
    if (!data) return [];
    const cur = data.current;
    const spd = fmtSpeed(cur.wind_speed_10m, unit);
    const dep = fmtDepth(cur.precipitation, unit);
    return [
      { icon: Thermometer, label: 'Feels like', value: `${fmtTemp(cur.apparent_temperature, unit)}°` },
      { icon: Droplets, label: 'Humidity', value: `${cur.relative_humidity_2m}%` },
      {
        icon: Wind,
        label: 'Wind',
        value: `${spd.value} ${spd.unitLabel}`,
        sub: (
          <span className="inline-flex items-center gap-1">
            <Navigation2
              className="h-3 w-3 text-amber-400"
              style={{ transform: `rotate(${cur.wind_direction_10m}deg)` }}
              aria-hidden
            />
            {`${Math.round(cur.wind_direction_10m)}°`}
          </span>
        ),
      },
      { icon: Umbrella, label: 'Precip', value: `${dep.value} ${dep.unitLabel}`, sub: 'past hour' },
      { icon: Gauge, label: 'Pressure', value: `${Math.round(cur.surface_pressure)} hPa` },
      {
        icon: Leaf,
        label: 'Air quality',
        value: aqi != null ? `${aqi} AQI` : '--',
        sub: aqi != null ? aqiLabel(aqi) : 'unavailable',
      },
      { icon: Sunrise, label: 'Sunrise', value: data.daily.sunrise[0].slice(11, 16) },
      { icon: Sunset, label: 'Sunset', value: data.daily.sunset[0].slice(11, 16) },
    ];
  }, [data, aqi, unit]);

  const retry = () => {
    if (selected) fetchAll(selected, false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0c10] text-zinc-100">
      {/* ================= Header ================= */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0c10]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              On air
            </span>
            <Radio className="h-5 w-5 text-amber-400" aria-hidden />
            <h1 className="text-lg font-black tracking-tight">
              SkyCast <span className="text-amber-400">LIVE</span>
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight" aria-live="off">
              <div className="font-mono text-sm font-semibold tabular-nums">{clock.time}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">{clock.date}</div>
            </div>
            <div
              className="flex h-11 items-center overflow-hidden rounded-lg border border-white/15"
              role="group"
              aria-label="Temperature unit"
            >
              {(['C', 'F'] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`h-full w-11 text-sm font-bold transition-colors ${
                    unit === u ? 'bg-amber-400 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={retry}
              disabled={status === 'loading'}
              aria-label="Refresh weather"
              className="h-11 w-11 shrink-0 border-white/15 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin text-amber-400' : ''}`} />
            </Button>
          </div>

          <div className="w-full sm:w-80">
            <SearchBar onSelect={setSelected} />
          </div>
        </div>
      </header>

      {/* ================= Main ================= */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-5">
        {/* Quick city chips */}
        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Quick city selection"
        >
          {QUICK_CITIES.map((c) => {
            const active =
              !!selected &&
              Math.abs(selected.latitude - c.latitude) < 0.05 &&
              Math.abs(selected.longitude - c.longitude) < 0.05;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                aria-pressed={active}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-amber-400 bg-amber-400 text-black'
                    : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {status === 'error' && !data ? (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-14 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden />
            <div>
              <p className="font-semibold text-white">Could not load the weather broadcast</p>
              <p className="mt-1 text-sm text-zinc-400">Check your internet connection and try again.</p>
            </div>
            <Button onClick={retry} className="min-h-11 bg-amber-400 font-semibold text-black hover:bg-amber-300">
              Retry
            </Button>
          </div>
        ) : status === 'loading' && !data ? (
          <div aria-busy="true" aria-label="Loading weather">
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="flex flex-col gap-4 lg:col-span-3">
                <Skeleton className="h-72 w-full rounded-2xl bg-white/10 sm:h-80" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[4.5rem] rounded-xl bg-white/10" />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <Skeleton className="h-full min-h-[20rem] w-full rounded-2xl bg-white/10" />
              </div>
            </div>
            <Skeleton className="mt-4 h-36 w-full rounded-2xl bg-white/10" />
            <Skeleton className="mt-4 h-72 w-full rounded-2xl bg-white/10" />
          </div>
        ) : data && info && selected ? (
          <>
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Left: scene + metrics */}
              <div className="flex flex-col gap-4 lg:col-span-3">
                <div className="flex lg:flex-1">
                  <WeatherScene kind={info.scene} isDay={isDay}>
                    <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
                      <div className="overflow-hidden rounded-xl border border-white/15 bg-black/50 backdrop-blur">
                        <div
                          className="h-1 bg-gradient-to-r from-amber-400 via-red-500 to-amber-400"
                          aria-hidden
                        />
                        <div className="flex items-end justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-bold text-white sm:text-lg">
                              {selected.name}
                            </div>
                            <div className="truncate text-xs uppercase tracking-wider text-zinc-300">
                              {[selected.country, info.label].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="text-right leading-none">
                            <div className="text-4xl font-black text-white sm:text-5xl">
                              {fmtTemp(data.current.temperature_2m, unit)}°
                            </div>
                            <div className="mt-1 text-[11px] font-medium text-zinc-300">
                              H {fmtTemp(data.daily.temperature_2m_max[0], unit)}° · L{' '}
                              {fmtTemp(data.daily.temperature_2m_min[0], unit)}°
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </WeatherScene>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list" aria-label="Current conditions">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      role="listitem"
                      className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10 sm:p-4"
                    >
                      <div className="flex items-center gap-2 text-zinc-400">
                        <m.icon className="h-4 w-4 text-amber-400/90" aria-hidden />
                        <span className="text-[11px] uppercase tracking-wider">{m.label}</span>
                      </div>
                      <div className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{m.value}</div>
                      {m.sub && <div className="mt-0.5 text-[11px] text-zinc-500">{m.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: anchor desk */}
              <div className="lg:col-span-2">
                <BroadcastScript key={`${scriptPlace}-${unit}`} script={script} />
              </div>
            </div>

            {/* Hourly */}
            <Card className="mt-4 rounded-2xl border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-200">
                  <Clock className="h-4 w-4 text-amber-400" aria-hidden /> Next 24 hours
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <HourlyStrip hours={hours} unit={unit} />
              </CardContent>
            </Card>

            {/* Daily */}
            <Card className="mt-4 rounded-2xl border-white/10 bg-white/5">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-200">
                  <CalendarDays className="h-4 w-4 text-amber-400" aria-hidden /> 7-day outlook
                </CardTitle>
                <span className="text-xs text-zinc-500">temperatures in °{unit}</span>
              </CardHeader>
              <CardContent>
                <DailyForecast days={days} unit={unit} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>

      {/* ================= Footer ================= */}
      <footer className="mt-auto border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-zinc-500 sm:flex-row sm:text-left">
          <p>SkyCast Live — a TV-style weather broadcast studio. Weather data by Open-Meteo.com (free, no API key).</p>
          <p>Responsive for mobile &amp; desktop · auto-refreshes every 10 minutes.</p>
        </div>
      </footer>
    </div>
  );
}
