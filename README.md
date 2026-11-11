# SkyCast Live — Weather Broadcast

A TV-style weather broadcast studio that runs in the browser and works on **both mobile and PC**.
Live conditions are presented on an animated broadcast screen, an auto-generated bulletin is read
aloud by the built-in "anchor desk", and hourly + 7-day forecasts complete the newscast.

Weather data comes from [Open-Meteo](https://open-meteo.com) — free, no API key required.

## Features

- **Responsive layout** — mobile-first design that reflows into a two-column desktop studio
- **Animated weather scene** — sun / moon / stars / clouds / rain / snow / lightning / fog, rendered with pure CSS, wrapped in a TV screen overlay (scanlines, vignette, LIVE bug)
- **Anchor desk broadcast** — auto-written weather bulletin with one-tap voice-over using the browser SpeechSynthesis API (karaoke-style text highlighting while it reads)
- **City search** — worldwide geocoding with debounce, plus a "use my location" button (reverse geocoded to a city name)
- **Quick cities** — Dhaka, New York, London, Tokyo, Dubai, Sydney
- **Next 24 hours** — horizontally scrollable hourly strip with precipitation chance
- **7-day outlook** — min/max temperature range bars with color coding
- **Current conditions** — feels-like, humidity, wind (with direction arrow), precipitation, pressure, air quality (US AQI), sunrise and sunset
- **°C / °F toggle** — remembered between visits, together with the last selected city
- **Auto-refresh** — every 10 minutes, with a manual refresh button
- **Resilient data layer** — server-side proxy with memory caching, stale-if-error fallback and 429 backoff

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19 + TypeScript     |
| Styling    | Tailwind CSS 4 + shadcn/ui components               |
| Animations | Pure CSS keyframes (no animation library needed)    |
| Data       | Open-Meteo forecast + air quality, Open-Meteo geocoding, BigDataCloud reverse geocoding |
| Voice      | Web Speech API (SpeechSynthesis)                    |

## Quick start

Requirements: Node.js 18+ (or Bun 1.1+). No API keys and no database are needed.

```bash
# 1. install dependencies (pick one)
npm install
bun install

# 2. start the dev server
npm run dev          # http://localhost:3000
bun run dev

# 3. production build + start
npm run build
npm run start
```

Open `http://localhost:3000` on your PC, or on your phone using your computer's LAN IP
(for example `http://192.168.1.20:3000`) to see the mobile layout.

Note: the "use my location" button requires a secure context — `localhost` or HTTPS.

## Project structure

```
├── src/
│   ├── app/
│   │   ├── layout.tsx              # App shell, fonts, metadata, toaster
│   │   ├── page.tsx                # Main page: state, data loading, layout
│   │   ├── globals.css             # Tailwind theme + all wx-* weather animations
│   │   └── api/
│   │       ├── weather/route.ts    # GET /api/weather  — forecast + AQI proxy
│   │       ├── geocode/route.ts    # GET /api/geocode  — city search proxy
│   │       ├── reverse/route.ts    # GET /api/reverse  — reverse geocode proxy
│   │       └── route.ts            # GET /api           — health check
│   ├── components/
│   │   ├── weather-scene.tsx       # Animated TV-studio weather scene
│   │   ├── weather-icon.tsx        # WMO code -> icon mapping
│   │   ├── search-bar.tsx          # City search + geolocation
│   │   ├── broadcast-script.tsx    # Anchor desk with speech playback
│   │   ├── hourly-strip.tsx        # Next 24 hours strip
│   │   ├── daily-forecast.tsx      # 7-day outlook with range bars
│   │   └── ui/                     # shadcn/ui primitives (button, card, ...)
│   ├── lib/
│   │   ├── weather.ts              # Types, WMO map, unit/time helpers, script generator
│   │   └── cache.ts                # Memory cache + upstream fetch with backoff
│   └── hooks/                      # use-toast, use-mobile
├── CODE_GUIDE.md                   # Part-by-part code walkthrough (start here)
└── README.md
```

## How the data flows

```
Browser (page.tsx)
   │  fetch /api/weather?lat=..&lon=..
   ▼
API route (app/api/weather) ── memory cache (lib/cache.ts) ──> Open-Meteo (forecast + air quality)
   │
   ▼  JSON { weather, aqi }
page.tsx  ──> weatherInfo(code) ──> WeatherScene + WeatherIcon
          ──> generateBroadcastScript(data) ──> BroadcastScript (on-screen + spoken)
          ──> hourly/daily slicing ──> HourlyStrip / DailyForecast
```

Search and "use my location" follow the same pattern through `/api/geocode` and `/api/reverse`.

## Customization

- **Quick cities** — edit `QUICK_CITIES` at the top of `src/app/page.tsx`.
- **Default unit** — change the initial `useState<Unit>('C')` in `src/app/page.tsx`.
- **Refresh interval** — change `REFRESH_MS` in `src/app/page.tsx`.
- **Voice speed / language** — see `utterance.rate` and `utterance.lang` in `src/components/broadcast-script.tsx`.
- **Scene look** — sky gradients in `SKY` (`src/components/weather-scene.tsx`), particle counts in the `make*` calls, keyframes in `src/app/globals.css`.
- **Bulletin wording** — `generateBroadcastScript()` in `src/lib/weather.ts`.

## Troubleshooting

| Problem                        | Fix                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| "Could not load weather data"  | Check internet access; the proxy retries twice before showing this.  |
| No voice on the anchor desk    | The device has no TTS voice installed; the bulletin stays readable on screen. |
| Location button does nothing   | Geolocation needs `localhost` or HTTPS and browser permission.       |
| Air quality shows `--`         | The AQI service is optional and fails silently; weather still works. |

## Credits

- Weather & geocoding: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0)
- Reverse geocoding: [BigDataCloud](https://www.bigdatacloud.com) free client API
- Icons: [Lucide](https://lucide.dev) · UI primitives: [shadcn/ui](https://ui.shadcn.com)
