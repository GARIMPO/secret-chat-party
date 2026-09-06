import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<{ url: string; preview: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchGifs(query);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ customer_id: "chat-app" });
      if (q.trim()) params.set("q", q.trim());

      const { data, error: fnError } = await supabase.functions.invoke(`klipy-gifs?${params}`, {
        method: "GET",
      });

      if (fnError) throw fnError;
      setGifs(data?.gifs ?? []);
    } catch {
      setGifs([]);
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 w-72 sm:w-80 max-h-96 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
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
        ) : error ? (
          <p className="text-center text-xs text-muted-foreground py-8">Não foi possível carregar os GIFs.</p>
        ) : gifs.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">Nenhum GIF encontrado.</p>
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
        <span className="text-[10px] text-muted-foreground">Powered by Klipy</span>
      </div>
    </div>
  );
}
