// POST /api/idea — relays a personal idea into the Blue Hen data engine's
// exhaust pipeline. No dependencies; Vercel Node serverless function.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const ideaPass = process.env.IDEA_PASS;
  if (!ideaPass) {
    res.status(503).json({ error: 'capture not configured' });
    return;
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (err) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
  }

  const { text, pass } = body || {};

  if (pass !== ideaPass) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  if (typeof text !== 'string' || text.length < 3 || text.length > 4000) {
    res.status(400).json({ error: 'text must be 3-4000 characters' });
    return;
  }

  const synthApiKey = process.env.SYNTH_API_KEY;
  if (!synthApiKey) {
    res.status(503).json({ error: 'capture not configured' });
    return;
  }

  try {
    const upstream = await fetch('https://api-production-3dea.up.railway.app/v1/exhaust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${synthApiKey}`,
      },
      body: JSON.stringify({
        source: 'jcamd-ideas',
        kind: 'submission',
        consent: true,
        payload: { event: 'idea', text },
      }),
    });

    if (!upstream.ok) {
      let detail;
      try {
        detail = await upstream.text();
      } catch (err) {
        detail = '';
      }
      res.status(502).json({ error: 'upstream rejected the idea', detail: detail });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'failed to reach the engine', detail: String(err && err.message || err) });
  }
};
