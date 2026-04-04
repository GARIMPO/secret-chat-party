import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const EMOTION_CATEGORIES = [
  {
    label: "Rostos",
    emojis: [
      { emoji: "😄", label: "Feliz" },
      { emoji: "😂", label: "Chorando de rir" },
      { emoji: "🥰", label: "Apaixonado" },
      { emoji: "😘", label: "Beijo" },
      { emoji: "😎", label: "Legal" },
      { emoji: "🤩", label: "Deslumbrado" },
      { emoji: "😱", label: "Chocado" },
      { emoji: "😡", label: "Bravo" },
      { emoji: "😭", label: "Triste" },
      { emoji: "🤔", label: "Pensativo" },
      { emoji: "🙄", label: "Revirando olhos" },
      { emoji: "🤡", label: "Palhaço" },
    ],
  },
  {
    label: "Gestos",
    emojis: [
      { emoji: "👍", label: "Joia" },
      { emoji: "👎", label: "Negativo" },
      { emoji: "👏", label: "Palmas" },
      { emoji: "🙏", label: "Oração" },
      { emoji: "💪", label: "Força" },
      { emoji: "🤝", label: "Aperto de mão" },
      { emoji: "✌️", label: "Paz" },
      { emoji: "🤙", label: "Hang loose" },
    ],
  },
  {
    label: "Corações",
    emojis: [
      { emoji: "❤️", label: "Coração" },
      { emoji: "💔", label: "Coração partido" },
      { emoji: "🔥", label: "Fogo" },
      { emoji: "💯", label: "100" },
      { emoji: "⭐", label: "Estrela" },
      { emoji: "🎉", label: "Festa" },
      { emoji: "💀", label: "Caveira" },
      { emoji: "🤯", label: "Mente explodindo" },
    ],
  },
];

interface EmotionBarProps {
  onSend: (emoji: string) => void;
}

export default function EmotionBar({ onSend }: EmotionBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
        >
          <span className="text-base leading-none">🎭</span>
          <span className="hidden sm:inline">Emoções</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute bottom-full left-0 right-0 mb-1 z-20">
        <div className="bg-popover border border-border rounded-lg shadow-lg p-2 mx-2 max-h-[260px] overflow-y-auto">
          {EMOTION_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-2 last:mb-0">
              <p className="text-[10px] font-medium text-muted-foreground px-1 mb-1">{cat.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((e) => (
                  <Button
                    key={e.emoji}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-lg hover:scale-125 transition-transform"
                    onClick={() => {
                      onSend(e.emoji);
                      setOpen(false);
                    }}
                    title={e.label}
                  >
                    {e.emoji}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
