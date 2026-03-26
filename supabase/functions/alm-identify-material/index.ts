import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error('imageBase64 is required');

    // Fetch all active materials for matching
    const { data: materiais, error } = await supabase
      .from('alm_materiais')
      .select('id, codigo, nome, categoria, unidade')
      .eq('status', 'Ativo')
      .order('nome');

    if (error) throw new Error(`DB error: ${error.message}`);

    const materialList = (materiais || []).map(m => `- ${m.codigo}: ${m.nome} (${m.categoria || 'sem categoria'}, ${m.unidade})`).join('\n');

    // Call Lovable AI Gateway with vision
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de almoxarifado. O usuário vai enviar uma foto de um material/produto. 
Analise a imagem e identifique o produto. Depois, compare com a lista de materiais cadastrados abaixo e retorne os melhores matches.

LISTA DE MATERIAIS CADASTRADOS:
${materialList}

RESPONDA EXATAMENTE neste formato JSON (sem markdown, sem código, apenas JSON puro):
{
  "descricao": "descrição breve do que você vê na foto",
  "matches": [
    {"codigo": "código do material", "nome": "nome do material", "confianca": 85}
  ]
}

- "matches" deve ter no máximo 5 itens, ordenados por confiança (0-100)
- Se nenhum material da lista corresponder, retorne matches vazio
- "confianca" é um percentual de certeza de 0 a 100`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Identifique este material/produto e encontre no cadastro:' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${err}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { descricao: content, matches: [] };
    }

    // Enrich matches with full material data
    const enrichedMatches = (parsed.matches || []).map((match: any) => {
      const mat = materiais?.find(m => m.codigo === match.codigo);
      return mat ? { ...mat, confianca: match.confianca } : null;
    }).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      descricao: parsed.descricao,
      matches: enrichedMatches,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    console.error('ALM identify error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
