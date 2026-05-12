import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Shield, BookOpen } from "lucide-react";
import { ScripturesReader } from "@/components/ScripturesReader";

export default function Index() {
  const navigate = useNavigate();
  const [scripturesOpen, setScripturesOpen] = useState(false);

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
          <button
            onClick={() => setScripturesOpen(true)}
            aria-label="Abrir escrituras"
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 hover:from-primary/25 hover:to-primary/10 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <BookOpen className="h-9 w-9 text-primary" strokeWidth={1.5} />
          </button>
          <p className="text-xs text-muted-foreground">Escrituras Sagradas</p>

          <Button
            variant="outline"
            className="w-full active:scale-[0.97] mt-4"
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

      <ScripturesReader open={scripturesOpen} onOpenChange={setScripturesOpen} />
    </div>
  );
}
