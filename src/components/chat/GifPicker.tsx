import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<{ url: string; preview: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchGifs(query || "trending");
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q === "trending"
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(q)}&limit=20&media_filter=tinygif,gif`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      const results = (data.results || []).map((r: any) => ({
        url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || "",
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "",
      })).filter((g: any) => g.url);
      
      setGifs(results);
    } catch {
      setGifs([]);
    }
    setLoading(false);
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 w-80 max-h-96 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
      <div className="p-2 border-b border-border flex items-center gap-2">
        <Input
          placeholder="Buscar GIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-xs"
          autoFocus
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm px-1">✕</button>
      </div>
      <ScrollArea className="h-72">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground py-8">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-2">
            {gifs.map((gif, i) => (
              <img
                key={i}
                src={gif.preview}
                alt="GIF"
                className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  onSelect(gif.url);
                  onClose();
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="text-center py-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground">Powered by Tenor</span>
      </div>
    </div>
  );
}
