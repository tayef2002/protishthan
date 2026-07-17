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
  const text = url.searchParams.get('text') || '';
  if (!text.trim()) {
    return Response.json({ error: 'empty text' }, { status: 400, headers: CORS });
  }

  const apiKey = context.env.GROQ_API_KEY || GROQ_API_KEY;

  const prompt = `أنت خبير في التشكيل والتجويد. ضع التشكيل الكامل الدقيق على كل حرف بدون استثناء. تنبيه مهم: الألف في بداية الكلام تأخذ فتحة (اَ)، ولا تنسَ الشدة مع حركتها على الحروف المشددة.\n\nالآن شكّل هذا النص بالكامل وأرجعه فقط بدون أي شرح:\n${text}`;

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
          { role: 'system', content: 'أنت عالم في اللغة العربية والتشكيل والتجويد. تُضيف الشكل الكامل على كل حرف بدقة عالية.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    const json = await res.json();
    let result = json.choices?.[0]?.message?.content?.trim() || '';
    result = result.replace(/أ/g, 'ا').replace(/إ/g, 'ا');
    result = result.replace(/ اَ(ل)/g, ' ا');
    result = result.replace(/ِي(?![ً-ْٟ])/g, 'ِيْ');
    result = result.replace(/ُو(?![ً-ْٟ])/g, 'ُوْ');
    result = result.replace(/([ً-َُِْ])ّ/g, 'ّ$1');
    return Response.json({ result }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502, headers: CORS });
  }
}
