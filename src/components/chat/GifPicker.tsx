import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image, Search, X } from "lucide-react";

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

export default function GifPicker({ onSelect }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Load trending on open
    fetchGifs("");
  }, [open]);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const urls = (data.results || []).map((r: any) => r.media_formats?.tinygif?.url).filter(Boolean);
      setResults(urls);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGifs(query);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground"
        title="Enviar GIF"
      >
        <Image className="h-5 w-5" />
      </Button>
      {open && (
        <div className="absolute bottom-12 left-0 z-50 rounded-xl bg-surface border border-border shadow-lg w-[300px] max-h-[360px] flex flex-col">
          <form onSubmit={handleSearch} className="flex gap-1 p-2 border-b border-border">
            <Input
              placeholder="Buscar GIFs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
            <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0">
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
          <div className="overflow-y-auto flex-1 p-2 grid grid-cols-2 gap-1.5">
            {loading && <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Carregando...</p>}
            {!loading && results.length === 0 && <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Nenhum GIF encontrado</p>}
            {results.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onSelect(url); setOpen(false); }}
                className="rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all active:scale-[0.95]"
              >
                <img src={url} alt="GIF" className="w-full h-auto object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground text-center py-1 border-t border-border">Powered by Tenor</p>
        </div>
      )}
    </div>
  );
}
