import { useState, useEffect, useRef } from "react";

export type SleepTimerOption = "off" | "15" | "30" | "45" | "60" | "track";

type UseSleepTimerProps = {
  isPlaying: boolean;
  onPause: () => void;
  currentVolume: number;
  onSetVolume: (vol: number) => void;
  positionMs: number;
  durationMs: number;
};

export function useSleepTimer({
  isPlaying,
  onPause,
  currentVolume,
  onSetVolume,
  positionMs,
  durationMs,
}: UseSleepTimerProps) {
  const [selectedOption, setSelectedOption] = useState<SleepTimerOption>("off");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const baseVolumeRef = useRef<number>(currentVolume);
  const isFadingRef = useRef<boolean>(false);

  // Set new sleep timer
  const setTimer = (option: SleepTimerOption) => {
    setSelectedOption(option);
    isFadingRef.current = false;

    if (option === "off") {
      setRemainingSeconds(null);
      // Restore base volume if it was fading
      onSetVolume(baseVolumeRef.current);
      return;
    }

    baseVolumeRef.current = currentVolume > 0 ? currentVolume : 0.75;

    if (option === "track") {
      const remainingMs = Math.max(0, durationMs - positionMs);
      setRemainingSeconds(Math.max(1, Math.round(remainingMs / 1000)));
    } else {
      const minutes = parseInt(option, 10);
      setRemainingSeconds(minutes * 60);
    }
  };

  // Tick down every second when active
  useEffect(() => {
    if (selectedOption === "off" || remainingSeconds === null) return;
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          // Timer expired!
          clearInterval(interval);
          onPause();
          setSelectedOption("off");
          // Restore volume for next session
          onSetVolume(baseVolumeRef.current);
          isFadingRef.current = false;
          return null;
        }

        const next = prev - 1;

        // Smoothly fade out volume during the last 20 seconds
        if (next <= 20) {
          isFadingRef.current = true;
          const fadeRatio = next / 20;
          const fadedVol = Math.max(0, baseVolumeRef.current * fadeRatio);
          onSetVolume(fadedVol);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedOption, isPlaying, onPause, onSetVolume]);

  const formattedRemaining = remainingSeconds !== null
    ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`
    : null;

  return {
    selectedOption,
    remainingSeconds,
    formattedRemaining,
    setTimer,
    cancelTimer: () => setTimer("off"),
  };
}
