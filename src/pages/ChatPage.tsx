import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAblyClient } from "@/lib/ably";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Lock, ArrowLeft } from "lucide-react";
import type Ably from "ably";

interface ChatMessage {
  id: string;
  sender: string;
  encrypted: string;
  timestamp: number;
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const room = searchParams.get("room");
  const keyFromUrl = searchParams.get("key");
  const autoPassword = keyFromUrl ? (() => { try { return atob(decodeURIComponent(keyFromUrl)); } catch { return ""; } })() : "";

  const [nickname, setNickname] = useState("");
  const [roomPassword, setRoomPassword] = useState(autoPassword);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    const client = getAblyClient(nickname.trim());
    const channel = client.channels.get(`chat-${room}`);
    channelRef.current = channel;

    channel.subscribe("message", (msg: Ably.Message) => {
      const data = msg.data as ChatMessage;
      setMessages((prev) => [...prev, data]);
    });

    setJoined(true);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current) return;

    const encrypted = roomPassword
      ? encryptMessage(input.trim(), roomPassword)
      : input.trim();

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted,
      timestamp: Date.now(),
    };

    channelRef.current.publish("message", msg);
    setInput("");
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSelf = msg.sender === nickname;
    const decrypted = roomPassword
      ? decryptMessage(msg.encrypted, roomPassword)
      : msg.encrypted;

    const isEncrypted = decrypted === msg.encrypted && roomPassword !== "";
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
      <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
            isSelf
              ? "bg-chat-self text-chat-self-foreground rounded-br-md"
              : isEncrypted
              ? "bg-chat-encrypted text-chat-encrypted-foreground rounded-bl-md border border-destructive/20"
              : "bg-chat-other text-chat-other-foreground rounded-bl-md"
          }`}
        >
          {!isSelf && (
            <p className={`text-xs font-medium mb-0.5 ${isEncrypted ? "text-chat-encrypted-foreground/70" : "text-primary"}`}>
              {msg.sender}
            </p>
          )}
          <p className={`text-sm leading-relaxed break-words ${isEncrypted ? "font-mono text-xs" : ""}`}>
            {isEncrypted && <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />}
            {decrypted}
          </p>
          <p className={`text-[10px] mt-1 ${isSelf ? "text-chat-self-foreground/60" : "text-muted-foreground"}`}>
            {time}
          </p>
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
            <p className="text-sm text-muted-foreground">{autoPassword ? "Senha detectada no link. Insira seu apelido." : "Insira seu apelido e a senha da sala"}</p>
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
              placeholder="Senha da sala (para descriptografar)"
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
        <div>
          <h1 className="text-sm font-semibold text-foreground">{room}</h1>
          <p className="text-xs text-muted-foreground">
            {roomPassword ? "🔒 Criptografado" : "⚠️ Sem senha"}
          </p>
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
        <div className="flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()} className="active:scale-[0.95]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
