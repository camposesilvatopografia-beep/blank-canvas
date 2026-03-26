import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Você é um leitor OCR especializado em visores de balança rodoviária e industrial.

Analise esta imagem e extraia APENAS o valor numérico principal exibido no visor/display da balança.

REGRAS:
1. Identifique o número principal no display digital (LEDs verdes, vermelhos ou LCD)
2. Ignore textos como "kg", "t", "ton", "bruto", "líquido", "tara"
3. Interprete o número como quilogramas INTEIROS
4. Se o display mostra separadores de milhar (ponto no formato brasileiro), ignore-os
5. Se o display mostra casas decimais após vírgula, IGNORE as casas decimais (arredonde)
6. Exemplos:
   - Display "45.320" → responda: 45320
   - Display "45320" → responda: 45320
   - Display "45.320,00" → responda: 45320
   - Display "12.500" → responda: 12500
   - Display "8.740" → responda: 8740
   - Display "85.020" → responda: 85020
   - Display "33.220,00" → responda: 33220
7. SEMPRE retorne apenas os dígitos do peso em quilogramas inteiros, sem separadores

Retorne APENAS os dígitos numéricos, nada mais. Se não conseguir ler, retorne: ERRO`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "ERRO";

    // Extract only digits from the result
    const digits = result.replace(/[^0-9]/g, "");

    return new Response(
      JSON.stringify({ value: digits || "ERRO", raw: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
