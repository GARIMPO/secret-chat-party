import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from "react";
import type Ably from "ably";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { playBeep } from "@/lib/beep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MessageSquareLock, Send, X, Minus, Maximize2 } from "lucide-react";

const PM_PASSWORD = "entrar2025";

export interface PrivateChatsHandle {
  invite: (target: string) => void;
}

interface PMMessage {
  id: string;
  from: string;
  encrypted: string;
  ts: number;
}

interface Session {
  with: string;
  messages: PMMessage[];
  minimized: boolean;
  unread: number;
}

interface IncomingInvite {
  from: string;
  sessionId: string;
}

interface Props {
  channel: Ably.RealtimeChannel | null;
  nickname: string;
  onlineUsers: string[];
}

function pairId(a: string, b: string) {
  return [a, b].sort().join("|");
}

const PrivateChats = forwardRef<PrivateChatsHandle, Props>(
  ({ channel, nickname, onlineUsers }, ref) => {
    const [sessions, setSessions] = useState<Record<string, Session>>({});
    const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
    const incomingQueue = useRef<IncomingInvite[]>([]);
    const sentInvites = useRef<Set<string>>(new Set()); // sessionIds we initiated
    const nickRef = useRef(nickname);
    nickRef.current = nickname;

    const showNextIncoming = useCallback(() => {
      const next = incomingQueue.current.shift();
      setIncoming(next || null);
    }, []);

    useEffect(() => {
      if (!channel) return;

      const onInvite = (msg: Ably.Message) => {
        const data = msg.data as { from: string; to: string; sessionId: string };
        if (data.to !== nickRef.current) return;
        // If session already open, auto-accept
        if (sessions[data.sessionId]) {
          channel.publish("pm-invite-response", {
            from: nickRef.current,
            to: data.from,
            sessionId: data.sessionId,
            accepted: true,
          });
          return;
        }
        // Queue invite
        const inv = { from: data.from, sessionId: data.sessionId };
        if (incoming) {
          incomingQueue.current.push(inv);
        } else {
          setIncoming(inv);
        }
        playBeep();
        toast.info(`${data.from} quer iniciar um chat privado`);
      };

      const onResponse = (msg: Ably.Message) => {
        const data = msg.data as {
          from: string;
          to: string;
          sessionId: string;
          accepted: boolean;
        };
        if (data.to !== nickRef.current) return;
        if (!sentInvites.current.has(data.sessionId)) return;
        if (data.accepted) {
          setSessions((prev) => ({
            ...prev,
            [data.sessionId]: prev[data.sessionId] || {
              with: data.from,
              messages: [],
              minimized: false,
              unread: 0,
            },
          }));
          toast.success(`${data.from} aceitou o chat privado!`);
        } else {
          sentInvites.current.delete(data.sessionId);
          toast.error(`${data.from} recusou o chat privado.`);
        }
      };

      const onMsg = (msg: Ably.Message) => {
        const data = msg.data as {
          sessionId: string;
          from: string;
          to: string;
          encrypted: string;
          id: string;
          ts: number;
        };
        if (data.to !== nickRef.current && data.from !== nickRef.current) return;
        setSessions((prev) => {
          const sess = prev[data.sessionId];
          if (!sess) return prev;
          if (sess.messages.some((m) => m.id === data.id)) return prev;
          const isIncoming = data.from !== nickRef.current;
          return {
            ...prev,
            [data.sessionId]: {
              ...sess,
              messages: [
                ...sess.messages,
                { id: data.id, from: data.from, encrypted: data.encrypted, ts: data.ts },
              ],
              unread:
                isIncoming && sess.minimized ? sess.unread + 1 : sess.unread,
            },
          };
        });
        if (data.from !== nickRef.current) playBeep();
      };

      channel.subscribe("pm-invite", onInvite);
      channel.subscribe("pm-invite-response", onResponse);
      channel.subscribe("pm-msg", onMsg);

      return () => {
        channel.unsubscribe("pm-invite", onInvite);
        channel.unsubscribe("pm-invite-response", onResponse);
        channel.unsubscribe("pm-msg", onMsg);
      };
    }, [channel, sessions, incoming]);

    const invite = useCallback(
      (target: string) => {
        if (!channel || !target || target === nickname) return;
        const sid = pairId(nickname, target);
        if (sessions[sid]) {
          // Already open – just unminimize
          setSessions((prev) => ({
            ...prev,
            [sid]: { ...prev[sid], minimized: false, unread: 0 },
          }));
          return;
        }
        sentInvites.current.add(sid);
        channel.publish("pm-invite", {
          from: nickname,
          to: target,
          sessionId: sid,
        });
        toast.info(`Convite enviado para ${target}. Aguardando resposta...`);
      },
      [channel, nickname, sessions],
    );

    useImperativeHandle(ref, () => ({ invite }), [invite]);

    const respondInvite = (accepted: boolean) => {
      if (!incoming || !channel) return;
      channel.publish("pm-invite-response", {
        from: nickname,
        to: incoming.from,
        sessionId: incoming.sessionId,
        accepted,
      });
      if (accepted) {
        setSessions((prev) => ({
          ...prev,
          [incoming.sessionId]: prev[incoming.sessionId] || {
            with: incoming.from,
            messages: [],
            minimized: false,
            unread: 0,
          },
        }));
      }
      showNextIncoming();
    };

    const closeSession = (sid: string) => {
      setSessions((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      sentInvites.current.delete(sid);
    };

    const toggleMinimize = (sid: string) => {
      setSessions((prev) => ({
        ...prev,
        [sid]: {
          ...prev[sid],
          minimized: !prev[sid].minimized,
          unread: 0,
        },
      }));
    };

    const sendMessage = (sid: string, text: string) => {
      if (!channel || !text.trim()) return;
      const sess = sessions[sid];
      if (!sess) return;
      const msg = {
        sessionId: sid,
        from: nickname,
        to: sess.with,
        encrypted: encryptMessage(text.trim(), PM_PASSWORD),
        id: crypto.randomUUID(),
        ts: Date.now(),
      };
      channel.publish("pm-msg", msg);
    };

    const openSessions = Object.entries(sessions).filter(
      ([, s]) => !s.minimized,
    );
    const minimizedSessions = Object.entries(sessions).filter(
      ([, s]) => s.minimized,
    );

    return (
      <>
        {/* Incoming invite dialog */}
        <AlertDialog
          open={!!incoming}
          onOpenChange={(o) => {
            if (!o && incoming) respondInvite(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MessageSquareLock className="h-5 w-5 text-primary" />
                Convite para chat privado
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{incoming?.from}</strong> quer iniciar um chat privado com você.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => respondInvite(false)}>
                Recusar
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => respondInvite(true)}>
                Aceitar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Floating private chat windows */}
        <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3 pointer-events-none">
          {openSessions.map(([sid, sess]) => (
            <PrivateChatWindow
              key={sid}
              session={sess}
              myNick={nickname}
              isOnline={onlineUsers.includes(sess.with)}
              onClose={() => closeSession(sid)}
              onMinimize={() => toggleMinimize(sid)}
              onSend={(text) => sendMessage(sid, text)}
            />
          ))}
        </div>

        {/* Minimized tabs */}
        {minimizedSessions.length > 0 && (
          <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
            {minimizedSessions.map(([sid, sess]) => (
              <button
                key={sid}
                onClick={() => toggleMinimize(sid)}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition text-xs font-medium"
              >
                <MessageSquareLock className="h-3.5 w-3.5" />
                {sess.with}
                {sess.unread > 0 && (
                  <span className="bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                    {sess.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </>
    );
  },
);

PrivateChats.displayName = "PrivateChats";
export default PrivateChats;

interface WindowProps {
  session: Session;
  myNick: string;
  isOnline: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onSend: (text: string) => void;
}

function PrivateChatWindow({
  session,
  myNick,
  isOnline,
  onClose,
  onMinimize,
  onSend,
}: WindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="pointer-events-auto w-72 sm:w-80 h-96 rounded-lg border border-border bg-background shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground">
        <MessageSquareLock className="h-3.5 w-3.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{session.with}</p>
          <p className="text-[10px] opacity-80">
            {isOnline ? "● online" : "○ offline"} · privado
          </p>
        </div>
        <button
          onClick={onMinimize}
          className="p-1 hover:bg-white/20 rounded"
          title="Minimizar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-muted/20">
        {session.messages.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Início do chat privado com {session.with}
          </p>
        )}
        {session.messages.map((m) => {
          const isMe = m.from === myNick;
          const text = decryptMessage(m.encrypted, PM_PASSWORD);
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card text-foreground border border-border rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{text}</p>
                <p className="text-[9px] opacity-60 mt-0.5 text-right">
                  {new Date(m.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-2 border-t border-border flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Mensagem privada..."
          className="h-8 text-xs"
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
