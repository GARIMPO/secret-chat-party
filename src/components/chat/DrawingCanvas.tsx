import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Send } from "lucide-react";

interface DrawingCanvasProps {
  onSend: (dataUrl: string) => void;
  onClose: () => void;
}

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
];

export default function DrawingCanvas({ onSend, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 300);
    }
  };

  useEffect(() => {
    clearCanvas();
  }, []);

  const handleSend = () => {
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    if (dataUrl) {
      onSend(dataUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Desenho</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full border border-border rounded-lg bg-white touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-primary" : "border-border"}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="range"
            min={1}
            max={10}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 ml-2"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={clearCanvas} className="flex-1">
            Limpar
          </Button>
          <Button onClick={handleSend} className="flex-1">
            <Send className="h-4 w-4 mr-1" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
