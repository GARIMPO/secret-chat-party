import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from "lucide-react";

interface DiceGameProps {
  onRoll: (result: number) => void;
  onClose: () => void;
}

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export default function DiceGame({ onRoll, onClose }: DiceGameProps) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [animValue, setAnimValue] = useState(0);

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);

    let count = 0;
    const interval = setInterval(() => {
      setAnimValue(Math.floor(Math.random() * 6));
      count++;
      if (count > 15) {
        clearInterval(interval);
        const final = Math.floor(Math.random() * 6) + 1;
        setResult(final);
        setAnimValue(final - 1);
        setRolling(false);
        onRoll(final);
      }
    }, 100);
  };

  const DiceIcon = DICE_ICONS[rolling ? animValue : result ? result - 1 : 0];

  return (
    <div className="w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">🎲 Jogo de Dado</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm px-1">✕</button>
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        <div className={`transition-transform ${rolling ? "animate-spin" : result ? "animate-bounce" : ""}`}>
          <DiceIcon className="h-20 w-20 text-primary" strokeWidth={1.5} />
        </div>
        {result && !rolling && (
          <p className="text-2xl font-bold text-foreground">Resultado: {result}</p>
        )}
        <Button
          onClick={handleRoll}
          disabled={rolling}
          className="w-full gap-2"
          size="lg"
        >
          🎲 {rolling ? "Rolando..." : "Rolar Dado"}
        </Button>
      </div>
    </div>
  );
}
