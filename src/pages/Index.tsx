import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Shield } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">SecureChat</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Chat em tempo real com criptografia ponta-a-ponta. Mensagens que desaparecem ao recarregar.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full active:scale-[0.97]"
            onClick={() => navigate("/admin")}
          >
            <Shield className="h-4 w-4 mr-2" />
            Painel Admin
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Para entrar em uma sala, use o link compartilhado pelo admin.
        </p>
      </div>
    </div>
  );
}
