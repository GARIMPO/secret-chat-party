import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, Check } from "lucide-react";

export interface RoomTheme {
  id: string;
  label: string;
  /** HSL triplets without hsl() wrapper */
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  bubbleSelf: string;
  bubbleSelfFg: string;
  bubbleOther: string;
  bubbleOtherFg: string;
  surface: string;
}

export const ROOM_THEMES: RoomTheme[] = [
  {
    id: "default",
    label: "Padrão (Verde)",
    background: "220 20% 97%",
    foreground: "220 25% 10%",
    primary: "160 60% 38%",
    primaryForeground: "0 0% 100%",
    accent: "160 50% 94%",
    accentForeground: "160 60% 28%",
    bubbleSelf: "160 55% 42%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "220 14% 94%",
    bubbleOtherFg: "220 25% 10%",
    surface: "0 0% 100%",
  },
  {
    id: "ocean",
    label: "Oceano",
    background: "210 40% 97%",
    foreground: "215 30% 12%",
    primary: "210 85% 50%",
    primaryForeground: "0 0% 100%",
    accent: "210 70% 94%",
    accentForeground: "210 80% 30%",
    bubbleSelf: "210 80% 52%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "210 25% 94%",
    bubbleOtherFg: "215 30% 12%",
    surface: "0 0% 100%",
  },
  {
    id: "sunset",
    label: "Pôr do Sol",
    background: "30 40% 97%",
    foreground: "20 30% 12%",
    primary: "16 85% 55%",
    primaryForeground: "0 0% 100%",
    accent: "30 80% 94%",
    accentForeground: "16 80% 35%",
    bubbleSelf: "16 85% 55%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "30 30% 94%",
    bubbleOtherFg: "20 30% 12%",
    surface: "0 0% 100%",
  },
  {
    id: "lavender",
    label: "Lavanda",
    background: "270 30% 97%",
    foreground: "270 25% 12%",
    primary: "270 70% 55%",
    primaryForeground: "0 0% 100%",
    accent: "270 60% 94%",
    accentForeground: "270 70% 35%",
    bubbleSelf: "270 65% 58%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "270 20% 94%",
    bubbleOtherFg: "270 25% 12%",
    surface: "0 0% 100%",
  },
  {
    id: "rose",
    label: "Rosa",
    background: "340 40% 97%",
    foreground: "340 25% 12%",
    primary: "340 75% 55%",
    primaryForeground: "0 0% 100%",
    accent: "340 70% 94%",
    accentForeground: "340 75% 35%",
    bubbleSelf: "340 75% 58%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "340 25% 94%",
    bubbleOtherFg: "340 25% 12%",
    surface: "0 0% 100%",
  },
  {
    id: "midnight",
    label: "Meia-noite",
    background: "222 47% 11%",
    foreground: "210 40% 98%",
    primary: "200 95% 60%",
    primaryForeground: "222 47% 11%",
    accent: "217 33% 22%",
    accentForeground: "210 40% 98%",
    bubbleSelf: "200 90% 50%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "217 33% 20%",
    bubbleOtherFg: "210 40% 98%",
    surface: "222 47% 14%",
  },
  {
    id: "forest",
    label: "Floresta",
    background: "140 20% 96%",
    foreground: "140 30% 12%",
    primary: "140 60% 32%",
    primaryForeground: "0 0% 100%",
    accent: "140 40% 92%",
    accentForeground: "140 60% 22%",
    bubbleSelf: "140 55% 35%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "140 15% 92%",
    bubbleOtherFg: "140 30% 12%",
    surface: "0 0% 100%",
  },
  {
    id: "gold",
    label: "Dourado",
    background: "45 50% 96%",
    foreground: "30 30% 12%",
    primary: "40 85% 48%",
    primaryForeground: "0 0% 100%",
    accent: "45 75% 92%",
    accentForeground: "30 70% 28%",
    bubbleSelf: "40 80% 50%",
    bubbleSelfFg: "0 0% 100%",
    bubbleOther: "45 30% 92%",
    bubbleOtherFg: "30 30% 12%",
    surface: "0 0% 100%",
  },
];

export function applyRoomTheme(theme: RoomTheme) {
  const root = document.documentElement;
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.primaryForeground);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-foreground", theme.accentForeground);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--chat-bubble-self", theme.bubbleSelf);
  root.style.setProperty("--chat-bubble-self-foreground", theme.bubbleSelfFg);
  root.style.setProperty("--chat-bubble-other", theme.bubbleOther);
  root.style.setProperty("--chat-bubble-other-foreground", theme.bubbleOtherFg);
  root.style.setProperty("--surface", theme.surface);
}

export function resetRoomTheme() {
  const root = document.documentElement;
  [
    "--background",
    "--foreground",
    "--primary",
    "--primary-foreground",
    "--accent",
    "--accent-foreground",
    "--ring",
    "--chat-bubble-self",
    "--chat-bubble-self-foreground",
    "--chat-bubble-other",
    "--chat-bubble-other-foreground",
    "--surface",
  ].forEach((p) => root.style.removeProperty(p));
}

interface RoomThemePickerProps {
  room: string;
}

export default function RoomThemePicker({ room }: RoomThemePickerProps) {
  const storageKey = `chat-theme-${room}`;
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || "default";
    } catch {
      return "default";
    }
  });

  useEffect(() => {
    const t = ROOM_THEMES.find((x) => x.id === themeId) || ROOM_THEMES[0];
    applyRoomTheme(t);
    try {
      localStorage.setItem(storageKey, themeId);
    } catch {}
    return () => {
      // Reset on unmount so theme doesn't leak to other pages
      resetRoomTheme();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Tema da sala" className="h-8 w-8">
          <Palette className="h-4 w-4 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="bottom" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Tema da sala</p>
        <div className="grid grid-cols-2 gap-2">
          {ROOM_THEMES.map((t) => {
            const selected = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={`relative flex flex-col items-stretch rounded-lg border-2 overflow-hidden transition-all ${
                  selected ? "border-primary scale-[1.02]" : "border-border hover:border-muted-foreground/50"
                }`}
                title={t.label}
              >
                <div className="flex h-8">
                  <div className="flex-1" style={{ background: `hsl(${t.background})` }} />
                  <div className="flex-1" style={{ background: `hsl(${t.primary})` }} />
                  <div className="flex-1" style={{ background: `hsl(${t.bubbleSelf})` }} />
                </div>
                <div className="px-2 py-1 text-[10px] font-medium text-foreground bg-card flex items-center justify-between">
                  <span className="truncate">{t.label}</span>
                  {selected && <Check className="h-3 w-3 text-primary shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
