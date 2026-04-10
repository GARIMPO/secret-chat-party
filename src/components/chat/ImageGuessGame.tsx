import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImagePlus, Send, PartyPopper, X } from "lucide-react";

// Placeholder images for decoy cards
const DECOY_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1518173946687-a1e6f902bfa4?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=200&h=200&fit=crop",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface GuessGameData {
  id: string;
  sender: string;
  image: string; // the real image (compressed dataUrl)
  clue: string;
  decoys: string[]; // 5 decoy image URLs
  correctIndex: number; // index of real image in shuffled array
  cards: string[]; // shuffled array of 6 images
}

export interface GuessGameResult {
  gameId: string;
  guesser: string;
  correct: boolean;
  guessedIndex: number;
}

interface ImageGuessGameCreatorProps {
  open: boolean;
  onClose: () => void;
  onCreateGame: (image: string, clue: string) => void;
}

export function ImageGuessGameCreator({ open, onClose, onCreateGame }: ImageGuessGameCreatorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [clue, setClue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const canvas = document.createElement("canvas");
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const MAX = 300;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      setImage(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.src = url;
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!image || !clue.trim()) return;
    onCreateGame(image, clue.trim());
    setImage(null);
    setClue("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Jogo de Adivinhação
          </DialogTitle>
          <DialogDescription>
            Envie uma imagem e escreva uma dica. Os outros jogadores tentarão adivinhar qual é a sua carta!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {!image ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Escolher imagem</span>
            </button>
          ) : (
            <div className="relative w-full flex justify-center">
              <img src={image} alt="preview" className="max-h-32 rounded-lg object-contain" />
              <button
                onClick={() => setImage(null)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
              >
                <X className="h-4 w-4 text-destructive" />
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Escreva uma dica</label>
            <Input
              placeholder="Ex: Algo que brilha no céu..."
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              maxLength={100}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!image || !clue.trim()} className="w-full gap-2">
            <Send className="h-4 w-4" />
            Enviar Desafio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ImageGuessGamePopupProps {
  game: GuessGameData;
  nickname: string;
  onGuess: (gameId: string, index: number) => void;
  onClose: () => void;
}

export function ImageGuessGamePopup({ game, nickname, onGuess, onClose }: ImageGuessGamePopupProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);

  const isSender = game.sender === nickname;

  const handleSelect = (idx: number) => {
    if (selected !== null || isSender) return;
    setSelected(idx);
    const isCorrect = idx === game.correctIndex;
    setCorrect(isCorrect);
    setRevealed(true);
    onGuess(game.id, idx);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            {isSender ? "Seu desafio" : `Desafio de ${game.sender}`}
          </DialogTitle>
          <DialogDescription className="text-base font-medium mt-1">
            💡 Dica: "{game.clue}"
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {game.cards.map((cardImg, idx) => {
            const isCorrectCard = idx === game.correctIndex;
            const isSelected = selected === idx;
            let borderClass = "border-2 border-border";
            if (revealed && isCorrectCard) borderClass = "border-3 border-green-500 ring-2 ring-green-300";
            else if (revealed && isSelected && !correct) borderClass = "border-3 border-destructive ring-2 ring-red-300";
            else if (!revealed && !isSender) borderClass = "border-2 border-border hover:border-primary cursor-pointer";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                disabled={selected !== null || isSender}
                className={`relative rounded-xl overflow-hidden transition-all duration-300 ${borderClass} ${
                  !revealed && !isSender ? "hover:scale-105 active:scale-95" : ""
                }`}
                style={{ aspectRatio: "1" }}
              >
                {/* Card back (unrevealed) */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center transition-opacity duration-500 ${
                    revealed && (isCorrectCard || isSelected) ? "opacity-0" : isSender ? "opacity-0" : ""
                  }`}
                >
                  <span className="text-3xl">🃏</span>
                </div>
                {/* Card image */}
                <img
                  src={cardImg}
                  alt={`Carta ${idx + 1}`}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    !revealed && !isSender ? "opacity-0" : "opacity-100"
                  }`}
                  loading="lazy"
                />
                {revealed && isCorrectCard && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                )}
                {revealed && isSelected && !correct && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                    <span className="text-2xl">❌</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {isSender && (
          <p className="text-center text-sm text-muted-foreground">
            Aguardando alguém adivinhar sua carta...
          </p>
        )}

        {revealed && (
          <div className={`text-center text-lg font-bold animate-scale-in ${correct ? "text-green-500" : "text-destructive"}`}>
            {correct ? "🎉 Acertou! Parabéns!" : "😢 Errou! Tente na próxima."}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Confetti effect
export function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#ff0", "#f0f", "#0ff", "#f00", "#0f0", "#00f", "#ff8800", "#ff0088"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      w: number; h: number; color: string; rotation: number; rotSpeed: number;
    }[] = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let frame = 0;
    const maxFrames = 180;

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        onDone();
      }
    };

    animate();
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

// Helper to create a game
export function createGuessGame(sender: string, image: string, clue: string): GuessGameData {
  // Pick 5 random decoys
  const shuffledDecoys = shuffle(DECOY_IMAGES).slice(0, 5);
  // Create array of 6 cards, insert real image at random position
  const correctIndex = Math.floor(Math.random() * 6);
  const cards: string[] = [];
  let decoyIdx = 0;
  for (let i = 0; i < 6; i++) {
    if (i === correctIndex) {
      cards.push(image);
    } else {
      cards.push(shuffledDecoys[decoyIdx++]);
    }
  }

  return {
    id: crypto.randomUUID(),
    sender,
    image,
    clue,
    decoys: shuffledDecoys,
    correctIndex,
    cards,
  };
}
