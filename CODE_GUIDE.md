# SkyCast Live — Full Code Guide (Part by Part)

This guide walks through the entire codebase **part by part**, in the order you would
build it yourself. Every part lists its files, what the code does, and how it connects
to the next part. Read this top to bottom and you will understand 100% of the app.

```
Part 1  App shell & metadata          src/app/layout.tsx
Part 2  Theme & weather animations    src/app/globals.css
Part 3  Data layer                    src/lib/weather.ts
Part 4  Cache & upstream fetch        src/lib/cache.ts
Part 5  Server API routes             src/app/api/*
Part 6  Animated weather scene        src/components/weather-scene.tsx
Part 7  Weather icon mapping          src/components/weather-icon.tsx
Part 8  Search & geolocation          src/components/search-bar.tsx
Part 9  Anchor desk (voice broadcast) src/components/broadcast-script.tsx
Part 10 Hourly strip & daily forecast src/components/hourly-strip.tsx, daily-forecast.tsx
Part 11 Main page composition         src/app/page.tsx
Part 12 UI kit & project config       src/components/ui/*, package.json, ...
```

End-to-end data flow:

```
page.tsx ──fetch──> /api/weather ──cache──> Open-Meteo (forecast + air quality)
   │                                            ▲
   ├──search──> /api/geocode ──cache────────────┤ (geocoding-api.open-meteo.com)
   └──locate──> /api/reverse ──cache──> BigDataCloud
   │
   ├── weatherInfo(code) ──> WeatherScene + WeatherIcon
   ├── generateBroadcastScript() ──> BroadcastScreen (text + speechSynthesis)
   └── hourly / daily slicing ──> HourlyStrip / DailyForecast
```

---

## Part 1 — App shell & metadata

**File:** `src/app/layout.tsx`

The root layout loads the Geist font families as CSS variables, sets page metadata
(title, description, theme color, favicon) and mounts the global toast container.

Key points:

- `export const viewport` sets `width=device-width, initialScale=1` — this is what
  makes the page fill phones correctly. `themeColor: "#0a0c10"` tints mobile browser UI.
- `<Toaster />` from the UI kit renders the toast notifications used everywhere else.
- `suppressHydrationWarning` on `<html>` keeps React quiet about browser-injected
  attributes (extensions etc.).

Everything visible in the app is rendered by `children` — which is `page.tsx`.

---

## Part 2 — Theme & weather animations

**File:** `src/app/globals.css`

Three responsibilities live here:

1. **Tailwind 4 theme tokens** (`@theme inline`, `:root`, `.dark`) — the standard
   shadcn/ui CSS variable bridge. The app itself uses a fixed dark palette
   (`bg-[#0a0c10]`, `bg-white/5` cards, `amber-400` accent).
2. **`.wx-scroll`** — thin custom scrollbar styling for the hourly strip and
   search dropdown.
3. **All `wx-*` weather keyframes**, consumed by Part 6:

| Keyframe        | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `wx-cloud-move` | drifts clouds from -30% to 130% of the screen width  |
| `wx-rain-fall`  | drops with a slight scale for perspective            |
| `wx-snow-fall` / `wx-snow-sway` | vertical fall + horizontal sway      |
| `wx-twinkle`    | star opacity pulsing                                 |
| `wx-glow`       | breathing sun/moon glow                              |
| `wx-rotate`     | slow rotation of the sun ray wheel                   |
| `wx-fog-move`   | fog bands sliding sideways                           |
| `wx-bolt`       | lightning bolt flash timing                          |
| `wx-lightning`  | full-screen flash opacity                            |

Cloud bodies, scanlines and vignette are styled with `.wx-cloud`, `.wx-cloud-dark`,
`.wx-scanlines` and `.wx-vignette` (repeating gradients, no images needed).

---

## Part 3 — Data layer

**File:** `src/lib/weather.ts`

This is the single source of truth for types and pure helpers. No React, no fetch
to third parties (that is proxied in Part 5). Contents:

- **Types** — `GeoLocation`, `CurrentWeather`, `HourlyWeather`, `DailyWeather`,
  `WeatherData` (exact shape of the Open-Meteo response), `Unit = 'C' | 'F'`,
  `SceneKind` (clear / partly / cloudy / fog / rain / snow / storm).
- **`WMO` map + `weatherInfo(code)`** — translates WMO weather codes (0, 1-3, 45/48,
  51-57, 61-67, 71-77, 80-82, 85-86, 95-99) into a human label and a scene kind used
  by the animation engine.
- **Unit helpers** — `fmtTemp`, `fmtSpeed` (km/h vs mph), `fmtDepth` (mm vs in),
  `windDirName` (16-point compass), `aqiLabel` (US AQI bands). Everything accepts
  `Unit`, so switching C/F re-renders without new network calls.
- **Time helpers** — `localHourNow`, `locationClock` (live studio clock shifted by
  `utc_offset_seconds`), `dayName`.
- **Client API calls** — `searchCities`, `reverseGeocode`, `fetchWeatherBundle` all
  hit *our own* `/api/*` routes (same-origin, cached server-side).
- **`generateBroadcastScript(data, placeName, unit)`** — builds the anchor bulletin:
  greeting by local hour, current temp/condition/feels-like, wind + humidity,
  today's high/low and precipitation chance, sunrise/sunset, tomorrow preview, and a
  7-day summary (range + wettest day). This string is what the anchor desk shows and
  speaks.

---

## Part 4 — Cache & upstream fetch

**File:** `src/lib/cache.ts`

A tiny in-memory cache with two TTLs per entry:

- `freshUntil` — serve directly while fresh (weather: 5 min, geocode: 1 h).
- `staleUntil` — after going stale the value is kept as a fallback; if Open-Meteo is
  down or rate-limits us, Part 5 serves the stale copy instead of an error.

`fetchUpstream(url, tries = 5)` retries on HTTP 429 and network errors with
exponential backoff (`600ms * 2^attempt` + jitter). The store is capped at 200 keys
(oldest evicted) so memory stays bounded.

---

## Part 5 — Server API routes

**Files:** `src/app/api/weather/route.ts`, `src/app/api/geocode/route.ts`,
`src/app/api/reverse/route.ts`, `src/app/api/route.ts`

All three real routes are `export const dynamic = 'force-dynamic'` Next.js route
handlers that validate query params, check the cache, call `fetchUpstream`, and
normalize the response.

- **`GET /api/weather?lat=&lon=`** — calls Open-Meteo *forecast* (current + hourly +
  daily, 7 days, `timezone=auto`) and *air-quality* (`current=us_aqi`) in parallel.
  Air quality failure is non-fatal (`aqi: null`). Caches the combined payload for
  5 minutes, keeps it stale for 1 hour.
- **`GET /api/geocode?q=`** — Open-Meteo geocoding search, trimmed to the fields the
  UI needs (`id, name, latitude, longitude, country, admin1`), cached 1 hour.
- ****`GET /api/reverse?lat=&lon=`** — BigDataCloud free client API so the
  "use my location" button can show a real city name, cached 1 hour.
- **`GET /api`** — one-line health check.

Why a proxy? Same-origin requests, one place for caching/backoff, and the client
bundle stays free of third-party URLs.

---

## Part 6 — Animated weather scene

**File:** `src/components/weather-scene.tsx`

The TV-studio centerpiece. It renders a full-bleed "screen" whose content depends on
`SceneKind` + day/night:

- **Deterministic randomness** — `prand(i, salt)` is a seeded pseudo-random function
  (`sin` hash), so cloud/rain/snow positions are identical on server and client —
  no hydration mismatch, and no `useEffect` dance.
- **Spec generators** — `makeClouds`, `makeRain`, `makeSnow`, `makeStars` produce
  arrays of style specs (position, size, duration, delay, opacity) from those seeds.
- **Layers** — sky gradient (`SKY` map) -> stars (night) -> sun with rotating ray
  wheel or moon -> drifting clouds -> fog bands -> rain streaks -> snow -> lightning
  (full-screen flash + bolt clip-path) -> scanlines + vignette -> LIVE bug.
- **`children` slot** — `page.tsx` injects the "lower third" (city, condition, big
  temperature, H/L) into the bottom of the screen.

Element counts scale with severity: storm draws 70 rain drops, rain 55, partly
cloudy only 3 clouds, clear sky none.

---

## Part 7 — Weather icon mapping

**File:** `src/components/weather-icon.tsx`

Pure function component: WMO code (+ `isDay`) -> the right Lucide icon with a fixed
accent color (sun/moon amber, rain teal, snow white, storm amber). Used by the
hourly strip and the daily forecast so both always agree.

---

## Part 8 — Search & geolocation

**File:** `src/components/search-bar.tsx`

- **Debounced search** — 350 ms after the last keystroke (minimum 2 chars) it calls
  `searchCities()` and opens the dropdown. `onMouseDown` (not `onClick`) selects a
  result so the blur of the input cannot swallow the tap.
- **Keyboard support** — Enter picks the first result, Escape closes the list.
- **"Use my location"** — `navigator.geolocation.getCurrentPosition` with a 12 s
  watchdog timer (some browsers never resolve the permission prompt), then
  `reverseGeocode()` for a city name; on failure it falls back to "My Location".
  Loading spinners and toasts cover every state.

Selecting any location bubbles up via `onSelect(location)` to `page.tsx`.

---

## Part 9 — Anchor desk (the "broadcast")

**File:** `src/components/broadcast-script.tsx`

Renders the bulletin produced by `generateBroadcastScript` (Part 3) and speaks it:

- **Play** — builds a `SpeechSynthesisUtterance` (`lang: en-US`, `rate: 1.02`),
  prefers a high-quality en-US voice (Google/Natural/Samantha) when available.
- **Karaoke highlight** — `onboundary` events report `charIndex`, so the text already
  spoken is dimmed and the upcoming words stay bright while it reads.
- **Stop** — cancels synthesis and resets the highlight.
- **Safety nets** — unmount cleanup cancels speech; a 2.5 s watchdog toasts if the
  device has no voice installed; `supported` flag disables the button when the
  SpeechSynthesis API is missing. The parent remounts this component with a
  `key={place-unit}` when the location or unit changes, which stops any ongoing
  playback automatically.

---

## Part 10 — Hourly strip & daily forecast

**Files:** `src/components/hourly-strip.tsx`, `src/components/daily-forecast.tsx`

- **`HourlyStrip`** — 24 snap-scrolling cards ("Now" highlighted): hour, icon,
  temperature, droplet + precipitation chance (teal when >= 30%). The container is
  horizontally scrollable on phones and comfortably spread on desktop.
- **`DailyForecast`** — 7 rows: day name, icon, condition, min temp, a **range bar**
  positioned inside the week's min-max envelope (`left`/`width` percentages), and max
  temp. Bar color is a gradient between `tempColor(min)` and `tempColor(max)` —
  slate/teal/lime/amber/orange/red by temperature. Mobile hides the condition text
  column to keep rows single-line.

Both are pure presentational components: data shaping happens once in `page.tsx`.

---

## Part 11 — Main page composition

**File:** `src/app/page.tsx`

The conductor. It owns all state and wires every part together:

1. **State** — `selected` location, `unit`, `data`, `aqi`, `status` (loading/ready/
   error), ticking `now`, `hydrated` flag.
2. **Persistence** — on mount it restores the saved unit + location from
   `localStorage` (guarded by try/catch); saves happen only after the restore
   finished so saved values are never overwritten by defaults.
3. **Loading** — `fetchAll` calls `fetchWeatherBundle` with **one automatic retry**
   (2 s delay) before surfacing an error state with a Retry button.
4. **Auto-refresh** — `setInterval` every `REFRESH_MS` (10 min), silent mode (no
   skeleton flash). A manual refresh button spins while loading.
5. **Derived data (`useMemo`)** —
   - `hours`: finds the hourly index matching the current hour, slices 24 entries;
   - `days`: maps the daily arrays into `DayPoint`s (Today + weekday names);
   - `script`: the bulletin text (regenerates on city/unit change);
   - `metrics`: the eight condition tiles (feels-like, humidity, wind + rotating
     direction arrow, precipitation, pressure, AQI, sunrise, sunset).
6. **Layout** — sticky header (On-air badge, live studio clock, C/F toggle, refresh,
   search) -> quick-city chips -> responsive grid:
   - mobile: scene, condition tiles, anchor desk, hourly, daily (single column);
   - desktop (`lg`): 3/5 + 2/5 columns — scene & tiles left, anchor desk right,
     then full-width hourly and daily rows.
7. **States** — skeleton loaders while first load, an error card with retry when
   nothing is cached, and the full studio once data is ready.

---

## Part 12 — UI kit & project config

**Files:** `src/components/ui/*` (shadcn/ui primitives), `src/hooks/*`,
`package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
`postcss.config.mjs`, `components.json`, `eslint.config.mjs`, `prisma/schema.prisma`

- `ui/` is the standard shadcn/ui kit (button, card, input, skeleton, toast, ...).
  The weather app directly uses Button, Card, Input, Skeleton and the toast hook;
  the rest are part of the toolkit and can be removed if you want a minimal build.
- `next.config.ts` uses `output: "standalone"` (small production deploys).
- `package.json` scripts: `dev`, `build`, `start`, `lint` (plus Prisma db scripts
  that this app does not require — it keeps everything in memory).
- `prisma/schema.prisma` + `src/lib/db.ts` are scaffolding; the weather app never
  touches the database, so no environment variables are needed.

---

## Build & run recap

```bash
npm install     # or: bun install
npm run dev     # http://localhost:3000  (dev, hot reload)
npm run build   # optimized production build
npm run start   # serve the production build
```

No API keys, no database, no environment variables — clone, install, run.
