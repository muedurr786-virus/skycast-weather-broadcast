'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BroadcastScriptProps {
  script: string;
}

/**
 * "Anchor Desk" — displays the auto-generated weather bulletin and can read
 * it aloud using the browser's built-in SpeechSynthesis (works on both
 * mobile and desktop, no API key needed).
 */
export function BroadcastScript({ script }: BroadcastScriptProps) {
  const [speaking, setSpeaking] = useState(false);
  const [spokenChars, setSpokenChars] = useState(0);
  // This panel only renders after client-side data loads, so this is always
  // evaluated in the browser — no state/effect needed, no hydration mismatch.
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Prime voice list (some browsers load voices asynchronously)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // NOTE: stopping playback when the script changes (new city / unit) is
  // handled by the parent remounting this component with a `key`.

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    };
  }, []);

  const play = () => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'en-US';
    utterance.rate = 1.02;
    utterance.pitch = 1;
    const voices = synth.getVoices();
    const voice =
      voices.find((v) => /en[-_]us/i.test(v.lang) && /google|natural|samantha/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setSpeaking(true);
      setSpokenChars(0);
    };
    utterance.onboundary = (e) => {
      if (typeof e.charIndex === 'number') setSpokenChars(e.charIndex);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setSpokenChars(0);
    };
    utterance.onerror = () => {
      setSpeaking(false);
    };
    utterRef.current = utterance;
    synth.cancel();
    synth.speak(utterance);

    // Graceful fallback: if no voice engine picks up the utterance
    // (e.g. devices without any TTS voice installed), tell the user.
    if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    voiceTimeoutRef.current = setTimeout(() => {
      if (!synth.speaking && !synth.pending) {
        toast({
          title: 'No voice available',
          description:
            'This device has no speech voice installed — you can still read the bulletin on screen.',
          variant: 'destructive',
        });
      }
    }, 2500);
  };

  const stop = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpokenChars(0);
  };

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5"
      aria-label="Weather bulletin script"
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Mic className="h-4 w-4 text-amber-400" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Anchor Desk</h2>
        <span className="ml-auto rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
          {speaking ? 'On air' : 'Standby'}
        </span>
      </header>

      <div className="flex-1 px-4 py-4 sm:px-5">
        <p
          className="min-h-[9rem] text-[15px] leading-relaxed sm:min-h-[12rem] lg:min-h-[14rem]"
          aria-live="polite"
        >
          {speaking ? (
            <>
              <span className="text-zinc-500">{script.slice(0, spokenChars)}</span>
              <span className="text-white">{script.slice(spokenChars)}</span>
            </>
          ) : (
            <span className="text-zinc-200">{script}</span>
          )}
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3">
        {speaking ? (
          <Button
            onClick={stop}
            variant="destructive"
            className="min-h-11 flex-1 gap-2 font-semibold sm:flex-none"
          >
            <X className="h-4 w-4" aria-hidden /> Stop broadcast
          </Button>
        ) : (
          <Button
            onClick={play}
            disabled={!supported}
            className="min-h-11 flex-1 gap-2 bg-amber-400 font-semibold text-black hover:bg-amber-300 sm:flex-none"
          >
            <Volume2 className="h-4 w-4" aria-hidden /> Play broadcast
          </Button>
        )}
        <p className="text-xs text-zinc-500">
          {supported
            ? 'Voiceover uses your device voice — mobile & desktop.'
            : 'Voiceover is not supported in this browser.'}
        </p>
      </footer>
    </section>
  );
}
