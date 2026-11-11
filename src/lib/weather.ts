// ============================================================
// SkyCast Live — Weather data layer (Open-Meteo, no API key)
// ============================================================

export interface GeoLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export interface CurrentWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  surface_pressure: number;
}

export interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: (number | null)[];
  is_day: number[];
}

export interface DailyWeather {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_probability_max: (number | null)[];
}

export interface WeatherData {
  utc_offset_seconds: number;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyWeather;
  daily: DailyWeather;
}

export type Unit = 'C' | 'F';

export type SceneKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

// ---------- WMO weather code mapping ----------

const WMO: Record<number, { label: string; scene: SceneKind }> = {
  0: { label: 'Clear sky', scene: 'clear' },
  1: { label: 'Mainly clear', scene: 'clear' },
  2: { label: 'Partly cloudy', scene: 'partly' },
  3: { label: 'Overcast', scene: 'cloudy' },
  45: { label: 'Foggy', scene: 'fog' },
  48: { label: 'Freezing fog', scene: 'fog' },
  51: { label: 'Light drizzle', scene: 'rain' },
  53: { label: 'Drizzle', scene: 'rain' },
  55: { label: 'Heavy drizzle', scene: 'rain' },
  56: { label: 'Freezing drizzle', scene: 'rain' },
  57: { label: 'Freezing drizzle', scene: 'rain' },
  61: { label: 'Light rain', scene: 'rain' },
  63: { label: 'Rain', scene: 'rain' },
  65: { label: 'Heavy rain', scene: 'rain' },
  66: { label: 'Freezing rain', scene: 'rain' },
  67: { label: 'Freezing rain', scene: 'rain' },
  71: { label: 'Light snow', scene: 'snow' },
  73: { label: 'Snow', scene: 'snow' },
  75: { label: 'Heavy snow', scene: 'snow' },
  77: { label: 'Snow grains', scene: 'snow' },
  80: { label: 'Light showers', scene: 'rain' },
  81: { label: 'Rain showers', scene: 'rain' },
  82: { label: 'Violent showers', scene: 'rain' },
  85: { label: 'Snow showers', scene: 'snow' },
  86: { label: 'Heavy snow showers', scene: 'snow' },
  95: { label: 'Thunderstorm', scene: 'storm' },
  96: { label: 'Storm with hail', scene: 'storm' },
  99: { label: 'Severe hailstorm', scene: 'storm' },
};

export function weatherInfo(code: number): { label: string; scene: SceneKind } {
  return WMO[code] ?? { label: 'Unsettled', scene: 'cloudy' };
}

// ---------- Unit helpers ----------

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fmtTemp(celsius: number, unit: Unit): string {
  return `${Math.round(unit === 'C' ? celsius : cToF(celsius))}`;
}

export function fmtSpeed(kmh: number, unit: Unit): { value: string; unitLabel: string } {
  return unit === 'C'
    ? { value: `${Math.round(kmh)}`, unitLabel: 'km/h' }
    : { value: `${Math.round(kmh * 0.621371)}`, unitLabel: 'mph' };
}

export function fmtDepth(mm: number, unit: Unit): { value: string; unitLabel: string } {
  return unit === 'C'
    ? { value: `${mm.toFixed(1)}`, unitLabel: 'mm' }
    : { value: `${(mm / 25.4).toFixed(2)}`, unitLabel: 'in' };
}

const DIRS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function windDirName(deg: number): string {
  return DIRS[Math.round(deg / 22.5) % 16] ?? 'N';
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very bad';
  return 'Hazardous';
}

// ---------- Time helpers (values from Open-Meteo are local ISO strings) ----------

export function localHourNow(utcOffsetSeconds: number): number {
  return new Date(Date.now() + utcOffsetSeconds * 1000).getUTCHours();
}

export function locationClock(date: Date, utcOffsetSeconds: number): { time: string; date: string } {
  const shifted = new Date(date.getTime() + utcOffsetSeconds * 1000);
  return {
    time: shifted.toLocaleTimeString('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    date: shifted.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
  };
}

export function dayName(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

// ---------- API calls (through our server proxy for caching + rate-limit safety) ----------

export async function searchCities(query: string): Promise<GeoLocation[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('City search failed');
  const json = await res.json();
  return (json.results ?? []) as GeoLocation[];
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('Reverse geocode failed');
  const json = await res.json();
  return (json.name as string) || 'My Location';
}

export interface WeatherBundle {
  weather: WeatherData;
  aqi: number | null;
}

export async function fetchWeatherBundle(lat: number, lon: number): Promise<WeatherBundle> {
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('Weather request failed');
  return (await res.json()) as WeatherBundle;
}

// ---------- Broadcast script generator ----------

export function generateBroadcastScript(
  data: WeatherData,
  placeName: string,
  unit: Unit
): string {
  const c = data.current;
  const info = weatherInfo(c.weather_code);
  const hour = localHourNow(data.utc_offset_seconds);
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstUnit = unit === 'C' ? 'degrees Celsius' : 'degrees Fahrenheit';

  const t = (celsius: number) => Math.round(unit === 'C' ? celsius : cToF(celsius));
  const speed = (kmh: number) => {
    const s = fmtSpeed(kmh, unit);
    return `${s.value} ${unit === 'C' ? 'kilometres' : 'miles'} per hour`;
  };

  const sentences: string[] = [];

  sentences.push(`${greeting}, and welcome to SkyCast Live. Here is your weather for ${placeName}.`);
  sentences.push(
    `Right now it is ${t(c.temperature_2m)} ${firstUnit}, with ${info.label.toLowerCase()}. It feels like ${t(c.apparent_temperature)} degrees.`
  );
  sentences.push(
    `Winds are blowing at ${speed(c.wind_speed_10m)} out of the ${windDirName(c.wind_direction_10m)}, and humidity sits at ${c.relative_humidity_2m} percent.`
  );
  if (c.precipitation > 0) {
    const d = fmtDepth(c.precipitation, unit);
    sentences.push(`We have picked up ${d.value} ${unit === 'C' ? 'millimetres' : 'inches'} of precipitation in the past hour.`);
  }

  const daily = data.daily;
  sentences.push(
    `Today tops out at ${t(daily.temperature_2m_max[0])} degrees, dropping to ${t(daily.temperature_2m_min[0])} overnight, with a ${daily.precipitation_probability_max[0] ?? 0} percent chance of precipitation.`
  );
  sentences.push(
    `Sunrise this morning at ${daily.sunrise[0].slice(11, 16)}, sunset this evening at ${daily.sunset[0].slice(11, 16)}.`
  );

  if (daily.time.length > 1) {
    const tmInfo = weatherInfo(daily.weather_code[1]);
    sentences.push(
      `Looking ahead to tomorrow: ${tmInfo.label.toLowerCase()}, with a high of ${t(daily.temperature_2m_max[1])} and a low of ${t(daily.temperature_2m_min[1])} degrees.`
    );
  }

  const allMax = daily.temperature_2m_max;
  const allMin = daily.temperature_2m_min;
  const pops = daily.precipitation_probability_max.map((p) => p ?? 0);
  const wetIdx = pops.indexOf(Math.max(...pops));
  sentences.push(
    `Across the next seven days, temperatures will range from ${t(Math.min(...allMin))} up to ${t(Math.max(...allMax))} degrees. The wettest day looks like ${dayName(daily.time[wetIdx])}, with about ${pops[wetIdx]} percent chance of precipitation.`
  );

  sentences.push('That is your forecast. Stay weather aware, and have a great day. Back to you in the studio.');

  return sentences.join(' ');
}
