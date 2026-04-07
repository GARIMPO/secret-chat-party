import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAblyClient } from "@/lib/ably";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { playBeep } from "@/lib/beep";
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
import { Send, Lock, ArrowLeft, Trash2, Pencil, Music, LogIn, LogOut, DoorOpen, Users, Mail, Globe, Image, UserX, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type Ably from "ably";
import GifPicker from "@/components/chat/GifPicker";
import EmotionBar from "@/components/chat/EmotionBar";
import EmotionOverlay from "@/components/chat/EmotionOverlay";
import ColorPicker from "@/components/chat/ColorPicker";
import DrawingCanvas from "@/components/chat/DrawingCanvas";
import YouTubePlayer from "@/components/chat/YouTubePlayer";
import MoodPicker from "@/components/chat/MoodPicker";
import LetterComposer from "@/components/chat/LetterComposer";
import parchmentBg from "@/assets/parchment.png";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChatMessage {
  id: string;
  sender: string;
  encrypted: string;
  timestamp: number;
  textColor?: string;
  gif?: string;
  drawing?: string;
  system?: boolean;
  mood?: string;
  reactions?: Record<string, string[]>;
  letter?: {
    to: string;
    text: string;
  };
}

interface EmotionEvent {
  emoji: string;
  id: string;
  sender?: string;
}

interface YouTubeEvent {
  videoId: string | null;
  isPlaying: boolean;
  seekTime?: number;
}

const CHAT_FONT_SIZES: Record<string, string> = {
  small: "text-xs",
  normal: "text-sm",
  large: "text-base",
  xlarge: "text-lg",
  xxlarge: "text-xl",
};

const ROOM_PASSWORD = "entrar2025";
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const LANGUAGES = [
  { code: "", label: "Sem tradução" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "pt", label: "Português" },
];

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const MOODS_FOR_ENTRY = [
  { emoji: "😃", label: "Feliz" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😥", label: "Triste" },
  { emoji: "😡", label: "Bravo" },
  { emoji: "⛈️", label: "Tempestade" },
  { emoji: "🤡", label: "Palhaço" },
];

function linkify(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-primary break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

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

function getSession(room: string) {
  try {
    const s = localStorage.getItem(`chat-session-${room}`);
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (Date.now() - parsed.lastActive > INACTIVITY_TIMEOUT) {
      localStorage.removeItem(`chat-session-${room}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(room: string, nickname: string) {
  localStorage.setItem(`chat-session-${room}`, JSON.stringify({ nickname, lastActive: Date.now() }));
}

function updateSessionActivity(room: string) {
  try {
    const s = localStorage.getItem(`chat-session-${room}`);
    if (s) {
      const parsed = JSON.parse(s);
      parsed.lastActive = Date.now();
      localStorage.setItem(`chat-session-${room}`, JSON.stringify(parsed));
    }
  } catch {}
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
  const [textColor, setTextColor] = useState("");
  const [chatFontSize, setChatFontSize] = useState("xlarge");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showLetterComposer, setShowLetterComposer] = useState(false);
  const [openLetterId, setOpenLetterId] = useState<string | null>(null);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [emotion, setEmotion] = useState<EmotionEvent | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [myMood, setMyMood] = useState<string | null>(null);
  const [userMoods, setUserMoods] = useState<Record<string, string>>({});
  const [translateLang, setTranslateLang] = useState("");
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [ytVideo, setYtVideo] = useState<YouTubeEvent>(() => {
    if (room) {
      try {
        const saved = localStorage.getItem(`yt-state-${room}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { videoId: null, isPlaying: false };
  });
  const [ytSeekTo, setYtSeekTo] = useState<number | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activityInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const nicknameRef = useRef("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setupPresenceAndTyping = useCallback((channel: Ably.RealtimeChannel, myNick: string) => {
    // Presence for online users
    channel.presence.enter({ nickname: myNick });
    
    const syncPresence = async () => {
      try {
        const members = await channel.presence.get();
        const names: string[] = members.map((m) => (m.data as { nickname: string })?.nickname || m.clientId);
        setOnlineUsers([...new Set(names)]);
      } catch {}
    };
    syncPresence();
    channel.presence.subscribe("enter", syncPresence);
    channel.presence.subscribe("leave", syncPresence);

    // Typing indicator
    channel.subscribe("typing-start", (msg: Ably.Message) => {
      const data = msg.data as { nickname: string };
      if (data.nickname !== myNick) {
        setTypingUsers((prev) => prev.includes(data.nickname) ? prev : [...prev, data.nickname]);
      }
    });
    channel.subscribe("typing-stop", (msg: Ably.Message) => {
      const data = msg.data as { nickname: string };
      setTypingUsers((prev) => prev.filter((u) => u !== data.nickname));
    });
  }, []);

  const subscribeAll = useCallback((channel: Ably.RealtimeChannel) => {
    channel.subscribe("message", (msg: Ably.Message) => {
      const data = msg.data as ChatMessage;
      updateMessages((prev) => [...prev, data]);
      if (data.sender !== nicknameRef.current) playBeep();
      // Clear typing for sender
      setTypingUsers((prev) => prev.filter((u) => u !== data.sender));
    });
    channel.subscribe("delete-message", (msg: Ably.Message) => {
      const { messageId } = msg.data as { messageId: string };
      updateMessages((prev) => prev.filter((m) => m.id !== messageId));
    });
    channel.subscribe("clear-all", () => updateMessages(() => []));
    channel.subscribe("emotion", (msg: Ably.Message) => setEmotion({ ...(msg.data as EmotionEvent) }));
    channel.subscribe("drawing", (msg: Ably.Message) => {
      const data = msg.data as ChatMessage;
      updateMessages((prev) => [...prev, data]);
      if (data.sender !== nicknameRef.current) playBeep();
    });
    channel.subscribe("youtube", (msg: Ably.Message) => {
      const data = msg.data as YouTubeEvent;
      setYtVideo(data);
      if (room) localStorage.setItem(`yt-state-${room}`, JSON.stringify(data));
    });
    channel.subscribe("youtube-seek", (msg: Ably.Message) => {
      const { time } = msg.data as { time: number };
      setYtSeekTo(time);
    });
    channel.subscribe("user-join", (msg: Ably.Message) => {
      const data = msg.data as { nickname: string; mood?: string };
      updateMessages((prev) => [...prev, {
        id: crypto.randomUUID(), sender: "sistema",
        encrypted: encryptMessage(`${data.mood ? data.mood + " " : ""}${data.nickname} entrou na sala`, ROOM_PASSWORD),
        timestamp: Date.now(), system: true,
      }]);
    });
    channel.subscribe("user-leave", (msg: Ably.Message) => {
      const data = msg.data as { nickname: string };
      updateMessages((prev) => [...prev, {
        id: crypto.randomUUID(), sender: "sistema",
        encrypted: encryptMessage(`${data.nickname} saiu da sala`, ROOM_PASSWORD),
        timestamp: Date.now(), system: true,
      }]);
    });
    channel.subscribe("mood", (msg: Ably.Message) => {
      const data = msg.data as { nickname: string; mood: string };
      setUserMoods((prev) => ({ ...prev, [data.nickname]: data.mood }));
    });
    channel.subscribe("reaction", (msg: Ably.Message) => {
      const data = msg.data as { messageId: string; emoji: string; nickname: string };
      updateMessages((prev) => prev.map((m) => {
        if (m.id !== data.messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = reactions[data.emoji] || [];
        if (users.includes(data.nickname)) {
          reactions[data.emoji] = users.filter((u) => u !== data.nickname);
          if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
        } else {
          reactions[data.emoji] = [...users, data.nickname];
        }
        return { ...m, reactions };
      }));
    });
  }, [room]);

  // Auto-rejoin from saved session
  useEffect(() => {
    if (!room || joined) return;
    const session = getSession(room);
    if (session) {
      setNickname(session.nickname);
      setRoomPassword(ROOM_PASSWORD);
      const stored = loadMessages(room);
      setMessages(stored);
      saveSession(room, session.nickname);
      nicknameRef.current = session.nickname;

      const client = getAblyClient(session.nickname);
      const channel = client.channels.get(`chat-${room}`);
      channelRef.current = channel;

      subscribeAll(channel);
      setupPresenceAndTyping(channel, session.nickname);
      channel.publish("user-join", { nickname: session.nickname });
      setJoined(true);
    }
  }, [room]);

  useEffect(() => {
    if (!joined || !room) return;
    const trackActivity = () => updateSessionActivity(room);
    const events = ["mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, trackActivity, { passive: true }));
    activityInterval.current = setInterval(() => {
      const session = getSession(room);
      if (!session) {
        channelRef.current?.presence.leave();
        channelRef.current?.publish("user-leave", { nickname: nicknameRef.current });
        setJoined(false);
        setRoomPassword("");
        channelRef.current?.detach();
        channelRef.current = null;
        toast.info("Sessão expirada por inatividade");
      }
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, trackActivity));
      if (activityInterval.current) clearInterval(activityInterval.current);
    };
  }, [joined, room]);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      if (room) saveMessages(room, next);
      return next;
    });
  }, [room]);

  // Google Translate helper
  const translateText = useCallback(async (text: string, targetLang: string): Promise<string> => {
    if (!targetLang) return text;
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await res.json();
      return data[0]?.map((s: any) => s[0]).join("") || text;
    } catch {
      return text;
    }
  }, []);

  // Translate all messages when language changes
  useEffect(() => {
    if (!translateLang) {
      setTranslatedTexts({});
      return;
    }
    const translateAll = async () => {
      const newTranslations: Record<string, string> = {};
      for (const msg of messages) {
        if (msg.system || msg.letter || msg.gif || msg.drawing) continue;
        const decrypted = decryptMessage(msg.encrypted, ROOM_PASSWORD);
        if (decrypted === msg.encrypted) continue;
        newTranslations[msg.id] = await translateText(decrypted, translateLang);
      }
      setTranslatedTexts(newTranslations);
    };
    translateAll();
  }, [translateLang, messages, translateText]);

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
    if (!myMood) {
      toast.error("Selecione seu humor antes de entrar!");
      return;
    }

    const stored = loadMessages(room);
    setMessages(stored);
    saveSession(room, nickname.trim());
    nicknameRef.current = nickname.trim();

    const client = getAblyClient(nickname.trim());
    const channel = client.channels.get(`chat-${room}`);
    channelRef.current = channel;

    subscribeAll(channel);
    setupPresenceAndTyping(channel, nickname.trim());

    channel.publish("user-join", { nickname: nickname.trim(), mood: myMood });

    if (myMood) {
      channel.publish("mood", { nickname: nickname.trim(), mood: myMood });
      setUserMoods((prev) => ({ ...prev, [nickname.trim()]: myMood }));
    }

    const handleUnload = () => {
      channel.presence.leave();
      channel.publish("user-leave", { nickname: nicknameRef.current });
    };
    window.addEventListener("beforeunload", handleUnload);

    setJoined(true);
  };

  const handleTyping = () => {
    if (!channelRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      channelRef.current.publish("typing-start", { nickname });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      channelRef.current?.publish("typing-stop", { nickname });
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current) return;

    // Stop typing
    isTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current.publish("typing-stop", { nickname });

    // Auto-translate outgoing message if language is set
    let textToSend = input.trim();
    if (translateLang) {
      textToSend = await translateText(textToSend, translateLang);
    }

    const encrypted = encryptMessage(textToSend, ROOM_PASSWORD);
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted,
      timestamp: Date.now(),
      textColor: textColor || undefined,
      mood: myMood || undefined,
    };
    channelRef.current.publish("message", msg);
    setInput("");
    updateSessionActivity(room);
  };

  const handleSendGif = (gifUrl: string) => {
    if (!channelRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted: encryptMessage("GIF", ROOM_PASSWORD),
      timestamp: Date.now(),
      gif: gifUrl,
      mood: myMood || undefined,
    };
    channelRef.current.publish("message", msg);
  };

  const handleSendEmotion = (emoji: string) => {
    if (!channelRef.current) return;
    channelRef.current.publish("emotion", { emoji, id: crypto.randomUUID(), sender: nickname });
  };

  const handleSendDrawing = (dataUrl: string) => {
    if (!channelRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted: encryptMessage("🎨 Desenho", ROOM_PASSWORD),
      timestamp: Date.now(),
      drawing: dataUrl,
      mood: myMood || undefined,
    };
    channelRef.current.publish("message", msg);
  };

  const handleMoodChange = (emoji: string) => {
    setMyMood(emoji);
    setUserMoods((prev) => ({ ...prev, [nickname]: emoji }));
    channelRef.current?.publish("mood", { nickname, mood: emoji });
  };

  const handleSendLetter = (to: string, text: string) => {
    if (!channelRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: nickname,
      encrypted: encryptMessage("✉️ Carta Especial", ROOM_PASSWORD),
      timestamp: Date.now(),
      mood: myMood || undefined,
      letter: { to, text },
    };
    channelRef.current.publish("message", msg);
    toast.success(`Carta enviada para ${to}!`);
  };

  const handleDeleteMessage = (messageId: string) => {
    channelRef.current?.publish("delete-message", { messageId });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!channelRef.current) return;
    channelRef.current.publish("reaction", { messageId, emoji, nickname });
  };

  const handleClearAll = () => {
    if (!channelRef.current) return;
    channelRef.current.publish("clear-all", {});
    toast.success("Histórico apagado!");
  };

  const handleLeave = () => {
    if (room) {
      channelRef.current?.presence.leave();
      channelRef.current?.publish("user-leave", { nickname: nicknameRef.current });
      localStorage.removeItem(`chat-session-${room}`);
      channelRef.current?.detach();
      channelRef.current = null;
      setJoined(false);
      setNickname("");
      setRoomPassword("");
      toast.info("Você saiu da sala");
    }
  };

  const handleYouTubeSubmit = (videoId: string) => {
    const evt: YouTubeEvent = { videoId, isPlaying: true };
    setYtVideo(evt);
    if (room) localStorage.setItem(`yt-state-${room}`, JSON.stringify(evt));
    channelRef.current?.publish("youtube", evt);
    setShowYouTubeInput(false);
  };

  const handleYouTubeToggle = () => {
    const evt: YouTubeEvent = { ...ytVideo, isPlaying: !ytVideo.isPlaying };
    setYtVideo(evt);
    if (room) localStorage.setItem(`yt-state-${room}`, JSON.stringify(evt));
    channelRef.current?.publish("youtube", evt);
  };

  const handleYouTubeClose = () => {
    const evt: YouTubeEvent = { videoId: null, isPlaying: false };
    setYtVideo(evt);
    if (room) localStorage.removeItem(`yt-state-${room}`);
    channelRef.current?.publish("youtube", evt);
    setShowYouTubeInput(false);
  };

  const handleYouTubeSeek = (time: number) => {
    channelRef.current?.publish("youtube-seek", { time });
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSelf = msg.sender === nickname;
    const decrypted = decryptMessage(msg.encrypted, ROOM_PASSWORD);
    const isEncrypted = decrypted === msg.encrypted;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const displayFontSize = CHAT_FONT_SIZES[chatFontSize] || "text-base";

    if (msg.system) {
      return (
        <div key={msg.id} className="flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs">
            {decrypted.includes("entrou") ? (
              <LogIn className="h-3 w-3 text-green-500" />
            ) : (
              <LogOut className="h-3 w-3 text-red-400" />
            )}
            <span>{decrypted}</span>
            <span className="text-[10px] opacity-60">{time}</span>
          </div>
        </div>
      );
    }

    // Letter messages: only visible to sender and recipient
    if (msg.letter) {
      const isRecipient = msg.letter.to === nickname;
      const canSee = isSelf || isRecipient;

      if (!canSee) {
        return (
          <div key={msg.id} className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground text-xs">
              <span className="inline-block text-lg">✉️</span>
              <span>{msg.sender} enviou uma carta especial</span>
            </div>
          </div>
        );
      }

      // Sender sees simple confirmation
      if (isSelf) {
        return (
          <div key={msg.id} className="flex justify-end group">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground text-xs">
              <span className="text-lg">✉️</span>
              <span>Carta enviada para <strong className="text-foreground">{msg.letter.to}</strong></span>
              <span className="text-[10px] opacity-60">{time}</span>
            </div>
          </div>
        );
      }

      // Recipient sees animated envelope icon — click to open popup
      return (
        <div key={msg.id} className="flex justify-start group">
          <button
            onClick={() => setOpenLetterId(openLetterId === msg.id ? null : msg.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 hover:bg-muted transition-colors cursor-pointer"
          >
            <span className="animate-letter-shake inline-block text-2xl">✉️</span>
            <span className="text-xs text-muted-foreground">Carta de <strong className="text-foreground">{msg.sender}</strong> — toque para abrir</span>
          </button>
        </div>
      );
    }

    const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "👎"];
    const reactions = msg.reactions || {};

    return (
      <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"} group`}>
        <div className={`inline-block max-w-[85%] sm:max-w-[75%]`}>
          <div
            className={`rounded-2xl px-3 sm:px-4 py-2 shadow-sm relative ${
              isSelf
                ? "bg-chat-self text-chat-self-foreground rounded-br-md"
                : isEncrypted
                ? "bg-chat-encrypted text-chat-encrypted-foreground rounded-bl-md border border-destructive/20"
                : "bg-chat-other text-chat-other-foreground rounded-bl-md"
            }`}
          >
            {!isSelf && (
              <p className="text-sm font-bold mb-0.5 text-primary flex items-center gap-1">
                {msg.sender}
                {msg.mood && (
                  <span className="text-lg animate-mood-bounce inline-block">{msg.mood}</span>
                )}
              </p>
            )}
            {isSelf && (
              <p className="text-sm font-bold mb-0.5 text-chat-self-foreground/80 flex items-center gap-1 justify-end">
                {nickname}
                {msg.mood && (
                  <span className="text-lg animate-mood-bounce inline-block">{msg.mood}</span>
                )}
              </p>
            )}

            {msg.drawing ? (
              <img
                src={msg.drawing}
                alt="Desenho"
                className="max-w-full rounded-lg max-h-48 cursor-pointer"
                onClick={() => setLightboxUrl(msg.drawing!)}
              />
            ) : msg.gif ? (
              <img
                src={msg.gif}
                alt="GIF"
                className="max-w-full rounded-lg max-h-48 cursor-pointer"
                onClick={() => setLightboxUrl(msg.gif!)}
              />
            ) : (
              <p
                className={`${displayFontSize} leading-relaxed break-words whitespace-pre-wrap ${isEncrypted ? "font-mono text-xs" : ""}`}
                style={{
                  ...(msg.textColor ? { color: msg.textColor } : {}),
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                {isEncrypted && <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />}
                {linkify(translateLang && translatedTexts[msg.id] ? translatedTexts[msg.id] : decrypted)}
              </p>
            )}


            <div className="flex items-center justify-between mt-1">
              <p className={`text-[10px] ${isSelf ? "text-chat-self-foreground/60" : "text-muted-foreground"}`}>
                {time}
              </p>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir mensagem"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                        <AlertDialogDescription>Esta mensagem será excluída para todos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteMessage(msg.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>

          {/* Reaction bar */}
          <div className={`flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelf ? "justify-end" : "justify-start"}`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(msg.id, emoji)}
                className="text-sm hover:scale-125 transition-transform px-0.5"
                title={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {Object.keys(reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? "justify-end" : "justify-start"}`}>
              {Object.entries(reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(msg.id, emoji)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                    users.includes(nickname)
                      ? "bg-primary/20 border-primary/40 text-foreground"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title={users.join(", ")}
                >
                  <span>{emoji}</span>
                  <span>{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!joined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-sm space-y-6 rounded-2xl bg-surface p-6 sm:p-8 shadow-lg shadow-primary/5 border border-border"
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

          {/* Mood selection on entry — REQUIRED */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Selecione seu humor <span className="text-destructive">*</span></p>
            <div className="grid grid-cols-3 gap-2 justify-items-center">
              {MOODS_FOR_ENTRY.map((m) => (
                <button
                  key={m.emoji}
                  type="button"
                  onClick={() => setMyMood(m.emoji)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-full ${
                    myMood === m.emoji
                      ? "bg-primary/15 ring-2 ring-primary scale-110"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                  title={m.label}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full active:scale-[0.97]">Entrar na sala</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <EmotionOverlay emotion={emotion} />

      {showDrawing && (
        <DrawingCanvas onSend={handleSendDrawing} onClose={() => setShowDrawing(false)} />
      )}

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Preview" className="w-full h-full object-contain max-h-[85vh] rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Letter Composer Dialog */}
      <Dialog open={showLetterComposer} onOpenChange={setShowLetterComposer}>
        <DialogContent className="max-w-sm p-0 border-none bg-transparent shadow-none">
          <LetterComposer
            onlineUsers={onlineUsers}
            currentUser={nickname}
            onSend={(to, text) => {
              handleSendLetter(to, text);
              setShowLetterComposer(false);
            }}
            onClose={() => setShowLetterComposer(false)}
          />
        </DialogContent>
      </Dialog>

      <header className="flex items-center gap-2 sm:gap-3 border-b border-border bg-surface px-3 sm:px-4 py-2 sm:py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{room}</h1>
          <p className="text-xs text-muted-foreground">🔒 Criptografado · {onlineUsers.length} online</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Online users popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Quem está na sala" className="h-8 w-8 relative">
                <Users className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {onlineUsers.length}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" side="bottom" align="end">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Na sala agora</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {onlineUsers.map((user) => (
                  <div key={user} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <span className="truncate text-foreground">{user}</span>
                    {userMoods[user] && <span className="text-base">{userMoods[user]}</span>}
                    {user === nickname && <span className="text-[10px] text-muted-foreground">(você)</span>}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={chatFontSize} onValueChange={setChatFontSize}>
            <SelectTrigger className="w-20 sm:w-24 h-8 text-xs">
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
          <Button variant="ghost" size="icon" onClick={() => setShowYouTubeInput(!showYouTubeInput)} title="YouTube" className="h-8 w-8">
            <Music className="h-4 w-4 text-primary" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Apagar histórico" className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todo o histórico?</AlertDialogTitle>
                <AlertDialogDescription>Todas as mensagens desta sala serão apagadas permanentemente para todos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" title="Sair da sala" className="h-8 gap-1 text-xs text-destructive">
                <DoorOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair da sala?</AlertDialogTitle>
                <AlertDialogDescription>Você será desconectado e precisará entrar novamente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeave}>Sair</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {(showYouTubeInput || ytVideo.videoId) && (
        <YouTubePlayer
          videoId={ytVideo.videoId}
          isPlaying={ytVideo.isPlaying}
          onSubmitLink={handleYouTubeSubmit}
          onTogglePlay={handleYouTubeToggle}
          onClose={handleYouTubeClose}
          onSeek={handleYouTubeSeek}
          seekTo={ytSeekTo}
        />
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-12">
            Nenhuma mensagem ainda. Diga olá! 👋
          </p>
        )}
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
          {typingUsers.length === 1
            ? `${typingUsers[0]} está digitando...`
            : `${typingUsers.join(", ")} estão digitando...`}
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-border bg-surface p-2 sm:p-3 relative">
        <div className="flex items-center gap-2 mb-2 flex-wrap px-1">
          <ColorPicker value={textColor} onChange={setTextColor} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setShowDrawing(true)}
            title="Desenhar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <div className="border-l border-border h-6 mx-1" />
          <EmotionBar onSend={handleSendEmotion} />
          <div className="border-l border-border h-6 mx-1" />
          <MoodPicker currentMood={myMood} onSelect={handleMoodChange} />
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGifPicker(!showGifPicker)}
              title="Enviar GIF"
              className="h-8 px-2"
            >
              <span className="text-[10px] font-bold leading-none">GIF</span>
            </Button>
            {showGifPicker && (
              <GifPicker
                onSelect={handleSendGif}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>
          <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLetterComposer(!showLetterComposer)}
              title="Carta Especial"
              className="h-8 w-8 p-0"
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
          <div className="relative">
            <Button
              type="button"
              variant={translateLang ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowTranslateMenu(!showTranslateMenu)}
              title="Traduzir"
              className="h-8 gap-1 px-2"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold leading-none">Traduzir</span>
            </Button>
            {showTranslateMenu && (
              <div className="absolute bottom-full mb-1 left-0 w-48 bg-popover border border-border rounded-lg shadow-lg p-2 z-50">
                <p className="text-[10px] font-medium text-muted-foreground px-1 mb-1">Idioma do chat</p>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                    onClick={() => {
                        setTranslateLang(lang.code);
                        setShowTranslateMenu(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors ${
                        translateLang === lang.code
                          ? "bg-primary/15 text-foreground font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 relative items-end">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            className="flex-1 min-h-[56px] max-h-[56px] resize-none text-sm"
            rows={2}
          />
          <Button type="submit" size="icon" disabled={!input.trim()} className="active:scale-[0.95] shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Letter popup dialog */}
      {openLetterId && (() => {
        const letterMsg = messages.find(m => m.id === openLetterId && m.letter);
        if (!letterMsg || !letterMsg.letter) return null;
        return (
          <Dialog open={true} onOpenChange={() => setOpenLetterId(null)}>
            <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-sm sm:max-w-md">
              <div className="rounded-2xl overflow-hidden shadow-2xl relative">
                <img src={parchmentBg} alt="" className="w-full h-auto block" />
                <div className="absolute inset-0 flex flex-col items-center pt-[30%] px-8">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xl">✉️</span>
                    <span className="text-sm font-medium" style={{ color: "#5a3e1b" }}>
                      De: {letterMsg.sender}
                    </span>
                  </div>
                  <p className="font-cursive text-xl sm:text-2xl leading-relaxed break-words whitespace-pre-wrap text-center" style={{ color: "#3b2810" }}>
                    {letterMsg.letter.text}
                  </p>
                  <p className="text-xs mt-3" style={{ color: "#8a6d3b" }}>
                    {new Date(letterMsg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
