export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Du bist der persönliche AI Coach eines ambitionierten jungen Unternehmers.
PROFIL: DHBW Student, Marketing-Agentur (3-4 Kunden), Kosmetik/Shopify im Aufbau, GEO-Tool (Pilot approved), Prop Firm Trading (MT5), Weiterbildung KI/Agenten.
BLOCKER: Prokrastination, kein klares System, letzter-Drücker-Mentalität.
STIL: Direkt, analytisch, kein Weichspülen, auf Deutsch, konkrete Ergebnisse.
Bei Tasks antworte NUR mit JSON: {"tasks":[{"title":"...","category":"business|trading|gym|uni|personal","weight":10}]}
Bei Skills antworte NUR mit JSON: {"skills":[{"name":"...","score":65,"trend":"up|stable|down","reasoning":"..."}]}`;

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

  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY fehlt in Vercel Environment Variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
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
  if (mode === 'tasks') systemPrompt += '\n\nMODUS: Generiere genau 5 Tasks. Antworte NUR mit validem JSON, absolut kein anderer Text.';
  if (mode === 'skills') systemPrompt += '\n\nMODUS: Bewerte Skills. Antworte NUR mit validem JSON, absolut kein anderer Text.';

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
        max_tokens: mode === 'chat' ? 1000 : 600,
        temperature: mode === 'chat' ? 0.7 : 0.3,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(JSON.stringify({ error: 'Groq Fehler', detail: errText }), {
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
    return new Response(JSON.stringify({ error: 'Interner Fehler', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
