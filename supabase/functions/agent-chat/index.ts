// Mistral-powered agent with planning + tools (web search, artifacts)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Você é Manus AI, um agente autônomo brasileiro que executa tarefas complexas.

CAPACIDADES:
- Decompor tarefas em passos visíveis usando a tool "create_plan"
- Atualizar o status dos passos com "update_task" (running → done/failed)
- Pesquisar na web com "web_search" para fatos atuais
- Criar artefatos (apps web HTML/JS, código, relatórios markdown) com "create_artifact"

REGRAS:
1. Para tarefas complexas (>1 passo), SEMPRE comece criando um plano com create_plan.
2. Marque cada passo como "running" antes de executar e "done" ao terminar.
3. Quando criar um app web, use create_artifact com kind="html" e um documento HTML completo (com <style> e <script> inline, sem dependências externas exceto CDN do Tailwind se útil).
4. Responda em português, formatação markdown rica, seja conciso mas completo.
5. Sempre conclua com um resumo final do que foi entregue.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_plan",
      description: "Cria a lista de passos do plano de execução visível ao usuário",
      parameters: {
        type: "object",
        properties: {
          steps: { type: "array", items: { type: "string" }, description: "Títulos curtos dos passos, em ordem" },
        },
        required: ["steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Atualiza status de um passo do plano",
      parameters: {
        type: "object",
        properties: {
          position: { type: "number", description: "Índice (0-based) do passo" },
          status: { type: "string", enum: ["running", "done", "failed"] },
          result: { type: "string", description: "Resultado curto do passo (opcional)" },
        },
        required: ["position", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Pesquisa na web e retorna resultados resumidos",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_artifact",
      description: "Cria um arquivo entregável (app web HTML, código, ou relatório markdown)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["html", "code", "markdown"] },
          language: { type: "string", description: "Linguagem se kind=code (ex: python, js)" },
          content: { type: "string", description: "Conteúdo completo do arquivo" },
        },
        required: ["title", "kind", "content"],
      },
    },
  },
];

async function webSearch(query: string): Promise<string> {
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`);
    const d = await r.json();
    const out: string[] = [];
    if (d.AbstractText) out.push(`${d.AbstractText} (${d.AbstractURL || ""})`);
    if (Array.isArray(d.RelatedTopics)) {
      for (const t of d.RelatedTopics.slice(0, 6)) {
        if (t.Text && t.FirstURL) out.push(`- ${t.Text} — ${t.FirstURL}`);
      }
    }
    if (out.length === 0) {
      const r2 = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      const t = await r2.text();
      const matches = [...t.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
      for (const m of matches) out.push(`- ${m[2].trim()} — ${m[1]}`);
    }
    return out.join("\n") || "Sem resultados.";
  } catch (e) {
    return `Erro de busca: ${e instanceof Error ? e.message : String(e)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { conversationId, userMessage } = body;
    if (!conversationId || !userMessage) {
      return new Response(JSON.stringify({ error: "conversationId e userMessage obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // save user message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: userMessage,
    });

    // load history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // agent loop with tools (max 6 iterations)
    let finalContent = "";
    for (let iter = 0; iter < 6; iter++) {
      const resp = await fetch(MISTRAL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.4,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Mistral ${resp.status}: ${t.slice(0, 400)}`);
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("Resposta vazia do Mistral");

      messages.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (!toolCalls.length) {
        finalContent = msg.content ?? "";
        break;
      }

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
        let result = "";

        try {
          if (name === "create_plan") {
            // wipe previous tasks
            await supabase.from("tasks").delete().eq("conversation_id", conversationId);
            const rows = (args.steps ?? []).map((title: string, i: number) => ({
              conversation_id: conversationId,
              user_id: user.id,
              position: i,
              title,
              status: "pending",
            }));
            if (rows.length) await supabase.from("tasks").insert(rows);
            result = `Plano criado: ${rows.length} passos.`;
          } else if (name === "update_task") {
            await supabase
              .from("tasks")
              .update({ status: args.status, result: args.result ?? null })
              .eq("conversation_id", conversationId)
              .eq("position", args.position);
            result = `Passo ${args.position} → ${args.status}.`;
          } else if (name === "web_search") {
            result = await webSearch(args.query ?? "");
          } else if (name === "create_artifact") {
            const { data: art } = await supabase
              .from("artifacts")
              .insert({
                conversation_id: conversationId,
                user_id: user.id,
                title: args.title ?? "Artefato",
                kind: args.kind ?? "html",
                language: args.language ?? null,
                content: args.content ?? "",
              })
              .select()
              .single();
            result = `Artefato criado (id ${art?.id}, kind=${args.kind}).`;
          } else {
            result = `Tool desconhecida: ${name}`;
          }
        } catch (e) {
          result = `Erro na tool ${name}: ${e instanceof Error ? e.message : String(e)}`;
        }

        messages.push({ role: "tool", tool_call_id: tc.id, name, content: result });
      }
    }

    // save assistant message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "assistant",
      content: finalContent || "(sem conteúdo)",
    });

    // auto-title if first exchange
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    if ((count ?? 0) <= 2) {
      const t = userMessage.slice(0, 60).replace(/\n/g, " ");
      await supabase.from("conversations").update({ title: t || "Nova tarefa" }).eq("id", conversationId);
    }

    return new Response(JSON.stringify({ content: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
