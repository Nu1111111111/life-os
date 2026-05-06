module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY nicht gesetzt' });

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  const { messages, mode } = body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const SYSTEM_PROMPT = `Du bist der persoenliche AI Coach eines ambitionierten jungen Unternehmers.
PROFIL: DHBW Student, Marketing-Agentur (3-4 Kunden), Kosmetik/Shopify im Aufbau, GEO-Tool (Pilot approved), Prop Firm Trading (MT5), Weiterbildung KI/Agenten.
BLOCKER: Prokrastination, kein klares System, letzter-Druecker-Mentalitaet.
STIL: Direkt, analytisch, kein Weichspuelen, auf Deutsch, konkrete Ergebnisse.
Bei Tasks NUR JSON: {"tasks":[{"title":"...","category":"business|trading|gym|uni|personal","weight":10}]}
Bei Skills NUR JSON: {"skills":[{"name":"...","score":65,"trend":"up|stable|down","reasoning":"..."}]}`;

  const isVision = mode === 'vision';
  const model = isVision ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

  let systemPrompt = SYSTEM_PROMPT;
  if (mode === 'tasks') systemPrompt += '\n\nMODUS: Generiere genau 5 Tasks. NUR JSON, kein anderer Text.';
  if (mode === 'skills') systemPrompt += '\n\nMODUS: Bewerte Skills. NUR JSON, kein anderer Text.';

  const groqMessages = isVision ? messages : [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + groqKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        max_tokens: isVision ? 1000 : mode === 'chat' ? 1000 : 600,
        temperature: mode === 'chat' ? 0.7 : 0.3,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: 'Groq Fehler', detail: errText });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content });

  } catch (err) {
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
};
