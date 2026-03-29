export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { ticker, range = '1mo', interval = '1d' } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const code = ticker.replace(/\.(KS|KQ)$/, '');
  const markets = ticker.endsWith('.KQ') ? ['KQ', 'KS'] : ['KS', 'KQ'];

  for (const market of markets) {
    try {
      const t = `${code}.${market}`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=${range}&interval=${interval}&includePrePost=false`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const price = result.meta?.regularMarketPrice;
      if (!price || price <= 0) continue;
      return res.status(200).json(data);
    } catch (e) {
      continue;
    }
  }
  res.status(500).json({ error: 'ticker not found in KS or KQ' });
}
