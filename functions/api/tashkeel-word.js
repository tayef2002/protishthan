const GROQ_API_KEY = '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const word = url.searchParams.get('word') || '';
  const ctx = url.searchParams.get('context') || '';
  if (!word.trim()) {
    return Response.json({ error: 'empty word' }, { status: 400, headers: CORS });
  }

  const apiKey = context.env.GROQ_API_KEY || GROQ_API_KEY;

  const prompt = `أنت خبير في اللغة العربية والتشكيل والنحو. الكلمة المطلوبة هي: "${word}"\nالسياق الكامل: "${ctx || word}"\n\nأعطني 5 طرق صحيحة نحوياً لتشكيل هذه الكلمة. أرجع فقط الكلمات مفصولة بفاصلة (،) بدون أي شرح.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'أنت عالم في اللغة العربية والتشكيل والنحو والصرف.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    const json = await res.json();
    let raw = json.choices?.[0]?.message?.content?.trim() || '';
    let suggestions = raw.split(/[,،\n\r]+/).map(s => s.trim()).filter(s => s.length > 0 && /[؀-ۿ]/.test(s));
    suggestions = suggestions.map(s => s.replace(/أ/g, 'ا').replace(/إ/g, 'ا'));
    if (!suggestions.includes(word)) suggestions.unshift(word);
    suggestions = suggestions.slice(0, 5);
    return Response.json({ suggestions }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502, headers: CORS });
  }
}
