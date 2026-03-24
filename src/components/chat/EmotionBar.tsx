import { Button } from "@/components/ui/button";

const EMOTIONS = [
  { emoji: "❤️", label: "Coração" },
  { emoji: "😘", label: "Beijo" },
  { emoji: "😠", label: "Bravo" },
  { emoji: "😄", label: "Feliz" },
  { emoji: "🤔", label: "Dúvida" },
  { emoji: "👍", label: "Joia" },
];

interface EmotionBarProps {
  onSend: (emoji: string) => void;
}

export default function EmotionBar({ onSend }: EmotionBarProps) {
  return (
    <div className="flex gap-1">
      {EMOTIONS.map((e) => (
        <Button
          key={e.emoji}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-lg hover:scale-125 transition-transform"
          onClick={() => onSend(e.emoji)}
          title={e.label}
        >
          {e.emoji}
        </Button>
      ))}
    </div>
  );
}
