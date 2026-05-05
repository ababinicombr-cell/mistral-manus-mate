import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar, type Conversation } from "@/components/manus/Sidebar";
import { ChatMessage, TypingBubble } from "@/components/manus/ChatMessage";
import { TaskList, type Task } from "@/components/manus/TaskList";
import { ArtifactCard, type Artifact } from "@/components/manus/ArtifactView";
import { Composer } from "@/components/manus/Composer";
import { Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Msg { id: string; role: "user" | "assistant" | "system" | "tool"; content: string; }

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Manus Clone — Agente AI";
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
      else setUser(data.session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // load conversations
  useEffect(() => {
    if (!user) return;
    supabase.from("conversations").select("*").order("updated_at", { ascending: false }).then(({ data }) => {
      setConversations((data ?? []) as Conversation[]);
      if (data && data.length && !activeId) setActiveId(data[0].id);
    });
  }, [user]);

  // load active conversation data
  useEffect(() => {
    if (!activeId) { setMessages([]); setTasks([]); setArtifacts([]); return; }
    Promise.all([
      supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at"),
      supabase.from("tasks").select("*").eq("conversation_id", activeId).order("position"),
      supabase.from("artifacts").select("*").eq("conversation_id", activeId).order("created_at"),
    ]).then(([m, t, a]) => {
      setMessages((m.data ?? []) as Msg[]);
      setTasks((t.data ?? []) as Task[]);
      setArtifacts((a.data ?? []) as Artifact[]);
    });

    const ch = supabase
      .channel(`conv-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (p) => {
          if (p.eventType === "INSERT") setMessages((prev) => prev.some(x => x.id === (p.new as any).id) ? prev : [...prev, p.new as Msg]);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `conversation_id=eq.${activeId}` },
        () => supabase.from("tasks").select("*").eq("conversation_id", activeId).order("position").then(({ data }) => setTasks((data ?? []) as Task[])))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "artifacts", filter: `conversation_id=eq.${activeId}` },
        (p) => setArtifacts((prev) => [...prev, p.new as Artifact]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const newConversation = async () => {
    if (!user) return;
    const { data } = await supabase.from("conversations").insert({ user_id: user.id, title: "Nova tarefa" }).select().single();
    if (data) {
      setConversations((p) => [data as Conversation, ...p]);
      setActiveId(data.id);
    }
  };

  const send = async (text: string, attachments: { name: string; url: string }[]) => {
    if (!user) return;
    let convId = activeId;
    if (!convId) {
      const { data } = await supabase.from("conversations").insert({ user_id: user.id, title: text.slice(0, 60) }).select().single();
      if (!data) return;
      convId = data.id;
      setConversations((p) => [data as Conversation, ...p]);
      setActiveId(convId);
    }
    const fullText = attachments.length
      ? `${text}\n\n_Anexos:_ ${attachments.map(a => `[${a.name}](${a.url})`).join(", ")}`
      : text;

    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("agent-chat", {
        body: { conversationId: convId, userMessage: fullText },
      });
      if (error) throw error;
      // refresh title list
      supabase.from("conversations").select("*").order("updated_at", { ascending: false }).then(({ data }) => setConversations((data ?? []) as Conversation[]));
    } catch (e: any) {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `⚠️ Erro: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newConversation}
        email={user.email ?? ""}
      />

      <main className="flex-1 flex min-w-0">
        <section className="flex-1 flex flex-col min-w-0">
          <header className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h1 className="text-sm font-medium truncate">
              {conversations.find(c => c.id === activeId)?.title ?? "Nova tarefa"}
            </h1>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-center">
                <div className="max-w-md">
                  <div className="size-14 rounded-2xl mx-auto mb-4 grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
                    <Sparkles className="size-7 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">O que vamos construir hoje?</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Peça pesquisas, análises, código ou um app web completo. Eu planejo, executo e entrego.
                  </p>
                  <div className="grid gap-2 text-left">
                    {[
                      "Crie um app de calculadora de gorjetas com HTML/JS",
                      "Pesquise as últimas notícias sobre IA e me dê um resumo",
                      "Faça uma landing page para uma cafeteria",
                    ].map((s) => (
                      <button key={s} onClick={() => send(s, [])}
                        className="text-sm text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
                {busy && <TypingBubble />}
                {artifacts.length > 0 && (
                  <div className="space-y-3 pt-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Artefatos entregues</div>
                    {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
              <Composer onSend={send} disabled={busy} userId={user.id} />
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Mistral pode cometer erros. Verifique informações importantes.
              </p>
            </div>
          </div>
        </section>

        <aside className="hidden lg:flex w-80 shrink-0 border-l border-border flex-col bg-sidebar/40">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Plano de execução</h2>
            <p className="text-[11px] text-muted-foreground">Atualizado em tempo real</p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <TaskList tasks={tasks} />
          </div>
        </aside>
      </main>
    </div>
  );
}
