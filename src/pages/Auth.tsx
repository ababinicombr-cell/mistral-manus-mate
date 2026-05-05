import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Entrar — Manus Clone";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "Conta criada", description: "Verifique seu email para confirmar." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md shadow-[var(--shadow-elegant)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Manus Clone</h1>
            <p className="text-xs text-muted-foreground">Agente AI autônomo</p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-1">
          {mode === "signin" ? "Bem-vindo de volta" : "Criar sua conta"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin" ? "Entre para continuar suas tarefas" : "Comece a delegar tarefas ao agente"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
            {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
