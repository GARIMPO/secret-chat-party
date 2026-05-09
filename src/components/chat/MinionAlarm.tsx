import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import minionGif from "@/assets/be-doo-be-doo-minion.gif";
import alarmMp3 from "@/assets/alarme.mp3";

interface MinionAlarmProps {
  from: string;
  onClose: () => void;
}

export default function MinionAlarm({ from, onClose }: MinionAlarmProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(alarmMp3);
    audio.loop = true;
    audio.volume = 1;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="text-center mb-4 px-4">
        <p className="text-white text-2xl font-bold drop-shadow-lg">
          🚨 Alarme de {from}!
        </p>
      </div>
      <img
        src={minionGif}
        alt="Be doo be doo"
        className="max-w-[90vw] max-h-[60vh] rounded-2xl shadow-2xl border-4 border-yellow-400"
      />
      <Button
        onClick={onClose}
        size="lg"
        variant="destructive"
        className="mt-6 gap-2 text-lg px-8"
      >
        <X className="h-5 w-5" />
        Parar alarme
      </Button>
    </div>
  );
}
