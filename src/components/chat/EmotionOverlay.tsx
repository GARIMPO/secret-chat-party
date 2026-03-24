import { useEffect, useState } from "react";

interface EmotionEvent {
  emoji: string;
  id: string;
}

interface EmotionOverlayProps {
  emotion: EmotionEvent | null;
}

export default function EmotionOverlay({ emotion }: EmotionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState("");

  useEffect(() => {
    if (emotion) {
      setCurrentEmoji(emotion.emoji);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [emotion]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="text-[120px] animate-emotion-pop">
        {currentEmoji}
      </div>
    </div>
  );
}
