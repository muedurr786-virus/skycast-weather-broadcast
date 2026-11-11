'use client';

import { useEffect, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { reverseGeocode, searchCities, type GeoLocation } from '@/lib/weather';

interface SearchBarProps {
  onSelect: (location: GeoLocation) => void;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const { toast } = useToast();

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const longEnough = value.trim().length >= 2;
    setSearching(longEnough);
    if (!longEnough) {
      setResults([]);
      setOpen(false);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const found = await searchCities(trimmed);
        setResults(found);
        setOpen(true);
      } catch {
        toast({
          title: 'City search unavailable',
          description: 'Could not reach the search service. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, toast]);

  const choose = (loc: GeoLocation) => {
    onSelect(loc);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support location detection.',
        variant: 'destructive',
      });
      return;
    }
    setLocating(true);
    // Watchdog: some browsers never resolve the permission prompt — make sure
    // the button never stays stuck in the loading state.
    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      setLocating(false);
      toast({
        title: 'Location request timed out',
        description: 'Could not detect your position. Search for a city instead.',
        variant: 'destructive',
      });
    }, 12000);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        const { latitude, longitude } = pos.coords;
        try {
          const name = await reverseGeocode(latitude, longitude);
          onSelect({ id: `geo-${latitude.toFixed(3)},${longitude.toFixed(3)}`, name, latitude, longitude });
        } catch {
          onSelect({ id: `geo-${latitude.toFixed(3)},${longitude.toFixed(3)}`, name: 'My Location', latitude, longitude });
        } finally {
          setLocating(false);
        }
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        setLocating(false);
        toast({
          title: 'Location access denied',
          description: 'Allow location access in your browser, or search for a city instead.',
          variant: 'destructive',
        });
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <div className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) choose(results[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search any city, e.g. Dhaka, Tokyo, Paris..."
          aria-label="Search for a city"
          className="h-11 border-white/15 bg-white/5 pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-amber-400"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-400" aria-hidden />
        )}
        {open && results.length > 0 && (
          <div
            className="wx-scroll absolute top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#141a24] shadow-2xl shadow-black/50"
            role="listbox"
            aria-label="City search results"
          >
            {results.map((loc) => (
              <button
                key={loc.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(loc);
                }}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                <MapPin className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{loc.name}</span>
                  <span className="block truncate text-xs text-zinc-400">
                    {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={locateMe}
        disabled={locating}
        title="Use my location"
        aria-label="Use my current location"
        className="h-11 w-11 shrink-0 border-white/15 bg-white/5 text-amber-400 hover:bg-white/10 hover:text-amber-300"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
      </Button>
    </div>
  );
}
