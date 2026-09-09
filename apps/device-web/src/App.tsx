import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyLibrary } from "@ahoy/player-core";
import { AhoyDial, useAhoyInput } from "@ahoy/player-ui-dial";
import { BrowserAudioPlaybackAdapter, BrowserFileImportAdapter, LocalStoragePersistenceAdapter } from "@ahoy/player-web-adapters";
import { useAhoyPlayer } from "@ahoy/player-react";
import { freeMusicPacks, type FreeMusicPack } from "./freePacks";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };
const fileImport = new BrowserFileImportAdapter();
const persistence = new LocalStoragePersistenceAdapter("ahoy-player:web:v1");
const playbackAdapter = new BrowserAudioPlaybackAdapter();

export function App() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [search, setSearch] = useState("");
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [workspaceView, setWorkspaceView] = useState<"library" | "customize">("library");
  const [accent, setAccent] = useState({ name: "Signal blue", hex: "#0a84ff", rgb: "10,132,255" });
  const [glass, setGlass] = useState(68);
  const [blur, setBlur] = useState(24);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [transferView, setTransferView] = useState<"past" | "new" | "send">("past");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const model = useAhoyPlayer({ initialLibrary: createEmptyLibrary(), fileImport, persistence, playbackAdapter });
  useAhoyInput(model.dispatchDial, { gamepad: true });
  useEffect(() => { const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); }; window.addEventListener("beforeinstallprompt", onBeforeInstall); return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall); }, []);
  const tracks = useMemo(() => model.library.tracks.filter((track) => { const term = search.trim().toLowerCase(); return !term || `${track.title} ${track.artistName} ${track.albumTitle}`.toLowerCase().includes(term); }), [model.library.tracks, search]);
  const currentIndex = model.library.tracks.findIndex((track) => track.id === model.nowPlaying?.id);
  const duration = model.playback.durationMs ?? model.nowPlaying?.durationMs ?? 0;
  const progress = duration ? Math.min(100, (model.playback.positionMs / duration) * 100) : 0;
  function playTrack(index: number) { const track = model.library.tracks[index]; if (!track) return; model.openScreen("library"); model.playTrack(track.id); }
  async function install() { if (!installEvent) return; await installEvent.prompt(); setInstallEvent(null); }
  function downloadPack(pack: FreeMusicPack) {
    const manifest = {
      schemaVersion: 1,
      kind: "ahoy-free-music-pack",
      generatedAt: new Date().toISOString(),
      pack
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ahoy-${pack.id}-pack.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const shellStyle = { "--user-accent": accent.hex, "--user-accent-rgb": accent.rgb, "--glass-opacity": glass / 100, "--glass-blur": `${blur}px` } as React.CSSProperties;
  return <main className={`app-shell theme-${theme} ${ambientGlow ? "has-ambient-glow" : ""} ${sidebarOpen ? "" : "sidebar-collapsed"} ${inspectorOpen ? "inspector-open" : ""}`} style={shellStyle}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><img src="/nautical-seagull-silkscreen.png" alt="Nautical seagull mark" /></span><span><strong>AHOY</strong><small>LOCAL PLAYER</small></span></div>
      <p className="sidebar-label">YOUR LIBRARY</p>
      <nav className="library-nav" aria-label="Library views">
        <NavButton active={model.navigation.screen === "library"} onClick={() => model.openScreen("library")} label="Library" count={model.library.tracks.length} />
        <NavButton active={model.navigation.screen === "artists"} onClick={() => model.openScreen("artists")} label="Artists" count={model.library.artists.length} />
        <NavButton active={model.navigation.screen === "albums"} onClick={() => model.openScreen("albums")} label="Albums" count={model.library.albums.length} />
        <NavButton active={model.navigation.screen === "imports"} onClick={() => model.openScreen("imports")} label="Recently added" count={model.library.imports.length} />
      </nav>
      <p className="sidebar-label sidebar-label--spaced">PLAYLISTS</p>
      <div className="playlist-links"><button type="button">◈  All music</button><button type="button">＋  New playlist</button><button type="button" className={workspaceView === "customize" ? "is-customize-active" : ""} onClick={() => setWorkspaceView("customize")}>⌘  Customize</button></div>
      <p className="sidebar-label sidebar-label--spaced transfers-label">TRANSFERS</p>
      <div className="transfer-links"><button className={transferView === "past" ? "is-active" : ""} type="button" onClick={() => setTransferView("past")}><span>↗  Past transfers</span><small>0</small></button><button className={transferView === "new" ? "is-active" : ""} type="button" onClick={() => setTransferView("new")}><span>＋  New transfer</span></button><button className={transferView === "send" ? "is-active" : ""} type="button" onClick={() => setTransferView("send")}><span>↑  Send</span></button></div>
      <div className="sidebar-footer"><span className="storage-dot" /><span>Local storage<br /><strong>{model.library.tracks.length} tracks ready</strong></span></div>
    </aside>
    <section className="workspace">
      <div className="desktop-menubar"><div className="app-menu">{["File", "Edit", "View", "Playback", "Window", "Help"].map((menu) => <div className="menu-anchor" key={menu}><button className={openMenu === menu ? "is-open" : ""} type="button" onClick={() => setOpenMenu(openMenu === menu ? null : menu)} aria-haspopup="menu" aria-expanded={openMenu === menu}>{menu}</button>{openMenu === menu && <MenuPopover menu={menu} onClose={() => setOpenMenu(null)} onImport={() => void model.importFiles()} onCustomize={() => { setWorkspaceView("customize"); setOpenMenu(null); }} onToggleSidebar={() => { setSidebarOpen(!sidebarOpen); setOpenMenu(null); }} onToggleInspector={() => { setInspectorOpen(!inspectorOpen); setOpenMenu(null); }} onToggleTheme={() => { setTheme(theme === "light" ? "dark" : "light"); setOpenMenu(null); }} onPrevious={model.previousTrack} onPlayPause={model.togglePlayback} onNext={model.nextTrack} />}</div>)}</div><span className="window-title">Ahoy Player</span><button className="inspector-button" type="button" onClick={() => setInspectorOpen(!inspectorOpen)} aria-pressed={inspectorOpen}>{inspectorOpen ? "Hide inspector" : "Inspector"}</button></div>
      <div className="desktop-toolbar"><div className="toolbar-group"><button type="button" onClick={() => model.dispatchDial({ type: "back", source: "pointer" })} aria-label="Back">‹</button><button type="button" onClick={() => model.openScreen("library")} aria-label="Forward">›</button><button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">▤</button></div><div className="toolbar-divider" /><div className="toolbar-group toolbar-playback"><button type="button" onClick={model.previousTrack} aria-label="Previous track">|◀</button><button type="button" onClick={model.togglePlayback} aria-label="Toolbar play pause">{model.playback.status === "playing" ? "Ⅱ" : "▶"}</button><button type="button" onClick={model.nextTrack} aria-label="Next track">▶|</button></div><div className="toolbar-status"><span className={model.playback.status === "playing" ? "is-live" : ""} />{model.playback.status === "playing" ? "Playing" : "Ready"}<b>{model.library.tracks.length} tracks</b></div></div>
      <header className="topbar"><div className="breadcrumbs"><span>{workspaceView === "customize" ? "AHOY" : "LIBRARY"}</span><b>/</b><strong>{workspaceView === "customize" ? "Customize" : model.navigation.screen === "home" ? "Overview" : model.navigation.screen}</strong></div><div className="topbar-actions">{workspaceView === "library" && <label className="search-box"><span>⌕</span><input aria-label="Search library" placeholder="Search your library" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>}<button className="appearance-button" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "○"}<span>{theme === "light" ? "Dark" : "Light"}</span></button>{workspaceView === "library" && <button className="outline-button" type="button" onClick={() => setWorkspaceView("customize")}>Customize</button>}{installEvent && <button className="outline-button" type="button" onClick={() => void install()}>Install app</button>}{workspaceView === "library" && <button className="import-button" type="button" onClick={() => void model.importFiles()}>{model.isImporting ? "Reading…" : "＋ Import music"}</button>}</div></header>
      {workspaceView === "customize" ? <CustomizeView theme={theme} accent={accent} setAccent={setAccent} glass={glass} setGlass={setGlass} blur={blur} setBlur={setBlur} ambientGlow={ambientGlow} setAmbientGlow={setAmbientGlow} onBack={() => setWorkspaceView("library")} /> : <><ClassicPlayer model={model} duration={duration} progress={progress} /><div className="content">
        {model.library.tracks.length > 0 && <FreePacks packs={freeMusicPacks} onDownload={downloadPack} />}
        <div className="section-head"><div><p className="eyebrow">COLLECTION</p><h2>{model.navigation.screen === "home" ? "All music" : titleCase(model.navigation.screen)}</h2></div><div className="view-tools"><span>{tracks.length} tracks</span><button className="view-button is-active" type="button" aria-label="List view">☷</button><button className="view-button" type="button" aria-label="Grid view">▦</button></div></div>
        <div className="track-table" aria-label="Music library"><div className="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span /></div>{tracks.map((track, index) => { const originalIndex = model.library.tracks.findIndex((item) => item.id === track.id); const isCurrent = track.id === model.nowPlaying?.id; return <button className={`track-row${isCurrent ? " is-current" : ""}`} type="button" key={track.id} onClick={() => playTrack(originalIndex)}><span className="track-number">{isCurrent && model.playback.status === "playing" ? <i className="equalizer"><b /><b /><b /></i> : String(index + 1).padStart(2, "0")}</span><span className="track-title"><span className="mini-art">{String(index + 1).padStart(2, "0")}</span><span><strong>{track.title}</strong><small>{track.artistName}</small></span></span><span className="track-album">{track.albumTitle}</span><span className="track-time">{formatTime(track.durationMs ?? 0)}</span><span className="track-more">•••</span></button>; })}{tracks.length === 0 && <div className="empty-state">{search ? `No music matches “${search}”.` : "No music in your library yet."}</div>}</div>
      </div></>}
    </section>
    <section className="player-deck" aria-label="Now playing"><div className="deck-track"><div className="deck-art">{model.nowPlaying ? "A" : "—"}</div><div><strong>{model.nowPlaying?.title ?? "Nothing playing"}</strong><span>{model.nowPlaying?.artistName ?? "Choose a track from your library"}</span></div><button className="heart-button" type="button" aria-label="Favorite">♡</button></div><div className="deck-controls"><div className="transport"><button type="button" onClick={model.previousTrack} aria-label="Previous">|◀</button><button className="play-button" type="button" onClick={model.togglePlayback} aria-label={model.playback.status === "playing" ? "Pause" : "Play"}>{model.playback.status === "playing" ? "Ⅱ" : "▶"}</button><button type="button" onClick={model.nextTrack} aria-label="Next">▶|</button></div><div className="scrubber"><div className="time-line"><span>{formatTime(model.playback.positionMs)}</span><input aria-label="Playback position" type="range" min="0" max={Math.max(1, duration)} value={Math.min(model.playback.positionMs, duration || 1)} onChange={(event) => model.seek(Number(event.target.value))} style={{ "--progress": `${progress}%` } as React.CSSProperties} /><span>{formatTime(duration)}</span></div><div className="waveform" aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 55)}%` }} />)}</div></div></div><div className="deck-tools"><button type="button" onClick={() => setIsQueueOpen(!isQueueOpen)} className={isQueueOpen ? "is-active" : ""}>☷ <span>Queue</span></button><label className="volume"><span>◖</span><input aria-label="Volume" type="range" min="0" max="100" value={Math.round(model.playback.volume * 100)} onChange={(event) => model.setVolume(Number(event.target.value) / 100)} /></label><button type="button" onClick={() => model.openScreen("now-playing")}>Expand ↗</button></div>{isQueueOpen && <div className="queue-popover"><strong>UP NEXT</strong><span>{Math.max(0, model.library.tracks.length - currentIndex - 1)} tracks in queue</span><button type="button" onClick={() => setIsQueueOpen(false)}>Close</button></div>}</section>
    <SynthKeyboard active={keyboardMode} isPlaying={model.playback.status === "playing"} onActiveChange={setKeyboardMode} />
    <div className="dial-dock"><AhoyDial dispatch={model.dispatchDial} isPlaying={model.playback.status === "playing"} size="compact" /></div>
    {inspectorOpen && <aside className="inspector-panel"><div><p className="eyebrow">INSPECTOR</p><h2>{model.nowPlaying?.title ?? "Library details"}</h2></div><dl><dt>Source</dt><dd>{model.nowPlaying?.source.kind === "local-file" ? "Local file" : "Ahoy library"}</dd><dt>Tracks in queue</dt><dd>{model.playback.queue.length}</dd><dt>Storage</dt><dd>On this device</dd></dl><button type="button" onClick={() => setInspectorOpen(false)}>Done</button></aside>}
  </main>;
}
function NavButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) { return <button className={`nav-button${active ? " is-active" : ""}`} type="button" onClick={onClick}><span>{label}</span><small>{count}</small></button>; }
function FreePacks({ packs, onDownload }: { packs: FreeMusicPack[]; onDownload: (pack: FreeMusicPack) => void }) {
  const [selectedPackId, setSelectedPackId] = useState(packs[0]?.id ?? "");
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? packs[0];
  if (!selectedPack) return null;
  return <section className="free-packs" aria-label="Free starter music packs">
    <div className="section-head free-packs__head"><div><p className="eyebrow">FREE STARTER PACKS</p><h2>Moods from open archives</h2></div><div className="view-tools"><span>{selectedPack.tracks.length} songs</span></div></div>
    <div className="pack-tabs" role="tablist" aria-label="Choose a mood pack">{packs.map((pack) => <button key={pack.id} className={pack.id === selectedPack.id ? "is-active" : ""} type="button" role="tab" aria-selected={pack.id === selectedPack.id} onClick={() => setSelectedPackId(pack.id)}>{pack.title}</button>)}</div>
    <div className="pack-detail">
      <div className="pack-summary"><span className="pack-art">{selectedPack.title.split(" ").map((word) => word[0]).join("")}</span><div><h3>{selectedPack.title}</h3><p>{selectedPack.description}</p><small>{selectedPack.mood}</small></div><button className="import-button" type="button" onClick={() => onDownload(selectedPack)}>↓ Pack manifest</button></div>
      <div className="pack-meta"><span>{selectedPack.runtime}</span>{selectedPack.sources.map((source) => <span key={source}>{source}</span>)}</div>
      <div className="pack-track-list">{selectedPack.tracks.map((track, index) => <a key={`${track.title}-${index}`} href={track.sourceUrl} target="_blank" rel="noreferrer"><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{track.title}</strong><small>{track.artist}</small></span><em>{track.license}</em></a>)}</div>
      <p className="pack-rights">Manifest download includes titles, source links, and license notes. Audio mirroring should happen only after item-level license snapshots are saved for each recording.</p>
    </div>
  </section>;
}
function MenuPopover({ menu, onClose, onImport, onCustomize, onToggleSidebar, onToggleInspector, onToggleTheme, onPrevious, onPlayPause, onNext }: { menu: string; onClose: () => void; onImport: () => void; onCustomize: () => void; onToggleSidebar: () => void; onToggleInspector: () => void; onToggleTheme: () => void; onPrevious: () => void; onPlayPause: () => void; onNext: () => void }) {
  const actions: Record<string, Array<[string, () => void]>> = {
    File: [["Import music", onImport], ["Customize player", onCustomize]],
    Edit: [["Customize player", onCustomize]],
    View: [["Toggle sidebar", onToggleSidebar], ["Toggle inspector", onToggleInspector], ["Switch appearance", onToggleTheme]],
    Playback: [["Previous track", onPrevious], ["Play / pause", onPlayPause], ["Next track", onNext]],
    Window: [["Toggle inspector", onToggleInspector], ["Customize player", onCustomize]],
    Help: [["Open inspector", onToggleInspector], ["Customize player", onCustomize]],
  };
  return <div className="menu-popover" role="menu" aria-label={`${menu} menu`}>{(actions[menu] ?? []).map(([label, action]) => <button key={label} type="button" role="menuitem" onClick={() => { action(); onClose(); }}>{label}</button>)}</div>;
}
function ClassicPlayer({ model, duration, progress }: { model: ReturnType<typeof useAhoyPlayer>; duration: number; progress: number }) { const currentIndex = model.library.tracks.findIndex((track) => track.id === model.nowPlaying?.id); const next = model.library.tracks.slice(Math.max(0, currentIndex + 1), currentIndex + 3); return <section className="classic-player" aria-label="Classic player"><div className="classic-screen"><div className="classic-time">{formatTime(model.playback.positionMs)}</div><div className="classic-signal"><span>{model.playback.status === "playing" ? "PLAYING" : model.playback.status.toUpperCase()}</span><small>{Math.round(progress)}% · {model.nowPlaying?.source.kind === "local-file" ? "LOCAL FILE" : "AHOY LIBRARY"}</small></div><div className="classic-meter">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ height: `${16 + ((index * 19) % 70)}%` }} />)}</div></div><div className="classic-art" aria-hidden="true">{model.nowPlaying ? <img src="/nautical-seagull-silkscreen.png" alt="" /> : "—"}</div><div className="classic-copy"><span className="classic-kicker">NOW PLAYING</span><strong>{model.nowPlaying?.title ?? "Nothing queued"}</strong><span>{model.nowPlaying?.artistName ?? "Choose a track from your library"}</span><small>{model.nowPlaying?.albumTitle ?? "Ahoy Player"}</small><div className="classic-buttons"><button type="button" onClick={model.previousTrack} aria-label="Classic previous">|◀</button><button type="button" onClick={model.togglePlayback} aria-label="Classic play pause">{model.playback.status === "playing" ? "Ⅱ" : "▶"}</button><button type="button" onClick={model.nextTrack} aria-label="Classic next">▶|</button><input aria-label="Classic seek" type="range" min="0" max={Math.max(1, duration)} value={Math.min(model.playback.positionMs, duration || 1)} onChange={(event) => model.seek(Number(event.target.value))} /></div></div><div className="classic-queue"><span>UP NEXT</span>{next.length ? next.map((track) => <button key={track.id} type="button" onClick={() => model.playTrack(track.id)}><b>{String((track.trackNumber ?? 0)).padStart(2, "0")}</b><span>{track.title}<small>{track.artistName}</small></span></button>) : <small>Queue is clear</small>}</div></section>; }
const synthKeys = ["q", "w", "e", "r", "u", "i", "o", "p", "a", "s", "d", "f", "j", "k", "l", ";"];
const midi = (value: number) => 440 * 2 ** ((value - 69) / 12);
const pianoLayout = [
  ["C", 60], ["D", 62], ["E", 64], ["G", 67], ["A", 69], ["C", 72], ["D", 74], ["E", 76],
  ["C", 48], ["D", 50], ["E", 52], ["G", 55], ["A", 57], ["C", 60], ["D", 62], ["E", 64]
] as const;
const indieChords = [
  ["Cadd9", [48, 52, 55, 62]], ["G", [43, 50, 55, 59]], ["Am7", [45, 52, 55, 60]], ["Fmaj7", [41, 48, 52, 57]],
  ["Em7", [40, 47, 50, 55]], ["Dm7", [38, 45, 48, 53]], ["Gsus4", [43, 50, 53, 55]], ["Cadd9", [48, 52, 55, 62]],
  ["Cadd9", [48, 52, 55, 62]], ["G", [43, 50, 55, 59]], ["Am7", [45, 52, 55, 60]], ["Fmaj7", [41, 48, 52, 57]],
  ["Em7", [40, 47, 50, 55]], ["Dm7", [38, 45, 48, 53]], ["Gsus4", [43, 50, 53, 55]], ["Cadd9", [48, 52, 55, 62]]
] as const;
type PianoVoice = { oscillators: OscillatorNode[]; gains: GainNode[] };

function SynthKeyboard({ active, isPlaying, onActiveChange }: { active: boolean; isPlaying: boolean; onActiveChange: (active: boolean) => void }) {
  const [cutoff, setCutoff] = useState(65);
  const [wobble, setWobble] = useState(28);
  const [playMode, setPlayMode] = useState<"notes" | "chords">("notes");
  const [held, setHeld] = useState<string[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const voices = useRef(new Map<string, PianoVoice>());
  const settings = useRef({ cutoff, wobble });
  settings.current = { cutoff, wobble };

  const releaseAll = useCallback(() => {
    const now = audioContext.current?.currentTime ?? 0;
    for (const voice of voices.current.values()) {
      for (const gain of voice.gains) { gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0.0001, now, 0.07); }
      for (const oscillator of voice.oscillators) oscillator.stop(now + 0.28);
    }
    voices.current.clear();
    setHeld([]);
  }, []);

  const playNote = useCallback((key: string) => {
    const index = synthKeys.indexOf(key);
    if (index < 0 || voices.current.has(key)) return;
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = audioContext.current ?? new Context();
    audioContext.current = context;
    void context.resume();
    const now = context.currentTime;
    const frequencies = playMode === "chords" ? indieChords[index][1].map(midi) : [midi(pianoLayout[index][1])];
    const voice: PianoVoice = { oscillators: [], gains: [] };
    for (const frequency of frequencies) {
      const filter = context.createBiquadFilter();
      const triangle = context.createOscillator();
      const sine = context.createOscillator();
      const brightGain = context.createGain();
      const bodyGain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(550 + settings.current.cutoff * 46, now);
      filter.Q.setValueAtTime(1.3, now);
      triangle.type = "triangle"; triangle.frequency.setValueAtTime(frequency, now);
      sine.type = "sine"; sine.frequency.setValueAtTime(frequency * 2, now);
      lfo.frequency.setValueAtTime(2 + settings.current.wobble / 20, now);
      lfoGain.gain.setValueAtTime(settings.current.wobble * 1.8, now);
      brightGain.gain.setValueAtTime(0.0001, now); brightGain.gain.exponentialRampToValueAtTime(0.075 / frequencies.length, now + 0.012); brightGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      bodyGain.gain.setValueAtTime(0.0001, now); bodyGain.gain.exponentialRampToValueAtTime(0.11 / frequencies.length, now + 0.018); bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      lfo.connect(lfoGain).connect(triangle.detune);
      triangle.connect(bodyGain).connect(filter).connect(context.destination);
      sine.connect(brightGain).connect(filter);
      triangle.start(now); sine.start(now); lfo.start(now);
      voice.oscillators.push(triangle, sine, lfo); voice.gains.push(brightGain, bodyGain);
    }
    voices.current.set(key, voice);
    setHeld((current) => current.includes(key) ? current : [...current, key]);
  }, [playMode]);

  const releaseNote = useCallback((key: string) => {
    const voice = voices.current.get(key);
    if (!voice || !audioContext.current) return;
    const now = audioContext.current.currentTime;
    for (const gain of voice.gains) { gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0.0001, now, 0.07); }
    for (const oscillator of voice.oscillators) oscillator.stop(now + 0.28);
    voices.current.delete(key);
    setHeld((current) => current.filter((heldKey) => heldKey !== key));
  }, []);

  useEffect(() => {
    if (!isPlaying && active) onActiveChange(false);
  }, [active, isPlaying, onActiveChange]);
  useEffect(() => {
    if (!active) { releaseAll(); return; }
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!synthKeys.includes(key) || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      playNote(key);
    };
    const up = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if (synthKeys.includes(key)) releaseNote(key); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", releaseAll); releaseAll(); };
  }, [active, playNote, releaseAll, releaseNote]);

  return <section className={`synth-keyboard${active ? " is-active" : ""}`} aria-label="Live keyboard synth">
    <div className="synth-keyboard__top"><div><p className="eyebrow">C MAJOR / A MINOR · INDIE OVERLAY</p><strong>Piano room</strong><span>{active ? playMode === "chords" ? "Theory-safe indie voicings: I, V, vi, IV and friends." : "Every key stays in C major / A minor, so melodies sit together." : isPlaying ? "Turn it on, then play along." : "Start a song to bring this to life."}</span></div><button type="button" className="synth-toggle" disabled={!isPlaying} aria-pressed={active} onClick={() => onActiveChange(!active)}>{active ? "End keyboard mode" : "Activate keyboard mode"}</button></div>
    <div className="synth-controls"><div className="play-mode" role="group" aria-label="Piano play mode"><button type="button" className={playMode === "notes" ? "is-selected" : ""} onClick={() => { releaseAll(); setPlayMode("notes"); }}>Notes</button><button type="button" className={playMode === "chords" ? "is-selected" : ""} onClick={() => { releaseAll(); setPlayMode("chords"); }}>Chords</button></div><label>TONE <input aria-label="Piano tone" type="range" min="10" max="100" value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))} /></label><label>WARMTH <input aria-label="Piano warmth" type="range" min="0" max="100" value={wobble} onChange={(event) => setWobble(Number(event.target.value))} /></label></div>
    <div className={`synth-keyboard__keys piano-keys ${playMode === "chords" ? "is-chord-mode" : ""}`} aria-label="Piano keys">{synthKeys.map((key, index) => <button type="button" key={key} className={`${index < 8 ? "is-high" : "is-low"}${held.includes(key) ? " is-held" : ""}`} onPointerDown={() => active && playNote(key)} onPointerUp={() => releaseNote(key)} onPointerLeave={() => releaseNote(key)}><b>{playMode === "chords" ? indieChords[index][0] : pianoLayout[index][0]}</b><small>{key === ";" ? ";" : key.toUpperCase()}</small></button>)}</div>
    <p className="synth-keyboard__hint"><kbd>Q W E R U I O P</kbd> · <kbd>A S D F J K L ;</kbd> · {playMode === "chords" ? "Cadd9 → G → Am7 → Fmaj7 is the familiar indie lift; every voicing belongs to C major / A minor." : "Notes use the C-major pentatonic (C D E G A), an especially forgiving indie overlay."}</p>
  </section>;
}
function CustomizeView({ theme, accent, setAccent, glass, setGlass, blur, setBlur, ambientGlow, setAmbientGlow, onBack }: { theme: "light" | "dark"; accent: { name: string; hex: string; rgb: string }; setAccent: (accent: { name: string; hex: string; rgb: string }) => void; glass: number; setGlass: (value: number) => void; blur: number; setBlur: (value: number) => void; ambientGlow: boolean; setAmbientGlow: (value: boolean) => void; onBack: () => void }) {
  const swatches = [{ name: "Signal blue", hex: "#0a84ff", rgb: "10,132,255" }, { name: "Deep ocean", hex: "#155eef", rgb: "21,94,239" }, { name: "Clear violet", hex: "#6e56cf", rgb: "110,86,207" }, { name: "Warm coral", hex: "#e05a47", rgb: "224,90,71" }];
  return <div className="customize-screen"><div className="customize-heading"><div><p className="eyebrow">PERSONALIZE AHOY</p><h1>Make it<br /><em>yours.</em></h1><p className="hero-copy">Tune the atmosphere around the music you own.</p></div><button className="outline-button" type="button" onClick={onBack}>← Back to library</button></div><div className="customize-grid"><section className="settings-card"><div className="card-heading"><div><p className="eyebrow">APPEARANCE</p><h2>Surface & signal</h2></div><span className="ownership-badge">LOCAL ONLY</span></div><label className="setting-label">Accent color<span>{accent.name}</span></label><div className="swatches">{swatches.map((swatch) => <button key={swatch.name} className={`swatch${accent.hex === swatch.hex ? " is-selected" : ""}`} style={{ background: swatch.hex }} aria-label={swatch.name} type="button" onClick={() => setAccent(swatch)} />)}<label className="custom-color"><input aria-label="Custom accent color" type="color" value={accent.hex} onChange={(event) => setAccent({ name: "Custom color", hex: event.target.value, rgb: "10,132,255" })} /><span>＋</span></label></div><RangeSetting label="Glass opacity" value={glass} min={35} max={88} suffix="%" onChange={setGlass} /><RangeSetting label="Glass blur" value={blur} min={8} max={42} suffix="px" onChange={setBlur} /><label className="toggle-setting"><span><strong>Ambient glow</strong><small>Let the active color softly enter the room.</small></span><input aria-label="Ambient glow" type="checkbox" checked={ambientGlow} onChange={(event) => setAmbientGlow(event.target.checked)} /><i /></label></section><section className="customize-preview"><p className="eyebrow">LIVE PREVIEW</p><div className="preview-window"><div className="preview-window__top"><span /><span /><span /></div><div className="preview-window__body"><div className="preview-orb" style={{ background: `radial-gradient(circle at 35% 30%, ${accent.hex}, rgba(${accent.rgb},.22) 22%, rgba(255,255,255,.34) 70%)` }} /><div><span className="preview-kicker">NOW PLAYING</span><strong>Paper Sail</strong><small>Harbor Lights · Night Ferry</small></div><button className="preview-play" style={{ background: accent.hex }} type="button">Ⅱ</button></div></div><div className="preview-note"><span className="storage-dot" /><span><strong>Your library stays yours.</strong><small>These choices are saved on this device.</small></span></div></section></div></div>;
}
function RangeSetting({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <label className="range-setting"><span><strong>{label}</strong><b>{value}{suffix}</b></span><input aria-label={label} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function titleCase(value: string) { return value.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatTime(milliseconds: number): string { const seconds = Math.floor(Math.max(0, milliseconds) / 1_000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
