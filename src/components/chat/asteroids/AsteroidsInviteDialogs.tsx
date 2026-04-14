import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Rocket } from "lucide-react";
import type { AsteroidsInvite } from "./types";

interface InviteChooserProps {
  open: boolean;
  onClose: () => void;
  onlineUsers: string[];
  nickname: string;
  onInvite: (target: string) => void;
}

export function AsteroidsInviteChooser({
  open,
  onClose,
  onlineUsers,
  nickname,
  onInvite,
}: InviteChooserProps) {
  const others = onlineUsers.filter((user) => user !== nickname);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Asteroides
          </DialogTitle>
          <DialogDescription>Escolha alguém da sala para jogar.</DialogDescription>
        </DialogHeader>

        <div className="max-h-48 space-y-1 overflow-y-auto">
          {others.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Ninguém online</p>
          ) : (
            others.map((user) => (
              <button
                key={user}
                type="button"
                onClick={() => {
                  onInvite(user);
                  onClose();
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                {user}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface InvitePopupProps {
  invite: AsteroidsInvite;
  onAccept: () => void;
  onDecline: () => void;
}

export function AsteroidsInvitePopup({ invite, onAccept, onDecline }: InvitePopupProps) {
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onDecline()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Convite Asteroides
          </DialogTitle>
          <DialogDescription>
            <strong>{invite.from}</strong> quer jogar Asteroides com você.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button type="button" onClick={onAccept} className="flex-1">
            Aceitar
          </Button>
          <Button type="button" variant="outline" onClick={onDecline} className="flex-1">
            Recusar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
