import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAblyClient } from "@/lib/ably";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Send, Lock, ArrowLeft, Trash2, Paperclip, Type, Italic } from "lucide-react";
import { toast } from "sonner";
import type Ably from "ably";

interface ChatMessage {
  id: string;
  sender: string;
  encrypted: string;
  timestamp: number;
  fontSize?: string;
  isItalic?: boolean;
  attachment?: { name: string; url: string; type: string };
}

const FONT_SIZES: Record<string, string> = {
  small: "text-xs",
  normal: "text-sm",
  large: "text-base",
  xlarge: "text-lg",
};

const CHAT_FONT_SIZES: Record<string, string> = {
  small: "text-xs",
  normal: "text-sm",
  large: "text-base",
  xlarge: "text-lg",
  xxlarge: "text-xl",
};

const ROOM_PASSWORD = "entrar2025";

function loadMessages(room: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(`chat-messages-${room}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages(room: string, messages: ChatMessage[]) {
  localStorage.setItem(`chat-messages-${room}`, JSON.stringify(messages));
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const room = searchParams.get("room");
  const isAdmin = searchParams.get("admin") === "true";

  const [nickname, setNickname] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [fontSize, setFontSize] = useState("normal");
  const [isItalic, setIsItalic] = useState(false);
  const [chatFontSize, setChatFontSize] = useState("normal");
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      if (room) saveMessages(room, next);
      return next;
    });
  }, [room]);

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-foreground font-medium">Nenhuma sala especificada.</p>
          <p className="text-sm text-muted-foreground">Acesse via link com ?room=nome</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (roomPassword !== ROOM_PASSWORD) {
      toast.error("Senha da sala incorreta!");
      return;
    }

    const stored = loadMessages(room);
    setMessages(stored);

    const client = getAblyClient(nickname.trim());
    const channel = client.channels.get(`chat-${room}`);
    channelRef.current = channel;

    channel.subscribe("message", (msg: Ably.Message) => {
      const data = msg.data as ChatMessage;
      updateMessages((prev) => [...prev, data]);
    });

    channel.subscribe("delete-message", (msg: Ably.Message) => {
      const { messageId } = msg.data as { messageId: string };
      updateMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    channel.subscribe("clear-all", () => {
      updateMessages(() => []);
    });

    setJoined(true);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current) return;

    const encrypted = encryptMessage(input.trim(), ROOM_PASSWORD);

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted,
      timestamp: Date.now(),
      fontSize,
      isItalic,
    };

    channelRef.current.publish("message", msg);
    setInput("");
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelRef.current) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: nickname,
        encrypted: encryptMessage(`📎 ${file.name}`, ROOM_PASSWORD),
        timestamp: Date.now(),
        fontSize,
        isItalic,
        attachment: { name: file.name, url, type: file.type },
      };
      channelRef.current?.publish("message", msg);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteMessage = (messageId: string) => {
    channelRef.current?.publish("delete-message", { messageId });
  };

  const handleClearAll = () => {
    if (!channelRef.current) return;
    channelRef.current.publish("clear-all", {});
    toast.success("Histórico apagado!");
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSelf = msg.sender === nickname;
    const decrypted = decryptMessage(msg.encrypted, ROOM_PASSWORD);
    const isEncrypted = decrypted === msg.encrypted;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msgFontSize = CHAT_FONT_SIZES[chatFontSize] || "text-sm";
    const senderFontSize = msg.fontSize ? FONT_SIZES[msg.fontSize] : "text-sm";

    return (
      <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"} group`}>
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative ${
            isSelf
              ? "bg-chat-self text-chat-self-foreground rounded-br-md"
              : isEncrypted
              ? "bg-chat-encrypted text-chat-encrypted-foreground rounded-bl-md border border-destructive/20"
              : "bg-chat-other text-chat-other-foreground rounded-bl-md"
          }`}
        >
          {!isSelf && (
            <p className={`text-sm font-bold mb-0.5 ${isEncrypted ? "text-chat-encrypted-foreground/70" : "text-primary"}`}>
              {msg.sender}
            </p>
          )}
          <p
            className={`${msgFontSize} ${senderFontSize} leading-relaxed break-words ${isEncrypted ? "font-mono text-xs" : ""} ${msg.isItalic ? "italic" : ""}`}
          >
            {isEncrypted && <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />}
            {decrypted}
          </p>
          {msg.attachment && (
            <div className="mt-2">
              {msg.attachment.type.startsWith("image/") ? (
                <img src={msg.attachment.url} alt={msg.attachment.name} className="max-w-full rounded-lg max-h-48 object-cover" />
              ) : (
                <a href={msg.attachment.url} download={msg.attachment.name} className="text-xs underline text-primary">
                  📎 {msg.attachment.name}
                </a>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className={`text-[10px] ${isSelf ? "text-chat-self-foreground/60" : "text-muted-foreground"}`}>
              {time}
            </p>
            {isAdmin && (
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                title="Excluir mensagem"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-sm space-y-6 rounded-2xl bg-surface p-8 shadow-lg shadow-primary/5 border border-border"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Sala: {room}</h1>
            <p className="text-sm text-muted-foreground">Insira seu apelido e a senha da sala</p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Seu apelido"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              maxLength={20}
            />
            <Input
              type="password"
              placeholder="Senha da sala"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full active:scale-[0.97]">
            Entrar na sala
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">{room}</h1>
          <p className="text-xs text-muted-foreground">🔒 Criptografado</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chatFontSize} onValueChange={setChatFontSize}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequena</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
              <SelectItem value="xlarge">Maior</SelectItem>
              <SelectItem value="xxlarge">Enorme</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={handleClearAll} title="Apagar histórico">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-12">
            Nenhuma mensagem ainda. Diga olá! 👋
          </p>
        )}
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-border bg-surface p-3">
        <div className="flex items-center gap-2 mb-2">
          <Select value={fontSize} onValueChange={setFontSize}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <Type className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequena</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
              <SelectItem value="xlarge">Maior</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={isItalic ? "default" : "outline"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsItalic(!isItalic)}
            title="Itálico / Cursiva"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileAttach}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            className={`flex-1 min-h-[56px] max-h-[56px] resize-none ${isItalic ? "italic" : ""}`}
            rows={2}
          />
          <Button type="submit" size="icon" disabled={!input.trim()} className="active:scale-[0.95] shrink-0 self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
