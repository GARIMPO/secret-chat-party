import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LetterComposerProps {
  onlineUsers: string[];
  currentUser: string;
  onSend: (to: string, text: string) => void;
  onClose: () => void;
}

export default function LetterComposer({ onlineUsers, currentUser, onSend, onClose }: LetterComposerProps) {
  const [to, setTo] = useState("");
  const [text, setText] = useState("");

  const recipients = onlineUsers.filter((u) => u !== currentUser);

  const handleSend = () => {
    if (!to || !text.trim()) return;
    onSend(to, text.trim());
    onClose();
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 w-72 sm:w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">✉️ Carta Especial</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm px-1">✕</button>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Para quem?</label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione alguém" />
            </SelectTrigger>
            <SelectContent>
              {recipients.map((user) => (
                <SelectItem key={user} value={user}>{user}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Sua mensagem</label>
          <Textarea
            placeholder="Escreva algo especial..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[80px] max-h-[120px] text-sm resize-none"
            autoFocus
          />
        </div>
        <Button
          size="sm"
          className="w-full gap-2"
          disabled={!to || !text.trim()}
          onClick={handleSend}
        >
          <Send className="h-3.5 w-3.5" />
          Enviar Carta
        </Button>
      </div>
    </div>
  );
}
