import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, X, Play, Pause, Send } from "lucide-react";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(linkInput.trim());
    if (id) {
      onSubmitLink(id);
      setLinkInput("");
    }
  };

  return (
    <div className="border-b border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Music className="h-4 w-4 text-primary shrink-0" />
        {videoId ? (
          <>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1`}
              className="w-48 h-12 rounded"
              allow="autoplay; encrypted-media"
              title="YouTube player"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </>
        ) : (
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
        )}
      </div>
    </div>
  );
}
