import { useState } from "react";
import { Code, Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Artifact {
  id: string;
  title: string;
  kind: "html" | "code" | "markdown" | "file";
  language?: string | null;
  content: string;
  created_at: string;
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [tab, setTab] = useState<"preview" | "code">(artifact.kind === "html" ? "preview" : "code");

  const download = () => {
    const ext = artifact.kind === "html" ? "html" : artifact.kind === "markdown" ? "md" : (artifact.language || "txt");
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${artifact.title.replace(/[^\w-]+/g, "_")}.${ext}`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2 min-w-0">
          {artifact.kind === "html" ? <Eye className="size-4 text-primary" /> : artifact.kind === "code" ? <Code className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
          <span className="text-sm font-medium truncate">{artifact.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {artifact.kind === "html" && (
            <>
              <Button size="sm" variant={tab === "preview" ? "secondary" : "ghost"} onClick={() => setTab("preview")} className="h-7 px-2 text-xs">Preview</Button>
              <Button size="sm" variant={tab === "code" ? "secondary" : "ghost"} onClick={() => setTab("code")} className="h-7 px-2 text-xs">Código</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={download} className="h-7 px-2"><Download className="size-3.5" /></Button>
        </div>
      </div>
      {artifact.kind === "html" && tab === "preview" ? (
        <iframe title={artifact.title} sandbox="allow-scripts" srcDoc={artifact.content} className="w-full h-[420px] bg-white" />
      ) : (
        <pre className="text-xs font-mono p-4 max-h-[420px] overflow-auto scrollbar-thin bg-[hsl(222_20%_5%)]">
          <code>{artifact.content}</code>
        </pre>
      )}
    </div>
  );
}
