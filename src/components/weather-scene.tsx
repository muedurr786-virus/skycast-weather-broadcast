'use client';

import { useMemo } from 'react';
import type { SceneKind } from '@/lib/weather';

// Deterministic pseudo-random generator (stable across SSR / CSR, no hydration mismatch)
function prand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SKY: Record<string, string> = {
  'clear-day': 'linear-gradient(180deg,#0e7490 0%,#155e75 45%,#0c1322 100%)',
  'clear-night': 'linear-gradient(180deg,#101826 0%,#0b0f18 100%)',
  'partly-day': 'linear-gradient(180deg,#137e8f 0%,#11526b 55%,#0c1322 100%)',
  'partly-night': 'linear-gradient(180deg,#141c28 0%,#0b0f18 100%)',
  cloudy: 'linear-gradient(180deg,#3f4a56 0%,#232b35 100%)',
  fog: 'linear-gradient(180deg,#566069 0%,#2a323b 100%)',
  rain: 'linear-gradient(180deg,#26303c 0%,#12161d 100%)',
  snow: 'linear-gradient(180deg,#4d5a68 0%,#232b35 100%)',
  storm: 'linear-gradient(180deg,#1b1d24 0%,#0a0b0f 100%)',
};

interface CloudSpec {
  top: number;
  width: number;
  opacity: number;
  duration: number;
  delay: number;
  blur: number;
  dark: boolean;
}

function makeClouds(kind: SceneKind, count: number, salt: number): CloudSpec[] {
  const dark = kind === 'rain' || kind === 'storm' || kind === 'cloudy';
  return Array.from({ length: count }, (_, i) => ({
    top: 4 + prand(i, salt) * 42,
    width: 90 + prand(i, salt + 1) * 150,
    opacity: (dark ? 0.5 : 0.75) + prand(i, salt + 2) * 0.25,
    duration: 55 + prand(i, salt + 3) * 65,
    delay: -prand(i, salt + 4) * 70,
    blur: prand(i, salt + 5) * 3,
    dark,
  }));
}

interface DropSpec {
  left: number;
  duration: number;
  delay: number;
  height: number;
  opacity: number;
}

function makeRain(count: number, salt: number): DropSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    left: prand(i, salt) * 104 - 2,
    duration: 0.75 + prand(i, salt + 1) * 0.75,
    delay: -prand(i, salt + 2) * 1.5,
    height: 14 + prand(i, salt + 3) * 18,
    opacity: 0.25 + prand(i, salt + 4) * 0.45,
  }));
}

function makeSnow(count: number, salt: number): DropSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    left: prand(i, salt) * 100,
    duration: 7 + prand(i, salt + 1) * 9,
    delay: -prand(i, salt + 2) * 16,
    height: 3 + prand(i, salt + 3) * 5,
    opacity: 0.4 + prand(i, salt + 4) * 0.6,
  }));
}

function makeStars(count: number, salt: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: prand(i, salt) * 100,
    top: prand(i, salt + 1) * 55,
    size: 1 + prand(i, salt + 2) * 2,
    duration: 2 + prand(i, salt + 3) * 4,
    delay: -prand(i, salt + 4) * 6,
  }));
}

interface WeatherSceneProps {
  kind: SceneKind;
  isDay: boolean;
  children?: React.ReactNode;
}

/**
 * TV-studio style animated weather scene: sun / moon / clouds / rain /
 * snow / lightning / fog rendered with pure CSS animations, wrapped in a
 * broadcast "screen" with scanlines, vignette and a LIVE bug.
 */
export function WeatherScene({ kind, isDay, children }: WeatherSceneProps) {
  const key = kind + (isDay ? '-day' : '-night');
  const showCelestial = kind === 'clear' || kind === 'partly';
  const cloudCount =
    kind === 'clear' ? 0 : kind === 'partly' ? 3 : kind === 'cloudy' ? 5 : 4;

  const clouds = useMemo(() => makeClouds(kind, cloudCount, 7), [kind, cloudCount]);
  const rain = useMemo(
    () => (kind === 'rain' || kind === 'storm' ? makeRain(kind === 'storm' ? 70 : 55, 13) : []),
    [kind]
  );
  const snow = useMemo(() => (kind === 'snow' ? makeSnow(45, 29) : []), [kind]);
  const stars = useMemo(
    () => (!isDay && (kind === 'clear' || kind === 'partly') ? makeStars(42, 41) : []),
    [kind, isDay]
  );

  return (
    <div
      className="wx-anim relative h-72 w-full overflow-hidden sm:h-80 lg:h-full lg:min-h-[24rem]"
      style={{ background: SKY[key] ?? SKY.cloudy }}
      role="img"
      aria-label={`Animated weather scene: ${kind}`}
    >
      {/* Stars (night) */}
      {stars.map((s, i) => (
        <span
          key={`st-${i}`}
          className="wx-star absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `wx-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Sun */}
      {showCelestial && isDay && (
        <>
          <div
            className="absolute right-[12%] top-[14%] h-20 w-20 rounded-full"
            style={{
              background: 'radial-gradient(circle,#fef3c7 0%,#fbbf24 55%,#f59e0b 100%)',
              boxShadow: '0 0 60px 24px rgba(251,191,36,.45)',
              animation: 'wx-glow 5s ease-in-out infinite',
            }}
          />
          <div
            className="absolute right-[2%] top-[-6%] h-40 w-40 opacity-30"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, rgba(253,230,138,.5) 0deg 8deg, transparent 8deg 22deg)',
              borderRadius: '9999px',
              maskImage: 'radial-gradient(circle, transparent 44%, black 46%, black 72%, transparent 74%)',
              WebkitMaskImage:
                'radial-gradient(circle, transparent 44%, black 46%, black 72%, transparent 74%)',
              animation: 'wx-rotate 46s linear infinite',
            }}
          />
        </>
      )}

      {/* Moon */}
      {showCelestial && !isDay && (
        <div
          className="absolute right-[14%] top-[12%] h-16 w-16 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 35%,#f8fafc,#cbd5e1 70%,#94a3b8 100%)',
            boxShadow: '0 0 44px 14px rgba(226,232,240,.28)',
            animation: 'wx-glow 6s ease-in-out infinite',
          }}
        />
      )}

      {/* Clouds */}
      {clouds.map((c, i) => (
        <div
          key={`cl-${i}`}
          className={`wx-cloud ${c.dark ? 'wx-cloud-dark' : ''}`}
          style={{
            top: `${c.top}%`,
            width: c.width,
            height: c.width * 0.26,
            opacity: c.opacity,
            filter: `blur(${c.blur}px)`,
            animation: `wx-cloud-move ${c.duration}s linear ${c.delay}s infinite`,
          }}
        />
      ))}

      {/* Fog bands */}
      {kind === 'fog' &&
        [0, 1, 2].map((i) => (
          <div
            key={`fg-${i}`}
            className="absolute h-10 w-[130%] rounded-full bg-white/20"
            style={{
              top: `${30 + i * 22}%`,
              left: '-15%',
              filter: 'blur(14px)',
              animation: `wx-fog-move ${16 + i * 7}s ease-in-out ${-i * 5}s infinite`,
            }}
          />
        ))}

      {/* Rain */}
      {rain.map((r, i) => (
        <span
          key={`rn-${i}`}
          className="absolute top-[-6%] w-[2px] rounded-full bg-gradient-to-b from-transparent via-teal-100 to-teal-200"
          style={{
            left: `${r.left}%`,
            height: r.height,
            opacity: r.opacity,
            animation: `wx-rain-fall ${r.duration}s linear ${r.delay}s infinite`,
          }}
        />
      ))}

      {/* Snow */}
      {snow.map((s, i) => (
        <span
          key={`sn-${i}`}
          className="absolute top-[-6%] rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            width: s.height,
            height: s.height,
            opacity: s.opacity,
            animation: `wx-snow-fall ${s.duration}s linear ${s.delay}s infinite, wx-snow-sway 3s ease-in-out infinite`,
          }}
        />
      ))}

      {/* Lightning */}
      {kind === 'storm' && (
        <>
          <div className="wx-lightning pointer-events-none absolute inset-0 bg-white" />
          <div
            className="pointer-events-none absolute left-[30%] top-0 h-[55%] w-[3px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,.95), rgba(253,230,138,.5), transparent)',
              clipPath: 'polygon(40% 0, 100% 38%, 62% 40%, 78% 100%, 0 42%, 45% 38%)',
              animation: 'wx-bolt 7s linear infinite',
            }}
          />
        </>
      )}

      {/* TV screen overlays */}
      <div className="wx-scanlines pointer-events-none absolute inset-0" />
      <div className="wx-vignette pointer-events-none absolute inset-0" />

      {/* LIVE bug */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Live</span>
      </div>

      {/* Lower third / any overlay content */}
      {children}
    </div>
  );
}
