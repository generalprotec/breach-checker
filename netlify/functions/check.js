const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    https.get(url, (res) => {
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Error parseando respuesta')); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};

  try {
    // Password check
    if (q.password) {
      const prefix = q.password.trim().toLowerCase();
      if (!/^[0-9a-f]{10}$/.test(prefix)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Hash prefix debe tener 10 caracteres hex' }) };
      }
      const data = await fetchJSON(`https://passwords.xposedornot.com/api/v1/pass/anon/${prefix}`);
      if (data.Error === 'Not found') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, type: 'password', found: false })
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, type: 'password', found: true, result: data.SearchPassAnon })
      };
    }

    // List all breaches
    if (q.breaches === '1') {
      const url = q.domain
        ? `https://api.xposedornot.com/v1/breaches?domain=${encodeURIComponent(q.domain)}`
        : 'https://api.xposedornot.com/v1/breaches';
      const data = await fetchJSON(url);
      const list = data.exposedBreaches || [];
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, type: 'breaches', breaches: list, total: list.length })
      };
    }

    // Search breaches metadata
    if (q.search) {
      const query = q.search.trim().toLowerCase();
      const data = await fetchJSON('https://api.xposedornot.com/v1/breaches');
      const list = data.exposedBreaches || [];
      const matches = list.filter(b => {
        const name = (b.breachID || '').toLowerCase();
        const desc = (b.exposureDescription || '').toLowerCase();
        const domain = (b.domain || '').toLowerCase();
        const types = (b.exposedData || []).join(' ').toLowerCase();
        return name.includes(query) || desc.includes(query) || domain.includes(query) || types.includes(query);
      });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, type: 'search', query, breaches: matches, total: matches.length })
      };
    }

    // Email check
    const email = q.email;
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email requerido' }) };
    }

    const checkData = await fetchJSON(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`);
    const breaches = (checkData.breaches || []).flat();
    const notFound = checkData.Error === 'Not found';

    let analytics = null;
    if (!notFound && breaches.length > 0 && q.analytics !== '0') {
      try {
        analytics = await fetchJSON(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`);
      } catch { }
    }

    if (notFound) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, type: 'email', email, breaches: [], total: 0, analytics: null })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, type: 'email', email, breaches, total: breaches.length, analytics })
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
