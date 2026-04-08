import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setRoomPassword, getAllRoomPasswords, deleteRoomPassword } from "@/store/roomPasswords";
import { Shield, Plus, Trash2, Copy, LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
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

const ADMIN_CREDENTIALS = [
  { login: "Jafuis", password: "Markinhos" },
  { login: "Noy", password: "NoyMarcos" },
];
const DEFAULT_ROOM_PASSWORD = "entrar2025";
const ADMIN_SESSION_KEY = "admin-session";

export default function AdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [rooms, setRooms] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const session = localStorage.getItem(ADMIN_SESSION_KEY);
      if (session === "true") {
        setIsAuthenticated(true);
        setRooms(getAllRoomPasswords());
      }
    } catch {}
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMIN_CREDENTIALS.some(c => c.login === login && c.password === password)) {
      setIsAuthenticated(true);
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      setRooms(getAllRoomPasswords());
    } else {
      toast.error("Login ou senha inválidos");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.trim()) {
      toast.error("Preencha o nome da sala");
      return;
    }
    setRoomPassword(newRoom.trim(), DEFAULT_ROOM_PASSWORD);
    setRooms(getAllRoomPasswords());
    toast.success(`Sala "${newRoom}" criada!`);
    setNewRoom("");
  };

  const handleDelete = (room: string) => {
    deleteRoomPassword(room);
    setRooms(getAllRoomPasswords());
    toast.success(`Sala "${room}" removida`);
  };

  const handleClearChat = (room: string) => {
    localStorage.removeItem(`chat-messages-${room}`);
    toast.success(`Histórico da sala "${room}" apagado!`);
  };

  const copyLink = (room: string) => {
    const url = `${window.location.origin}/chat?room=${encodeURIComponent(room)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-6 rounded-2xl bg-surface p-8 shadow-lg shadow-primary/5 border border-border"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Entre para gerenciar salas</p>
          </div>
          <div className="space-y-3">
            <Input placeholder="Login" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full active:scale-[0.97]">Entrar</Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")}>
            ← Voltar para a página principal
          </Button>
        </form>
      </div>
    );
  }

  const roomEntries = Object.entries(rooms);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Gerenciar Salas</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 p-6">
        <form onSubmit={handleAddRoom} className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-sm border border-border">
          <h2 className="text-sm font-medium text-muted-foreground">Criar nova sala</h2>
          <div className="flex gap-2">
            <Input placeholder="Nome da sala" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className="flex-1" />
            <Button type="submit" size="sm" className="active:scale-[0.97]">
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Senha padrão: <span className="font-mono font-medium text-foreground">{DEFAULT_ROOM_PASSWORD}</span></p>
        </form>

        <div className="space-y-2">
          {roomEntries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma sala criada ainda.</p>
          )}
          {roomEntries.map(([room]) => (
            <div key={room} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm border border-border">
              <p className="font-medium text-foreground">{room}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/chat?room=${encodeURIComponent(room)}&admin=true`)} title="Entrar na sala">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => copyLink(room)} title="Copiar link">
                  <Copy className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Apagar histórico">
                      <Trash2 className="h-4 w-4 text-orange-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar histórico?</AlertDialogTitle>
                      <AlertDialogDescription>Todo o histórico de mensagens da sala "{room}" será apagado permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleClearChat(room)}>Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Remover sala">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover sala?</AlertDialogTitle>
                      <AlertDialogDescription>A sala "{room}" será removida permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(room)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
