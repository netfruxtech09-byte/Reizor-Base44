import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, ChevronUp, Music } from "lucide-react";

export default function ArtistMusicPlayer({ tracks }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [collapsed, setCollapsed] = useState(false);
  const audioRef = useRef(null);

  const current = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = current?.url || "";
    audio.volume = volume;
    audio.muted = muted;
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [currentIndex, current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
    setDuration(audio.duration || 0);
  };

  const handleEnded = () => {
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPlaying(true);
    } else {
      setPlaying(false);
      setProgress(0);
    }
  };

  const handleSeek = (e) => {
    const ratio = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
    const newTime = ratio * duration;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;

  if (!tracks.length) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60 shadow-2xl transition-all">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleTimeUpdate}
      />

      {/* Progress bar — always visible */}
      <div
        className="w-full h-1 bg-border/50 cursor-pointer group"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-primary transition-all relative"
          style={{ width: `${progressPct}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Collapsed view */}
      {collapsed ? (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Music className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{current?.title || "Track"}</p>
          </div>
          <button onClick={() => setPlaying((v) => !v)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            {playing ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>
          <button onClick={() => setCollapsed(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 ${playing ? "animate-pulse" : ""}`}>
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{current?.title || `Track ${currentIndex + 1}`}</p>
              <p className="text-xs font-mono text-muted-foreground">
                {fmt(progress)} / {fmt(duration)}
                <span className="ml-2 text-primary">· {currentIndex + 1}/{tracks.length}</span>
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setPlaying(true); }}
              disabled={currentIndex === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-1"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setPlaying((v) => !v)}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
            >
              {playing
                ? <Pause className="w-4 h-4 text-white" />
                : <Play className="w-4 h-4 text-white ml-0.5" />}
            </button>

            <button
              onClick={() => { setCurrentIndex((i) => Math.min(tracks.length - 1, i + 1)); setPlaying(true); }}
              disabled={currentIndex === tracks.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-1"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Volume + Track list */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button onClick={() => setMuted((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="w-20 accent-primary cursor-pointer"
            />
          </div>

          {/* Track selector */}
          {tracks.length > 1 && (
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {tracks.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setPlaying(true); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground"}`}
                  title={t.title}
                />
              ))}
            </div>
          )}

          <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}