import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { MessageSquareLock, Send, X } from "lucide-react";

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
  unread: number;
}

interface IncomingInvite {
  from: string;
  sessionId: string;
}

function pairId(a: string, b: string) {
  return [a, b].sort().join("|");
}

interface Ctx {
  sessions: Record<string, Session>;
  onlineUsers: string[];
  totalUnread: number;
  myNick: string;
  clearUnread: (sid: string) => void;
  closeSession: (sid: string) => void;
  sendMessage: (sid: string, text: string) => void;
  invite: (target: string) => void;
}

const PrivateChatsCtx = createContext<Ctx | null>(null);

interface ProviderProps {
  channel: Ably.RealtimeChannel | null;
  nickname: string;
  onlineUsers: string[];
  children: ReactNode;
}

export const PrivateChatsProvider = forwardRef<PrivateChatsHandle, ProviderProps>(
  ({ channel, nickname, onlineUsers, children }, ref) => {
    const [sessions, setSessions] = useState<Record<string, Session>>({});
    const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
    const incomingQueue = useRef<IncomingInvite[]>([]);
    const sentInvites = useRef<Set<string>>(new Set());
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
        if (sessions[data.sessionId]) {
          channel.publish("pm-invite-response", {
            from: nickRef.current,
            to: data.from,
            sessionId: data.sessionId,
            accepted: true,
          });
          return;
        }
        const inv = { from: data.from, sessionId: data.sessionId };
        if (incoming) incomingQueue.current.push(inv);
        else setIncoming(inv);
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
              unread: isIncoming ? sess.unread + 1 : sess.unread,
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
          setSessions((prev) => ({
            ...prev,
            [sid]: { ...prev[sid], unread: 0 },
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
            unread: 0,
          },
        }));
      }
      showNextIncoming();
    };

    const closeSession = useCallback((sid: string) => {
      setSessions((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      sentInvites.current.delete(sid);
    }, []);

    const clearUnread = useCallback((sid: string) => {
      setSessions((prev) =>
        prev[sid] && prev[sid].unread > 0
          ? { ...prev, [sid]: { ...prev[sid], unread: 0 } }
          : prev,
      );
    }, []);

    const sendMessage = useCallback(
      (sid: string, text: string) => {
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
      },
      [channel, nickname, sessions],
    );

    const totalUnread = useMemo(
      () => Object.values(sessions).reduce((s, x) => s + x.unread, 0),
      [sessions],
    );

    const ctxValue: Ctx = {
      sessions,
      onlineUsers,
      totalUnread,
      myNick: nickname,
      clearUnread,
      closeSession,
      sendMessage,
      invite,
    };

    return (
      <PrivateChatsCtx.Provider value={ctxValue}>
        {children}

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
      </PrivateChatsCtx.Provider>
    );
  },
);
PrivateChatsProvider.displayName = "PrivateChatsProvider";

export function PrivateChatsTrigger() {
  const ctx = useContext(PrivateChatsCtx);
  if (!ctx) return null;
  const entries = Object.entries(ctx.sessions);
  const hasAny = entries.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Chats privados"
          className="h-8 w-8 p-0 relative"
        >
          <MessageSquareLock
            className={`h-3.5 w-3.5 ${hasAny ? "text-primary" : "text-muted-foreground"}`}
          />
          {ctx.totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 text-[9px] font-semibold flex items-center justify-center">
              {ctx.totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-xs font-semibold px-2 py-1 text-muted-foreground">
          Chats privados ativos
        </p>
        {!hasAny && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum chat privado ativo
          </p>
        )}
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {entries.map(([sid, sess]) => {
            const isOnline = ctx.onlineUsers.includes(sess.with);
            return (
              <div
                key={sid}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted group"
              >
                <span
                  className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                />
                <span className="text-xs flex-1 truncate">{sess.with}</span>
                {sess.unread > 0 && (
                  <span className="bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 text-[10px] font-semibold flex items-center justify-center">
                    {sess.unread}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.closeSession(sid);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  title="Encerrar chat"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PrivateChatsAccordion() {
  const ctx = useContext(PrivateChatsCtx);
  const [openItem, setOpenItem] = useState<string>("");

  if (!ctx) return null;
  const entries = Object.entries(ctx.sessions);
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/30">
      <Accordion
        type="single"
        collapsible
        value={openItem}
        onValueChange={(v) => {
          setOpenItem(v);
          if (v) ctx.clearUnread(v);
        }}
        className="w-full"
      >
        {entries.map(([sid, sess]) => {
          const isOnline = ctx.onlineUsers.includes(sess.with);
          return (
            <AccordionItem key={sid} value={sid} className="border-b last:border-b-0">
              <div className="flex items-center pr-2">
                <AccordionTrigger className="flex-1 px-3 py-2 hover:no-underline">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquareLock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="text-xs font-medium truncate">{sess.with}</span>
                    {sess.unread > 0 && (
                      <span className="bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {sess.unread}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.closeSession(sid);
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                  title="Encerrar chat"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <AccordionContent className="pb-0">
                <PrivateChatPanel
                  session={sess}
                  myNick={ctx.myNick}
                  onSend={(text) => ctx.sendMessage(sid, text)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

interface PanelProps {
  session: Session;
  myNick: string;
  onSend: (text: string) => void;
}

function PrivateChatPanel({ session, myNick, onSend }: PanelProps) {
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
    <div className="flex flex-col bg-background border-t border-border">
      <div className="max-h-56 overflow-y-auto p-2 space-y-1.5">
        {session.messages.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Início do chat privado com {session.with}
          </p>
        )}
        {session.messages.map((m) => {
          const isMe = m.from === myNick;
          const text = decryptMessage(m.encrypted, PM_PASSWORD);
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
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

const PrivateChats = PrivateChatsProvider;
export default PrivateChats;
