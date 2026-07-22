const https = require('https');

exports.handler = async (event) => {
  const email = event.queryStringParameters?.email;
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email requerido' }) };

  try {
    const data = await new Promise((resolve, reject) => {
      let d = '';
      https.get(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, (r) => {
        r.on('data', c => d += c);
        r.on('end', () => {
          try { resolve(JSON.parse(d)); } catch { reject(new Error('Parse error')); }
        });
      }).on('error', reject);
    });

    const names = (data.breaches || []).flat();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, email, breaches: names, total: names.length })
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
