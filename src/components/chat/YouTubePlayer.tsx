import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, X, Send, ChevronDown, ChevronUp } from "lucide-react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  onSubmitLink: (videoId: string) => void;
  onTogglePlay: (playing: boolean) => void;
  onClose: () => void;
  onSeek?: (time: number) => void;
  seekTo?: number | null;
  onTimeUpdate?: (time: number) => void;
  initialTime?: number;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

let ytApiLoaded = false;
let ytApiReady = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYTApi(cb: () => void) {
  if (ytApiReady) { cb(); return; }
  ytApiCallbacks.push(cb);
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiCallbacks.forEach((fn) => fn());
    ytApiCallbacks.length = 0;
  };
}

export default function YouTubePlayer({
  videoId, isPlaying, onSubmitLink, onTogglePlay, onClose, onSeek, seekTo,
  onTimeUpdate, initialTime,
}: YouTubePlayerProps) {
  const [linkInput, setLinkInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeekRef = useRef<number>(0);
  const ignoreEventsRef = useRef(false);

  // Initialize YT player
  useEffect(() => {
    if (!videoId || minimized) return;
    loadYTApi(() => {
      if (!containerRef.current) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.id = "yt-player-" + Date.now();
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div.id, {
        videoId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          start: initialTime ? Math.floor(initialTime) : 0,
        },
        events: {
          onReady: () => {
            // If we have an initial time, seek to it
            if (initialTime && initialTime > 0) {
              playerRef.current?.seekTo(initialTime, true);
            }
            // Apply current play state
            if (!isPlaying) {
              playerRef.current?.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            if (ignoreEventsRef.current) return;
            const state = event.data;
            const currentTime = playerRef.current?.getCurrentTime?.() || 0;

            if (state === window.YT.PlayerState.PLAYING) {
              // User pressed play locally
              onTogglePlay(true);
              // Check for seek (time jump)
              if (Math.abs(currentTime - lastSeekRef.current) > 3) {
                onSeek?.(currentTime);
              }
              lastSeekRef.current = currentTime;
            } else if (state === window.YT.PlayerState.PAUSED) {
              onTogglePlay(false);
              // Check for seek
              if (Math.abs(currentTime - lastSeekRef.current) > 3) {
                onSeek?.(currentTime);
              }
              lastSeekRef.current = currentTime;
            }
          },
        },
      });

      // Periodically report current time for new user sync
      const interval = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          const t = playerRef.current.getCurrentTime();
          lastSeekRef.current = t;
          onTimeUpdate?.(t);
        }
      }, 3000);
      return () => clearInterval(interval);
    });

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId, minimized]);

  // Handle remote play/pause
  useEffect(() => {
    if (!playerRef.current?.getPlayerState) return;
    ignoreEventsRef.current = true;
    try {
      const state = playerRef.current.getPlayerState();
      if (isPlaying && state !== window.YT.PlayerState.PLAYING) {
        playerRef.current.playVideo();
      } else if (!isPlaying && state === window.YT.PlayerState.PLAYING) {
        playerRef.current.pauseVideo();
      }
    } catch {}
    setTimeout(() => { ignoreEventsRef.current = false; }, 1000);
  }, [isPlaying]);

  // Handle incoming seek
  useEffect(() => {
    if (seekTo != null && playerRef.current?.seekTo) {
      ignoreEventsRef.current = true;
      playerRef.current.seekTo(seekTo, true);
      lastSeekRef.current = seekTo;
      setTimeout(() => { ignoreEventsRef.current = false; }, 2000);
    }
  }, [seekTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(linkInput.trim());
    if (id) {
      onSubmitLink(id);
      setLinkInput("");
    }
  };

  if (!videoId) {
    return (
      <div className="border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary shrink-0" />
          <form onSubmit={handleSubmit} className="flex gap-2 flex-1 min-w-0">
            <Input
              placeholder="Cole link do YouTube..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button type="submit" size="sm" className="h-8" disabled={!linkInput.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border relative z-10 shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Assistindo juntos (sincronizado)</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(!minimized)}>
            {minimized ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {!minimized && (
        <div className="flex justify-center bg-black">
          <div className="w-full sm:max-w-[50%] lg:max-w-[40%]">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <div ref={containerRef} className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
