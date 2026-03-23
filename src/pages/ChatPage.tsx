import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAblyClient } from "@/lib/ably";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lock, ArrowLeft, Smile, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import GifPicker from "@/components/chat/GifPicker";
import ConfettiButton, { fireConfetti } from "@/components/chat/ConfettiButton";
import type Ably from "ably";

const ACCESS_PASSWORD = "entrar2000";

const EMOJI_LIST = [
  "😀","😂","😍","🥰","😎","🤔","😢","😡","👍","👎",
  "❤️","🔥","🎉","✅","❌","💬","🙏","👋","🤝","💯",
  "😊","🥳","😜","🤣","😇","🫡","🫶","💀","👀","🫠",
];

interface ChatMessage {
  id: string;
  sender: string;
  encrypted: string;
  timestamp: number;
  type?: "text" | "gif" | "confetti";
  gifUrl?: string;
}

function getStorageKey(room: string) {
  return `chat-messages-${room}`;
}

function loadMessages(room: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(room));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(room: string, messages: ChatMessage[]) {
  localStorage.setItem(getStorageKey(room), JSON.stringify(messages));
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const room = searchParams.get("room");
  const keyFromUrl = searchParams.get("key");
  const encryptionKey = keyFromUrl
    ? (() => { try { return atob(decodeURIComponent(keyFromUrl)); } catch { return ""; } })()
    : "";

  const [nickname, setNickname] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    if (!room) return false;
    return localStorage.getItem(`chat-autosave-${room}`) === "true";
  });
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (autoSave && room && joined) {
      saveMessages(room, messages);
    }
  }, [messages, autoSave, room, joined]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-foreground font-medium">Nenhuma sala especificada.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast.error("Digite seu apelido");
      return;
    }
    if (accessPassword !== ACCESS_PASSWORD) {
      toast.error("Senha de acesso incorreta");
      return;
    }

    const client = getAblyClient(nickname.trim());
    const channel = client.channels.get(`chat-${room}`);
    channelRef.current = channel;

    if (autoSave) {
      setMessages(loadMessages(room));
    }

    channel.subscribe("message", (msg: Ably.Message) => {
      const data = msg.data as ChatMessage;
      // Fire confetti when receiving a confetti message
      if (data.type === "confetti") {
        fireConfetti();
      }
      setMessages((prev) => [...prev, data]);
    });

    setJoined(true);
  };

  const publishMessage = (msg: ChatMessage) => {
    if (!channelRef.current) return;
    channelRef.current.publish("message", msg);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current) return;

    const encrypted = encryptionKey
      ? encryptMessage(input.trim(), encryptionKey)
      : input.trim();

    publishMessage({
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted,
      timestamp: Date.now(),
      type: "text",
    });
    setInput("");
    setShowEmoji(false);
  };

  const handleSendGif = (gifUrl: string) => {
    publishMessage({
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted: "",
      timestamp: Date.now(),
      type: "gif",
      gifUrl,
    });
  };

  const handleSendConfetti = () => {
    publishMessage({
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted: "🎉 Confetes!",
      timestamp: Date.now(),
      type: "confetti",
    });
  };

  const handleClearHistory = () => {
    setMessages([]);
    if (room) localStorage.removeItem(getStorageKey(room));
    toast.success("Histórico apagado");
  };

  const toggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    if (room) {
      localStorage.setItem(`chat-autosave-${room}`, String(next));
      if (next) {
        saveMessages(room, messages);
        toast.success("Salvamento automático ativado");
      } else {
        toast.info("Salvamento automático desativado");
      }
    }
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSelf = msg.sender === nickname;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // GIF message
    if (msg.type === "gif" && msg.gifUrl) {
      return (
        <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
            isSelf ? "bg-chat-self text-chat-self-foreground rounded-br-md" : "bg-chat-other text-chat-other-foreground rounded-bl-md"
          }`}>
            {!isSelf && (
              <p className="text-sm font-black mb-1 text-primary" style={{ fontFamily: "'Arial Black', 'Arial Bold', sans-serif" }}>
                {msg.sender}
              </p>
            )}
            <img src={msg.gifUrl} alt="GIF" className="rounded-lg max-w-full" loading="lazy" />
            <p className={`text-[10px] mt-1 ${isSelf ? "text-chat-self-foreground/60" : "text-muted-foreground"}`}>{time}</p>
          </div>
        </div>
      );
    }

    // Confetti message
    if (msg.type === "confetti") {
      return (
        <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
            isSelf ? "bg-chat-self text-chat-self-foreground rounded-br-md" : "bg-chat-other text-chat-other-foreground rounded-bl-md"
          }`}>
            {!isSelf && (
              <p className="text-sm font-black mb-1 text-primary" style={{ fontFamily: "'Arial Black', 'Arial Bold', sans-serif" }}>
                {msg.sender}
              </p>
            )}
            <p className="text-2xl text-center">🎉🎊🥳</p>
            <p className={`text-[10px] mt-1 ${isSelf ? "text-chat-self-foreground/60" : "text-muted-foreground"}`}>{time}</p>
          </div>
        </div>
      );
    }

    // Text message
    const decrypted = encryptionKey
      ? decryptMessage(msg.encrypted, encryptionKey)
      : msg.encrypted;
    const isEncrypted = decrypted === msg.encrypted && encryptionKey !== "";

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
            <p
              className={`text-sm font-black mb-1 ${isEncrypted ? "text-chat-encrypted-foreground/70" : "text-primary"}`}
              style={{ fontFamily: "'Arial Black', 'Arial Bold', sans-serif" }}
            >
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
            <p className="text-sm text-muted-foreground">Insira seu apelido e a senha de acesso</p>
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
              placeholder="Senha de acesso"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
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
          <p className="text-xs text-muted-foreground">
            {encryptionKey ? "🔒 Criptografado" : "⚠️ Sem criptografia"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleAutoSave}
            title={autoSave ? "Salvamento ativo" : "Ativar salvamento"}
            className={autoSave ? "text-primary" : "text-muted-foreground"}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Apagar histórico">
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
        <div className="relative flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <div className="relative" ref={emojiRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowEmoji((v) => !v)}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <Smile className="h-5 w-5" />
              </Button>
              {showEmoji && (
                <div className="absolute bottom-10 left-0 z-50 grid grid-cols-6 gap-1 rounded-xl bg-surface border border-border p-3 shadow-lg w-[220px]">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmoji(emoji)}
                      className="text-xl hover:bg-muted rounded-lg p-1 transition-colors active:scale-[0.9]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <GifPicker onSelect={handleSendGif} />
            <ConfettiButton onSendConfetti={handleSendConfetti} />
          </div>
          <Textarea
            ref={textareaRef}
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            rows={2}
          />
          <Button type="submit" size="icon" disabled={!input.trim()} className="active:scale-[0.95] h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
