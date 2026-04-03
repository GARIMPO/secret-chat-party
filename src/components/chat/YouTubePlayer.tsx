import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, X, Send, ChevronDown, ChevronUp } from "lucide-react";

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  onSubmitLink: (videoId: string) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  onSeek?: (time: number) => void;
  seekTo?: number | null;
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

// Load YT IFrame API once
let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyCallbacks: (() => void)[] = [];

function loadYTApi() {
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  (window as any).onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytReadyCallbacks.forEach((cb) => cb());
    ytReadyCallbacks.length = 0;
  };
}

function onYTReady(cb: () => void) {
  if (ytApiReady) cb();
  else ytReadyCallbacks.push(cb);
}

export default function YouTubePlayer({
  videoId,
  isPlaying,
  onSubmitLink,
  onTogglePlay,
  onClose,
  onSeek,
  seekTo,
}: YouTubePlayerProps) {
  const [linkInput, setLinkInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const lastSeekRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(linkInput.trim());
    if (id) {
      onSubmitLink(id);
      setLinkInput("");
    }
  };

  // Initialize YT player
  useEffect(() => {
    if (!videoId || minimized) return;
    loadYTApi();

    const initPlayer = () => {
      if (!containerRef.current) return;
      // Clear previous
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.id = "yt-player-" + Date.now();
      containerRef.current.appendChild(div);

      playerRef.current = new (window as any).YT.Player(div.id, {
        videoId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event: any) => {
            // Detect seek by polling current time
          },
        },
      });
    };

    onYTReady(initPlayer);

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId, minimized]);

  // Poll for seek changes to broadcast
  useEffect(() => {
    if (!videoId || minimized || !onSeek) return;

    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.getCurrentTime) return;
      try {
        const currentTime = p.getCurrentTime();
        const diff = Math.abs(currentTime - lastSeekRef.current);
        // If jumped more than 3 seconds, it's a seek
        if (diff > 3 && !seekingRef.current) {
          onSeek(currentTime);
        }
        lastSeekRef.current = currentTime;
      } catch {}
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [videoId, minimized, onSeek]);

  // Handle incoming seek from other user
  useEffect(() => {
    if (seekTo == null || !playerRef.current) return;
    try {
      seekingRef.current = true;
      playerRef.current.seekTo(seekTo, true);
      lastSeekRef.current = seekTo;
      setTimeout(() => { seekingRef.current = false; }, 2000);
    } catch {}
  }, [seekTo]);

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
    <div className="border-b border-border bg-black">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Assistindo juntos</span>
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
          <div className="w-full sm:max-w-[45%] lg:max-w-[35%]">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <div ref={containerRef} className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
