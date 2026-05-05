import { Check, Circle, Loader2, X, ListChecks } from "lucide-react";

export interface Task {
  id: string;
  position: number;
  title: string;
  status: "pending" | "running" | "done" | "failed";
  result?: string | null;
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <ListChecks className="size-8 mx-auto mb-2 opacity-40" />
        Nenhum plano ainda. Peça uma tarefa.
      </div>
    );
  }
  return (
    <ol className="space-y-2 p-3">
      {tasks.sort((a, b) => a.position - b.position).map((t) => (
        <li key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
          <span className="mt-0.5 shrink-0">
            {t.status === "done" && <Check className="size-4 text-success" />}
            {t.status === "running" && <Loader2 className="size-4 text-primary animate-spin" />}
            {t.status === "pending" && <Circle className="size-4 text-muted-foreground" />}
            {t.status === "failed" && <X className="size-4 text-destructive" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-sm ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {t.title}
            </div>
            {t.result && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.result}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
