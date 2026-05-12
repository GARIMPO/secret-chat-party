import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BookOpen,
  Search,
  Copy,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Volume = {
  name: string;
  books: { name: string; slug: string; file: string; chapterCount: number }[];
};

type Manifest = { volumes: Volume[] };

type BookData = {
  name: string;
  slug: string;
  volume: string;
  chapters: { n: number; verses: string[] }[];
};

type View =
  | { type: "books" }
  | { type: "chapters"; book: BookData }
  | { type: "chapter"; book: BookData; chapter: number }
  | { type: "search"; query: string };

const BASE = "/scriptures";

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/${path}`);
  if (!r.ok) throw new Error(`Falha ao carregar ${path}`);
  return r.json();
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ScripturesReader({ open, onOpenChange }: Props) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cache, setCache] = useState<Record<string, BookData>>({});
  const [view, setView] = useState<View>({ type: "books" });
  const [loadingBook, setLoadingBook] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { book: string; bookSlug: string; chapter: number; verse: number; text: string }[]
  >([]);

  // Load manifest on first open
  useEffect(() => {
    if (!open || manifest) return;
    fetchJson<Manifest>("manifest.json")
      .then(setManifest)
      .catch(() =>
        toast({
          title: "Erro",
          description: "Não foi possível carregar as escrituras.",
          variant: "destructive",
        }),
      );
  }, [open, manifest]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setView({ type: "books" });
      setQuery("");
      setSearchResults([]);
    }
  }, [open]);

  async function loadBook(slug: string, file: string): Promise<BookData> {
    if (cache[slug]) return cache[slug];
    setLoadingBook(slug);
    try {
      const data = await fetchJson<BookData>(file);
      setCache((c) => ({ ...c, [slug]: data }));
      return data;
    } finally {
      setLoadingBook(null);
    }
  }

  async function openBook(slug: string, file: string) {
    try {
      const data = await loadBook(slug, file);
      // Single-chapter books skip directly to chapter view
      if (data.chapters.length === 1) {
        setView({ type: "chapter", book: data, chapter: data.chapters[0].n });
      } else {
        setView({ type: "chapters", book: data });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar livro.", variant: "destructive" });
    }
  }

  async function runSearch(q: string) {
    const term = q.trim().toLowerCase();
    if (!term || term.length < 3 || !manifest) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // Load all books on demand (cached)
      const allBooks: BookData[] = [];
      for (const vol of manifest.volumes) {
        for (const b of vol.books) {
          const data = cache[b.slug] ?? (await fetchJson<BookData>(b.file));
          if (!cache[b.slug]) {
            setCache((c) => ({ ...c, [b.slug]: data }));
          }
          allBooks.push(data);
        }
      }
      const results: typeof searchResults = [];
      for (const book of allBooks) {
        for (const chap of book.chapters) {
          for (let i = 0; i < chap.verses.length; i++) {
            const v = chap.verses[i];
            if (v.toLowerCase().includes(term)) {
              results.push({
                book: book.name,
                bookSlug: book.slug,
                chapter: chap.n,
                verse: i + 1,
                text: v,
              });
              if (results.length >= 300) break;
            }
          }
          if (results.length >= 300) break;
        }
        if (results.length >= 300) break;
      }
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  // Debounced search trigger
  useEffect(() => {
    if (view.type !== "search") return;
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, view.type]);

  function copyVerse(reference: string, text: string) {
    const payload = `${reference} — ${text}`;
    navigator.clipboard.writeText(payload).then(
      () => toast({ title: "Copiado", description: reference }),
      () =>
        toast({
          title: "Erro",
          description: "Não foi possível copiar.",
          variant: "destructive",
        }),
    );
  }

  const highlight = (text: string, term: string) => {
    if (!term) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">
          {text.slice(idx, idx + term.length)}
        </mark>
        {text.slice(idx + term.length)}
      </>
    );
  };

  const headerTitle = useMemo(() => {
    switch (view.type) {
      case "books":
        return "Escrituras";
      case "chapters":
        return view.book.name;
      case "chapter":
        return `${view.book.name} ${view.chapter}`;
      case "search":
        return "Buscar";
    }
  }, [view]);

  const showBack = view.type !== "books";

  function back() {
    if (view.type === "chapter") {
      const book = view.book;
      if (book.chapters.length === 1) setView({ type: "books" });
      else setView({ type: "chapters", book });
    } else {
      setView({ type: "books" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          "w-screen h-[100dvh] max-w-none rounded-none",
          "sm:w-[85vw] sm:h-[85vh] sm:max-w-[1100px] sm:rounded-xl",
        )}
        style={{ userSelect: "text" }}
      >
        <DialogHeader className="px-4 py-3 border-b flex-row items-center gap-2 space-y-0">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={back}
              aria-label="Voltar"
              className="h-9 w-9 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="h-9 w-9 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
          )}
          <DialogTitle className="flex-1 text-base sm:text-lg truncate">
            {headerTitle}
          </DialogTitle>
          {view.type !== "search" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buscar"
              className="h-9 w-9 shrink-0"
              onClick={() => setView({ type: "search", query: "" })}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
        </DialogHeader>

        {view.type === "search" && (
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar palavra-chave em todas as escrituras…"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {searching
                ? "Buscando…"
                : query.trim().length < 3
                  ? "Digite ao menos 3 letras."
                  : `${searchResults.length} resultado(s)${searchResults.length >= 300 ? " (limitado a 300)" : ""}`}
            </p>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 sm:p-6" style={{ userSelect: "text" }}>
            {/* Books view */}
            {view.type === "books" && (
              <div className="space-y-6">
                {!manifest && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando…
                  </div>
                )}
                {manifest?.volumes.map((vol) => (
                  <div key={vol.name}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {vol.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {vol.books.map((b) => (
                        <button
                          key={b.slug}
                          onClick={() => openBook(b.slug, b.file)}
                          disabled={loadingBook === b.slug}
                          className={cn(
                            "text-left rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors",
                            "px-3 py-3 flex items-center justify-between gap-2 active:scale-[0.98]",
                            loadingBook === b.slug && "opacity-60",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{b.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.chapterCount > 1
                                ? `${b.chapterCount} capítulos`
                                : "1 capítulo"}
                            </div>
                          </div>
                          {loadingBook === b.slug ? (
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chapters grid */}
            {view.type === "chapters" && (
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {view.book.chapters.map((c) => (
                  <button
                    key={c.n}
                    onClick={() =>
                      setView({ type: "chapter", book: view.book, chapter: c.n })
                    }
                    className="aspect-square rounded-lg border border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors font-medium text-sm active:scale-95"
                  >
                    {c.n}
                  </button>
                ))}
              </div>
            )}

            {/* Verses */}
            {view.type === "chapter" && (
              <ChapterView
                book={view.book}
                chapter={view.chapter}
                onCopy={copyVerse}
              />
            )}

            {/* Search results */}
            {view.type === "search" && (
              <div className="space-y-2">
                {searchResults.map((r, i) => {
                  const ref = `${r.book} ${r.chapter}:${r.verse}`;
                  return (
                    <button
                      key={i}
                      onClick={() => copyVerse(ref, r.text)}
                      className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent transition-colors p-3 group"
                      style={{ userSelect: "text" }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-primary">
                          {ref}
                        </span>
                        <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <p
                        className="text-sm leading-relaxed text-foreground/90"
                        style={{ userSelect: "text" }}
                        onClick={(e) => {
                          // Allow text selection without triggering copy
                          if (window.getSelection()?.toString()) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {highlight(r.text, query.trim())}
                      </p>
                    </button>
                  );
                })}
                {!searching && query.trim().length >= 3 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum resultado para "{query}".
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ChapterView({
  book,
  chapter,
  onCopy,
}: {
  book: BookData;
  chapter: number;
  onCopy: (ref: string, text: string) => void;
}) {
  const chap = book.chapters.find((c) => c.n === chapter);
  if (!chap) return <p className="text-muted-foreground">Capítulo não encontrado.</p>;

  return (
    <div className="max-w-3xl mx-auto" style={{ userSelect: "text" }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">
        {book.name} {chapter}
      </h2>
      <div className="space-y-2">
        {chap.verses.map((text, i) => {
          const n = i + 1;
          const ref = `${book.name} ${chapter}:${n}`;
          return (
            <p
              key={n}
              className="text-[15px] sm:text-base leading-relaxed text-foreground/90 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent cursor-pointer transition-colors"
              style={{ userSelect: "text" }}
              onClick={(e) => {
                // Don't copy if user is selecting text
                const sel = window.getSelection()?.toString();
                if (sel && sel.length > 0) return;
                e.preventDefault();
                onCopy(ref, text);
              }}
              title="Clique para copiar — ou selecione parte do texto"
            >
              <sup className="text-primary font-semibold mr-1.5 select-none">
                {n}
              </sup>
              {text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
