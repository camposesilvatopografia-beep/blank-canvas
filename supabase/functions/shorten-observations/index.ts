import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { observations } = await req.json();
    // observations: Array<{ key: string, text: string }>

    if (!observations || !Array.isArray(observations) || observations.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a single prompt with all observations
    const obsListText = observations
      .map((o: { key: string; text: string }, i: number) => `${i + 1}. "${o.text}"`)
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que resume textos de observação de equipamentos de obra.
Para cada observação, gere um resumo de NO MÁXIMO 2 ou 3 palavras em português.
Exemplos:
- "Manutenção: Troca de óleo do motor (2.50h)" → "Troca óleo"
- "Manutenção: Reparo hidráulico (1.00h) | Chuva: 12.5mm" → "Reparo + Chuva"
- "Manutenção: Pneu furado (0.50h)" → "Pneu furado"
- "Chuva: 25.0mm" → "Chuva"
- "Excedente: 1.25h → próx. dia" → "Excedente h"
- "Manutenção: Revisão geral do sistema elétrico e hidráulico (4.00h)" → "Revisão geral"
- "Troca de filtros e correias" → "Filtros/correias"

Responda APENAS com um JSON array de strings, na mesma ordem da entrada.
Exemplo de resposta: ["Troca óleo", "Reparo + Chuva", "Pneu furado"]`
          },
          {
            role: "user",
            content: `Resuma cada observação abaixo em 2-3 palavras:\n${obsListText}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON array from the response
    let shortened: string[];
    try {
      // Try to extract JSON array from the response
      const match = content.match(/\[[\s\S]*\]/);
      shortened = match ? JSON.parse(match[0]) : [];
    } catch {
      shortened = [];
    }

    // Map back to key-value pairs
    const results = observations.map((o: { key: string; text: string }, i: number) => ({
      key: o.key,
      shortened: shortened[i] || o.text,
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shorten-observations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
