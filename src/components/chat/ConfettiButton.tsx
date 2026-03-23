import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";

interface ConfettiButtonProps {
  onSendConfetti: () => void;
}

export function fireConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export default function ConfettiButton({ onSendConfetti }: ConfettiButtonProps) {
  const handleClick = () => {
    fireConfetti();
    onSendConfetti();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="text-muted-foreground hover:text-foreground"
      title="Enviar confetes 🎉"
    >
      <PartyPopper className="h-5 w-5" />
    </Button>
  );
}
