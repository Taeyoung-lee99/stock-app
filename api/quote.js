export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { ticker, range = '1mo', interval = '1d', type } = req.query;
  const DART_KEY = process.env.DART_API_KEY;

  // 재무데이터 요청
  if (type === 'finance' && ticker) {
    try {
      const code = ticker.replace(/\.(KS|KQ)$/, '');
      // 회사코드 조회
      const corpRes = await fetch(
        `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_KEY}&stock_code=${code}`
      );
      const corpData = await corpRes.json();
      const corpCode = corpData.corp_code;
      if (!corpCode) return res.status(404).json({ error: 'corp not found' });

      // 최근 10년 재무데이터
      const years = [];
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 1; y >= currentYear - 10; y--) {
        years.push(y);
      }

      const results = await Promise.all(years.map(async (year) => {
        try {
          const r = await fetch(
            `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011&fs_div=CFS`
          );
          const d = await r.json();
          if (d.status !== '000') return null;
          const items = d.list || [];
          const get = (name) => {
            const item = items.find(i => i.account_nm === name && i.sj_div === 'IS');
            return item ? Math.round(parseInt(item.thstrm_amount?.replace(/,/g, '') || '0') / 100000000) : 0;
          };
          return {
            year: String(year),
            revenue: get('매출액') || get('수익(매출액)'),
            op: get('영업이익') || get('영업이익(손실)'),
            net: get('당기순이익') || get('당기순이익(손실)')
          };
        } catch (e) { return null; }
      }));

      const income = results.filter(Boolean).reverse();
      return res.status(200).json({ income, corpCode });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 주가 요청 (KS/KQ 자동 판별)
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
    } catch (e) { continue; }
  }
  res.status(500).json({ error: 'ticker not found' });
}
