import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MOODS = [
  { emoji: "😃", label: "Feliz" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😥", label: "Triste" },
  { emoji: "😡", label: "Bravo" },
];

interface MoodPickerProps {
  currentMood: string | null;
  onSelect: (emoji: string) => void;
}

export default function MoodPicker({ currentMood, onSelect }: MoodPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          title="Meu humor"
        >
          <span className="text-base leading-none">{currentMood || "😃"}</span>
          <span className="hidden sm:inline">Humor</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top" align="start">
        <p className="text-xs text-muted-foreground mb-1.5 px-1">Meu humor</p>
        <div className="flex gap-1">
          {MOODS.map((m) => (
            <Button
              key={m.emoji}
              type="button"
              variant={currentMood === m.emoji ? "secondary" : "ghost"}
              size="sm"
              className="h-10 w-10 p-0 text-2xl hover:scale-110 transition-transform"
              onClick={() => {
                onSelect(m.emoji);
                setOpen(false);
              }}
              title={m.label}
            >
              {m.emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
