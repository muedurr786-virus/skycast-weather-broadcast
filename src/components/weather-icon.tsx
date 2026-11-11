import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  className?: string;
}

/** Maps a WMO weather code (plus day/night) to a Lucide icon. */
export function WeatherIcon({ code, isDay = true, className }: WeatherIconProps) {
  const day = isDay !== false;
  const cls = cn('h-5 w-5', className);

  if (code === 0 || code === 1) {
    return day ? <Sun className={cn(cls, 'text-amber-300')} /> : <Moon className={cn(cls, 'text-zinc-200')} />;
  }
  if (code === 2) {
    return day ? (
      <CloudSun className={cn(cls, 'text-amber-200')} />
    ) : (
      <CloudMoon className={cn(cls, 'text-zinc-300')} />
    );
  }
  if (code === 3) return <Cloud className={cn(cls, 'text-zinc-300')} />;
  if (code === 45 || code === 48) return <CloudFog className={cn(cls, 'text-zinc-400')} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className={cn(cls, 'text-teal-200')} />;
  if (code >= 61 && code <= 67) return <CloudRain className={cn(cls, 'text-teal-200')} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return <CloudSnow className={cn(cls, 'text-zinc-100')} />;
  if (code >= 80 && code <= 82) return <CloudRainWind className={cn(cls, 'text-teal-200')} />;
  if (code >= 95) return <CloudLightning className={cn(cls, 'text-amber-300')} />;
  return <Cloud className={cn(cls, 'text-zinc-400')} />;
}
