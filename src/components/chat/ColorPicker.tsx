import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

const TEXT_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Vermelho", value: "#ef4444" },
  { label: "Laranja", value: "#f97316" },
  { label: "Amarelo", value: "#eab308" },
  { label: "Verde", value: "#22c55e" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Roxo", value: "#8b5cf6" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Branco", value: "#ffffff" },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="Cor do texto"
        >
          <Palette className="h-3.5 w-3.5" style={value ? { color: value } : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top">
        <div className="flex gap-1.5 flex-wrap max-w-[180px]">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.value || "default"}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c.value ? "scale-125 border-primary" : "border-border"}`}
              style={{ backgroundColor: c.value || "hsl(var(--foreground))" }}
              onClick={() => onChange(c.value)}
              title={c.label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
