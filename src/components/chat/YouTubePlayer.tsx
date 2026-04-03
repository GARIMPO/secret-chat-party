import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, X, Send, ChevronDown, ChevronUp } from "lucide-react";

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  onSubmitLink: (videoId: string) => void;
  onTogglePlay: () => void;
  onClose: () => void;
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

export default function YouTubePlayer({ videoId, isPlaying, onSubmitLink, onTogglePlay, onClose }: YouTubePlayerProps) {
  const [linkInput, setLinkInput] = useState("");
  const [minimized, setMinimized] = useState(false);

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
    <div className="border-b border-border bg-black">
      {/* Header bar */}
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
      {/* Video - smaller on desktop, full on mobile */}
      {!minimized && (
        <div className="flex justify-center bg-black">
          <div className="w-full sm:max-w-[50%] lg:max-w-[40%]">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title="YouTube player"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
