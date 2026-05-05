import { Plus, MessageSquare, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface Conversation { id: string; title: string; updated_at: string; }

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  email?: string;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, email }: Props) {
  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
        <div className="size-8 rounded-lg grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-semibold text-sidebar-foreground">Manus Clone</div>
          <div className="text-[10px] text-muted-foreground">powered by Mistral</div>
        </div>
      </div>

      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="secondary">
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-start gap-2 mb-1 transition ${
              activeId === c.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <MessageSquare className="size-3.5 mt-0.5 shrink-0 opacity-60" />
            <span className="truncate">{c.title}</span>
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">Nenhuma conversa ainda</p>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate">{email}</span>
        <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()} title="Sair">
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
