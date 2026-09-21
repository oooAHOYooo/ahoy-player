import React from "react";
import { TrackInfo } from "./TrackInfo";
import { TransportControls } from "./TransportControls";
import { TimelineScrubber } from "./TimelineScrubber";
import { VolumeControl } from "./VolumeControl";
import { StatusBar } from "./StatusBar";
import type { AlbumCardData } from "../../types/player-ui";
import type { SleepTimerOption } from "../../hooks/useSleepTimer";

type BottomPlayerBarProps = {
  currentTrack?: AlbumCardData;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (ms: number) => void;
  onChangeVolume: (vol: number) => void;
  onToggleQueue?: () => void;
  onToggleVisualizer?: () => void;
  onToggleDial?: () => void;
  playbackRate?: number;
  onChangePlaybackRate?: (rate: number) => void;
  selectedSleepOption?: SleepTimerOption;
  formattedSleepRemaining?: string | null;
  onSetSleepTimer?: (opt: SleepTimerOption) => void;
  statusText?: string;
  subStatusText?: string;
};

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  positionMs,
  durationMs,
  volume,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onChangeVolume,
  onToggleQueue,
  onToggleVisualizer,
  onToggleDial,
  playbackRate = 1.0,
  onChangePlaybackRate = () => {},
  selectedSleepOption = "off",
  formattedSleepRemaining = null,
  onSetSleepTimer = () => {},
  statusText,
  subStatusText,
}) => {
  return (
    <div className="ahoy-player-dock-wrapper">
      <section className="ahoy-bottom-player-deck" aria-label="Audio playback bar">
        <div className="ahoy-deck-left">
          <TrackInfo
            title={currentTrack?.title ?? "Ooo"}
            artist={currentTrack?.artist ?? "Karen Dalton"}
            coverType={currentTrack?.coverType ?? "vinyl-beige"}
          />
        </div>

        <div className="ahoy-deck-center">
          <TransportControls
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onPrevious={onPrevious}
            onNext={onNext}
          />
          <TimelineScrubber
            currentMs={positionMs}
            totalMs={durationMs}
            onSeek={onSeek}
            playbackRate={playbackRate}
            onChangePlaybackRate={onChangePlaybackRate}
          />
        </div>

        <div className="ahoy-deck-right">
          <VolumeControl
            volume={volume}
            onChangeVolume={onChangeVolume}
            onToggleQueue={onToggleQueue}
            onToggleVisualizer={onToggleVisualizer}
            onToggleDial={onToggleDial}
            selectedSleepOption={selectedSleepOption}
            formattedSleepRemaining={formattedSleepRemaining}
            onSetSleepTimer={onSetSleepTimer}
          />
        </div>
      </section>

      <StatusBar statusText={statusText} subText={subStatusText} />
    </div>
  );
};
