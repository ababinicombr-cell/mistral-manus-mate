import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, User } from "lucide-react";

interface Props {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export function ChatMessage({ role, content }: Props) {
  if (role === "system" || role === "tool") return null;
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`size-8 rounded-lg shrink-0 grid place-items-center ${isUser ? "bg-secondary" : ""}`}
        style={!isUser ? { background: "var(--gradient-primary)" } : undefined}
      >
        {isUser ? <User className="size-4 text-muted-foreground" /> : <Sparkles className="size-4 text-primary-foreground" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? "bg-secondary" : "glass"}`}>
        <div className="prose-chat text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "…"}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex gap-3">
      <div className="size-8 rounded-lg shrink-0 grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
        <Sparkles className="size-4 text-primary-foreground" />
      </div>
      <div className="glass rounded-2xl px-4 py-3 flex gap-1.5 items-center">
        <span className="typing-dot size-2 rounded-full bg-primary" />
        <span className="typing-dot size-2 rounded-full bg-primary" />
        <span className="typing-dot size-2 rounded-full bg-primary" />
      </div>
    </div>
  );
}
