export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Du bist der persönliche AI Coach und Life Operating System eines ambitionierten jungen Unternehmers.

NUTZERPROFIL:
- DHBW Student, Praxisphase bei Procda
- Aufsteht: ~08:00, schlafen: 22:00-00:00
- Produktive Stunden: bis zu 12-14h an freien Tagen
- Gym: 4-5x/Woche (nur Push + Pull), Cardio täglich oder jeden 2. Tag

HAUPTZIELE:
1. SELBSTÄNDIGKEIT: Marketing-Agentur (3-4 Kunden), Kosmetik/Shopify im Aufbau
2. GEO-TOOL: Pilot approved, debuggen, KPIs aufstellen
3. WEITERBILDUNG: KI, Agenten, Prompt Engineering, Finance, Immobilien (5-10h/Woche)
4. PROP FIRM TRADING: MT5, von Backtesting zu Live

BLOCKER: Prokrastination, kein klares System, Ablenkung, letzter-Drücker-Mentalität

DEINE ROLLE:
- Direkt, analytisch, kein Weichspülen
- Konkrete Aufgaben und Priorisierung
- Auf Deutsch antworten
- Muster erkennen und Risiken benennen

Wenn du Tasks generierst, antworte NUR mit JSON:
{"tasks":[{"title":"...","category":"business|trading|gym|uni|personal","weight":10}]}

Wenn du Skills bewertest, antworte NUR mit JSON:
{"skills":[{"name":"...","score":65,"trend":"up|stable|down","reasoning":"..."}]}`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Edge Runtime uses this syntax for env vars
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not set in Vercel Environment Variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { messages, mode } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let systemPrompt = SYSTEM_PROMPT;

  if (mode === 'tasks') {
    systemPrompt += '\n\nMODUS: Generiere 5 Tasks. Antworte NUR mit validem JSON, kein anderer Text.';
  } else if (mode === 'skills') {
    systemPrompt += '\n\nMODUS: Bewerte Skills. Antworte NUR mit validem JSON, kein anderer Text.';
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: mode === 'tasks' || mode === 'skills' ? 600 : 1000,
        temperature: mode === 'tasks' || mode === 'skills' ? 0.3 : 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(JSON.stringify({ error: 'Groq API error', detail: errText }), {
        status: groqRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ content }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
