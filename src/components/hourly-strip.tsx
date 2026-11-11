'use client';

import { Droplets } from 'lucide-react';
import { WeatherIcon } from '@/components/weather-icon';
import { fmtTemp, type Unit } from '@/lib/weather';

export interface HourPoint {
  time: string;
  temp: number;
  code: number;
  isDay: boolean;
  pop: number;
}

interface HourlyStripProps {
  hours: HourPoint[];
  unit: Unit;
}

export function HourlyStrip({ hours, unit }: HourlyStripProps) {
  if (hours.length === 0) return null;
  return (
    <div
      className="wx-scroll flex snap-x gap-2 overflow-x-auto pb-2"
      role="list"
      aria-label="Hourly forecast for the next 24 hours"
    >
      {hours.map((h, i) => (
        <div
          key={h.time}
          role="listitem"
          className={`flex min-w-[4.6rem] snap-start snap-always flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
            i === 0
              ? 'border-amber-400/60 bg-amber-400/10'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {i === 0 ? 'Now' : h.time}
          </span>
          <WeatherIcon code={h.code} isDay={h.isDay} className="h-6 w-6" />
          <span className="text-sm font-bold text-white">{fmtTemp(h.temp, unit)}°</span>
          <span
            className={`flex items-center gap-0.5 text-[11px] ${
              h.pop >= 30 ? 'text-teal-300' : 'text-zinc-500'
            }`}
            aria-label={`${h.pop} percent chance of precipitation`}
          >
            <Droplets className="h-3 w-3" aria-hidden />
            {h.pop}%
          </span>
        </div>
      ))}
    </div>
  );
}
