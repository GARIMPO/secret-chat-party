import { useEffect, useState } from "react";

interface EmotionEvent {
  emoji: string;
  id: string;
  sender?: string;
}

interface EmotionOverlayProps {
  emotion: EmotionEvent | null;
}

export default function EmotionOverlay({ emotion }: EmotionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState("");
  const [currentSender, setCurrentSender] = useState("");

  useEffect(() => {
    if (emotion) {
      setCurrentEmoji(emotion.emoji);
      setCurrentSender(emotion.sender || "");
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [emotion]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center">
        <div className="text-[120px] animate-emotion-pop">
          {currentEmoji}
        </div>
        {currentSender && (
          <p className="text-sm font-semibold text-foreground bg-background/80 px-3 py-1 rounded-full mt-1">
            {currentSender}
          </p>
        )}
      </div>
    </div>
  );
}
