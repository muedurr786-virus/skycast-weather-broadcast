'use client';

import { WeatherIcon } from '@/components/weather-icon';
import { weatherInfo, fmtTemp, type Unit } from '@/lib/weather';

export interface DayPoint {
  date: string;
  name: string;
  code: number;
  max: number;
  min: number;
  pop: number;
}

interface DailyForecastProps {
  days: DayPoint[];
  unit: Unit;
}

function tempColor(t: number): string {
  if (t <= 0) return '#94a3b8';
  if (t <= 10) return '#2dd4bf';
  if (t <= 20) return '#a3e635';
  if (t <= 28) return '#fbbf24';
  if (t <= 35) return '#f97316';
  return '#ef4444';
}

export function DailyForecast({ days, unit }: DailyForecastProps) {
  if (days.length === 0) return null;
  const weekMin = Math.min(...days.map((d) => d.min));
  const weekMax = Math.max(...days.map((d) => d.max));
  const range = Math.max(weekMax - weekMin, 1);

  return (
    <div className="flex flex-col" role="list" aria-label="7 day forecast">
      {days.map((d, i) => {
        const left = ((d.min - weekMin) / range) * 100;
        const width = Math.max(((d.max - d.min) / range) * 100, 4);
        const label = weatherInfo(d.code).label;
        return (
          <div
            key={d.date}
            role="listitem"
            className={`grid min-h-11 grid-cols-[3.2rem_2rem_1fr] items-center gap-2 rounded-lg px-2 py-2 sm:grid-cols-[4.5rem_2rem_5.5rem_1fr] sm:gap-3 ${
              i === 0 ? 'bg-amber-400/10' : 'hover:bg-white/5'
            }`}
            aria-label={`${d.name}: ${label}, high ${fmtTemp(d.max, unit)}, low ${fmtTemp(d.min, unit)}, ${d.pop} percent precipitation chance`}
          >
            <span className={`text-sm font-semibold ${i === 0 ? 'text-amber-300' : 'text-zinc-200'}`}>
              {d.name}
            </span>
            <WeatherIcon code={d.code} isDay className="h-5 w-5 justify-self-center" />
            <span className="hidden truncate text-xs text-zinc-400 sm:block">{label}</span>
            <div className="flex items-center gap-2">
              <span className="w-8 text-right text-sm font-medium text-zinc-400">
                {fmtTemp(d.min, unit)}°
              </span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${tempColor(d.min)}, ${tempColor(d.max)})`,
                  }}
                />
              </span>
              <span className="w-8 text-sm font-bold text-white">{fmtTemp(d.max, unit)}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
