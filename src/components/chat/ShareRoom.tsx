import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Share2, Copy, MessageCircle, Send, Mail, Facebook, Twitter, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface ShareRoomProps {
  room: string;
}

export default function ShareRoom({ room }: ShareRoomProps) {
  const url = `${window.location.origin}/chat?room=${encodeURIComponent(room)}`;
  const text = `Entre na minha sala de chat "${room}": ${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Sala: ${room}`, text, url });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const shareTargets = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      color: "text-green-600",
      href: `https://wa.me/?text=${encodeURIComponent(text)}`,
    },
    {
      label: "Telegram",
      icon: Send,
      color: "text-sky-500",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Entre na minha sala "${room}"`)}`,
    },
    {
      label: "Facebook",
      icon: Facebook,
      color: "text-blue-600",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: "Twitter / X",
      icon: Twitter,
      color: "text-foreground",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    },
    {
      label: "Email",
      icon: Mail,
      color: "text-muted-foreground",
      href: `mailto:?subject=${encodeURIComponent(`Sala de chat: ${room}`)}&body=${encodeURIComponent(text)}`,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Compartilhar sala" className="h-8 w-8">
          <Share2 className="h-4 w-4 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="bottom" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Compartilhar sala</p>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 border border-border mb-2">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{url}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            <span className="text-xs">Copiar URL</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleNativeShare}>
            <Share2 className="h-3.5 w-3.5" />
            <span className="text-xs">Compartilhar</span>
          </Button>
        </div>
        <div className="border-t border-border pt-2">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Enviar via</p>
          <div className="grid grid-cols-5 gap-1">
            {shareTargets.map((t) => (
              <a
                key={t.label}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                title={t.label}
                className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-muted transition-colors"
              >
                <t.icon className={`h-5 w-5 ${t.color}`} />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{t.label}</span>
              </a>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
