import React, { useRef, useEffect, useState } from "react";
import type { AlbumCardData } from "../../types/player-ui";

type VisualizerMode = "radar" | "spectrum" | "oscilloscope";

type AudioVisualizerPanelProps = {
  isPlaying: boolean;
  nowPlaying?: AlbumCardData | null;
  volume?: number;
};

export const AudioVisualizerPanel: React.FC<AudioVisualizerPanelProps> = ({
  isPlaying,
  nowPlaying,
  volume = 0.8,
}) => {
  const [mode, setMode] = useState<VisualizerMode>("radar");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Peak hold array for spectrum mode
  const peaksRef = useRef<number[]>(new Array(24).fill(0));
  const sweepAngleRef = useRef<number>(0);
  const blipsRef = useRef<Array<{ angle: number; radius: number; intensity: number }>>([
    { angle: 0.8, radius: 0.45, intensity: 0.9 },
    { angle: 2.1, radius: 0.72, intensity: 0.7 },
    { angle: 3.9, radius: 0.35, intensity: 0.85 },
    { angle: 5.2, radius: 0.60, intensity: 0.6 },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const width = (canvas.width = canvas.parentElement?.clientWidth || 400);
      const height = (canvas.height = canvas.parentElement?.clientHeight || 300);

      ctx.clearRect(0, 0, width, height);

      // Background ambient tint
      ctx.fillStyle = "#080f14";
      ctx.fillRect(0, 0, width, height);

      const accentColor = "#2dd4bf";
      const secondaryColor = "#14b8a6";
      const activeGain = isPlaying ? Math.max(0.2, volume) : 0.08;

      if (mode === "radar") {
        // RADAR SONAR MODE
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(cx, cy) * 0.88;

        // Sonar grid rings
        ctx.strokeStyle = "rgba(45, 212, 191, 0.18)";
        ctx.lineWidth = 1;
        for (let r = 0.25; r <= 1.0; r += 0.25) {
          ctx.beginPath();
          ctx.arc(cx, cy, maxRadius * r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - maxRadius, cy);
        ctx.lineTo(cx + maxRadius, cy);
        ctx.moveTo(cx, cy - maxRadius);
        ctx.lineTo(cx, cy + maxRadius);
        ctx.stroke();

        // Degree ticks on outer ring
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const x1 = cx + Math.cos(a) * (maxRadius - 4);
          const y1 = cy + Math.sin(a) * (maxRadius - 4);
          const x2 = cx + Math.cos(a) * maxRadius;
          const y2 = cy + Math.sin(a) * maxRadius;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Rotate sweep
        if (isPlaying) {
          sweepAngleRef.current = (sweepAngleRef.current + 0.035) % (Math.PI * 2);
        } else {
          sweepAngleRef.current = (sweepAngleRef.current + 0.005) % (Math.PI * 2);
        }
        const sweepAngle = sweepAngleRef.current;

        // Draw sweep cone
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        sweepGrad.addColorStop(0, "rgba(45, 212, 191, 0.3)");
        sweepGrad.addColorStop(1, "rgba(45, 212, 191, 0.0)");

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, sweepAngle - 0.45, sweepAngle);
        ctx.closePath();
        ctx.fillStyle = sweepGrad;
        ctx.fill();

        // Sweep leading line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
        ctx.strokeStyle = "#5eead4";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#5eead4";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

        // Blips
        blipsRef.current.forEach((blip) => {
          const bx = cx + Math.cos(blip.angle) * (maxRadius * blip.radius);
          const by = cy + Math.sin(blip.angle) * (maxRadius * blip.radius);

          // Angle diff to sweep
          let diff = sweepAngle - blip.angle;
          while (diff < 0) diff += Math.PI * 2;
          while (diff >= Math.PI * 2) diff -= Math.PI * 2;

          let alpha = Math.max(0.1, 1 - diff / 1.6);
          if (!isPlaying) alpha *= 0.3;

          ctx.beginPath();
          ctx.arc(bx, by, 3 + activeGain * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(45, 212, 191, ${alpha * blip.intensity})`;
          ctx.shadowColor = "#2dd4bf";
          ctx.shadowBlur = 6;
          ctx.fill();
        });

      } else if (mode === "spectrum") {
        // SPECTRUM ANALYZER MODE
        const barCount = 24;
        const padding = 4;
        const totalPadding = (barCount - 1) * padding;
        const barWidth = Math.max(4, (width - 48 - totalPadding) / barCount);
        const startX = (width - (barCount * barWidth + totalPadding)) / 2;
        const baseY = height - 36;
        const maxHeight = height - 70;

        for (let i = 0; i < barCount; i++) {
          const x = startX + i * (barWidth + padding);
          const freqMultiplier = Math.sin(i * 0.3 + time * 1.5) * 0.4 + 0.6;
          const bassBoost = i < 6 ? 1.4 : 1.0;
          const targetHeight = Math.max(
            8,
            (Math.sin(time * 3 + i * 0.8) * 0.5 + 0.5) *
              maxHeight *
              freqMultiplier *
              bassBoost *
              activeGain
          );

          // Peak hold logic
          if (targetHeight > peaksRef.current[i]) {
            peaksRef.current[i] = targetHeight;
          } else {
            peaksRef.current[i] = Math.max(8, peaksRef.current[i] - 1.5);
          }

          // Bar gradient
          const grad = ctx.createLinearGradient(0, baseY, 0, baseY - targetHeight);
          grad.addColorStop(0, accentColor);
          grad.addColorStop(0.7, secondaryColor);
          grad.addColorStop(1, "#5eead4");

          ctx.fillStyle = grad;
          ctx.fillRect(x, baseY - targetHeight, barWidth, targetHeight);

          // Peak marker
          ctx.fillStyle = "#fef08a";
          ctx.fillRect(x, baseY - peaksRef.current[i] - 2, barWidth, 2);
        }

        // Frequency axis line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.moveTo(24, baseY + 4);
        ctx.lineTo(width - 24, baseY + 4);
        ctx.stroke();

      } else {
        // OSCILLOSCOPE WAVEFORM MODE
        const cy = height / 2;
        const amp = (height * 0.32) * activeGain;

        ctx.strokeStyle = "#2dd4bf";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#2dd4bf";
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const step = 4;
        for (let x = 0; x <= width; x += step) {
          const normX = x / width;
          const wave1 = Math.sin(normX * 12 + time * 4) * amp;
          const wave2 = Math.sin(normX * 24 - time * 2) * (amp * 0.4);
          const wave3 = isPlaying ? Math.sin(normX * 4 + time * 6) * (amp * 0.25) : 0;
          const y = cy + wave1 + wave2 + wave3;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Ghost reflection beam
        ctx.strokeStyle = "rgba(45, 212, 191, 0.2)";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let x = 0; x <= width; x += step) {
          const normX = x / width;
          const wave = Math.sin(normX * 10 - time * 3) * (amp * 0.6);
          const y = cy + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [mode, isPlaying, volume]);

  return (
    <div className="ahoy-visualizer-panel" role="region" aria-label="Audio Visualizer">
      <div className="ahoy-visualizer-header">
        <div className="ahoy-visualizer-title-wrap">
          <span className="ahoy-visualizer-eyebrow">ACOUSTIC DYNAMICS</span>
          <h3 className="ahoy-visualizer-title">AHOY Audio Visualizer</h3>
        </div>

        <div className="ahoy-visualizer-controls">
          <div className="ahoy-viz-mode-group" role="tablist">
            <button
              type="button"
              className={`ahoy-viz-mode-btn ${mode === "radar" ? "is-active" : ""}`}
              onClick={() => setMode("radar")}
            >
              Sonar Radar
            </button>
            <button
              type="button"
              className={`ahoy-viz-mode-btn ${mode === "spectrum" ? "is-active" : ""}`}
              onClick={() => setMode("spectrum")}
            >
              Spectrum
            </button>
            <button
              type="button"
              className={`ahoy-viz-mode-btn ${mode === "oscilloscope" ? "is-active" : ""}`}
              onClick={() => setMode("oscilloscope")}
            >
              Oscilloscope
            </button>
          </div>
        </div>
      </div>

      <div className="ahoy-visualizer-canvas-wrap">
        <div className="ahoy-viz-overlay-hud">
          <span className={`ahoy-viz-badge ${isPlaying ? "is-live" : ""}`}>
            {isPlaying ? "● LIVE STREAM" : "◌ IDLE / READY"}
          </span>
          <span className="ahoy-viz-badge">
            {nowPlaying ? `${nowPlaying.artist} - ${nowPlaying.title}` : "AHOY DSP ENGINE"}
          </span>
        </div>
        <canvas ref={canvasRef} className="ahoy-visualizer-canvas" />
      </div>

      <div className="ahoy-viz-stats-grid">
        <div className="ahoy-viz-stat-card">
          <span className="ahoy-viz-stat-label">MODE</span>
          <span className="ahoy-viz-stat-value">{mode.toUpperCase()}</span>
        </div>
        <div className="ahoy-viz-stat-card">
          <span className="ahoy-viz-stat-label">SAMPLING</span>
          <span className="ahoy-viz-stat-value">44.1 kHz</span>
        </div>
        <div className="ahoy-viz-stat-card">
          <span className="ahoy-viz-stat-label">STATUS</span>
          <span className="ahoy-viz-stat-value">{isPlaying ? "ACTIVE" : "PAUSED"}</span>
        </div>
        <div className="ahoy-viz-stat-card">
          <span className="ahoy-viz-stat-label">PEAK LEVEL</span>
          <span className="ahoy-viz-stat-value">{isPlaying ? "-4.2 dB" : "-∞ dB"}</span>
        </div>
      </div>
    </div>
  );
};
