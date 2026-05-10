import { useEffect, useMemo, useState } from "react";
import { Book, Copy, X, Search, BookOpen, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface Verse { n: string; text: string }
interface Chapter { label: string; verses: Verse[] }
interface SubBook { name: string; chapters: Chapter[] }
interface HolyBook { id: string; name: string; subbooks: SubBook[] }

interface Props { onClose: () => void }

export default function ScriptureReader({ onClose }: Props) {
  const [data, setData] = useState<HolyBook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [subIdx, setSubIdx] = useState<number | null>(null);
  const [chapIdx, setChapIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    import("@/data/scriptures.json")
      .then((mod) => {
        if (mounted) setData((mod.default || mod) as HolyBook[]);
      })
      .catch(() => toast.error("Erro ao carregar escrituras"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const book = useMemo(() => data?.find((b) => b.id === bookId) || null, [data, bookId]);
  const subbook = book && subIdx !== null ? book.subbooks[subIdx] : null;
  const chapter = subbook && chapIdx !== null ? subbook.chapters[chapIdx] : null;

  const filteredVerses = useMemo(() => {
    if (!chapter) return [];
    const q = search.trim().toLowerCase();
    if (!q) return chapter.verses;
    return chapter.verses.filter(
      (v) => v.text.toLowerCase().includes(q) || v.n.includes(q)
    );
  }, [chapter, search]);

  const filteredChapters = useMemo(() => {
    if (!subbook) return [];
    const q = search.trim().toLowerCase();
    if (!q) return subbook.chapters.map((c, i) => ({ c, i }));
    return subbook.chapters
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.label.toLowerCase().includes(q));
  }, [subbook, search]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Versículo copiado!"),
      () => toast.error("Falha ao copiar")
    );
  };

  const goBack = () => {
    if (chapIdx !== null) { setChapIdx(null); setSearch(""); return; }
    if (subIdx !== null) { setSubIdx(null); setSearch(""); return; }
    if (bookId) { setBookId(null); setSearch(""); return; }
  };

  const breadcrumb = [
    book?.name,
    subbook?.name,
    chapter?.label,
  ].filter(Boolean).join(" › ");

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-6xl h-full max-h-[95vh] md:max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b flex items-center gap-3 bg-card">
          {(bookId || subIdx !== null || chapIdx !== null) && (
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground tracking-tight truncate">
              {breadcrumb || "Biblioteca de Escrituras"}
            </h2>
            {chapter && (
              <p className="text-xs md:text-sm text-primary font-medium">
                Toque em um versículo para copiar tudo
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        {(subbook || chapter) && (
          <div className="px-4 md:px-6 py-3 bg-muted/30 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder={
                  chapter
                    ? "Buscar palavra-chave ou versículo (ex: 1)..."
                    : "Buscar capítulo..."
                }
                className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {loading && (
            <div className="text-center py-20 text-muted-foreground">
              Carregando escrituras...
            </div>
          )}

          {!loading && !book && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 h-full items-center">
              {data.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBookId(b.id)}
                  className="group cursor-pointer p-8 md:p-10 bg-card border-2 hover:border-primary rounded-3xl shadow-sm hover:shadow-xl text-center transition-all flex flex-col items-center"
                >
                  <BookOpen
                    className="mb-4 text-primary group-hover:scale-110 transition-transform"
                    size={48}
                  />
                  <h3 className="text-base md:text-lg font-bold text-foreground">
                    {b.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    {b.subbooks.length} {b.subbooks.length === 1 ? "livro" : "livros"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {!loading && book && subIdx === null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {book.subbooks.map((sb, i) => (
                <button
                  key={i}
                  onClick={() => setSubIdx(i)}
                  className="text-left p-4 bg-card border hover:border-primary rounded-xl transition-all hover:shadow-md flex items-center gap-3"
                >
                  <Book className="text-primary shrink-0" size={20} />
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{sb.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sb.chapters.length} {sb.chapters.length === 1 ? "capítulo" : "capítulos"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && subbook && chapIdx === null && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {filteredChapters.map(({ c, i }) => (
                <button
                  key={i}
                  onClick={() => { setChapIdx(i); setSearch(""); }}
                  className="px-3 py-3 bg-card border hover:border-primary hover:bg-primary/5 rounded-lg text-sm font-medium text-foreground transition-all"
                >
                  {c.label.replace(/^Capítulo\s+/, "Cap. ").replace(/^Seção\s+/, "§ ")}
                </button>
              ))}
              {filteredChapters.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
                  Nenhum capítulo encontrado.
                </div>
              )}
            </div>
          )}

          {!loading && chapter && (
            <div className="max-w-4xl mx-auto space-y-3">
              {filteredVerses.length > 0 ? (
                filteredVerses.map((v, idx) => (
                  <div
                    key={idx}
                    onClick={() => copy(v.text)}
                    className="group relative p-4 md:p-5 bg-card border rounded-2xl hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 block">
                      Versículo {v.n}
                    </span>
                    <p className="text-base md:text-lg leading-relaxed text-foreground select-text">
                      {v.text}
                    </p>
                    <Copy
                      size={16}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  Nenhum resultado encontrado{search ? ` para "${search}"` : ""}.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
