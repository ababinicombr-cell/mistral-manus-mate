import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSend: (text: string, attachments: { name: string; url: string }[]) => void;
  disabled?: boolean;
  userId?: string;
}

export function Composer({ onSend, disabled, userId }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !userId) return;
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("uploads").upload(path, f);
      if (error) throw error;
      const { data } = await supabase.storage.from("uploads").createSignedUrl(path, 60 * 60 * 24);
      setFiles((p) => [...p, { name: f.name, url: data?.signedUrl ?? "" }]);
    } catch (err: any) {
      toast({ title: "Falha no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t, files);
    setText(""); setFiles([]);
  };

  return (
    <div className="glass rounded-2xl p-3 shadow-[var(--shadow-soft)]">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-secondary rounded-full px-3 py-1">
              <Paperclip className="size-3" />{f.name}
              <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={ref} type="file" hidden onChange={onPickFile} />
        <Button size="icon" variant="ghost" onClick={() => ref.current?.click()} disabled={uploading || !userId}>
          <Paperclip className="size-4" />
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="Peça uma tarefa: criar um app, pesquisar, analisar..."
          className="flex-1 bg-transparent resize-none outline-none text-[15px] py-2 max-h-40"
          style={{ fieldSizing: "content" } as any}
        />
        <Button onClick={submit} disabled={disabled || !text.trim()} size="icon"
          style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
