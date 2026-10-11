// ローカル検証専用。Google保存後の応答だけを1回切断し、同一ID再試行を検証する。
// 応募内容・秘密情報はログに出力しない。通常の開発サーバーやGoogle設定は変更しない。
import http from 'node:http';
let dropNextResponse = true;
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await fetch('http://127.0.0.1:5173' + req.url, {
      method: req.method,
      headers: req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {},
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (req.method === 'POST' && req.url === '/api/test-entry' && dropNextResponse) {
      const result = JSON.parse(bytes.toString('utf8'));
      if (result.ok !== true) throw Error('UPSTREAM_NOT_SAVED');
      dropNextResponse = false;
      console.log('Google保存成功後、ブラウザへの応答を1回切断しました。');
      res.destroy(); return;
    }
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/octet-stream');
    res.end(bytes);
  } catch { res.statusCode = 502; res.end('Test proxy unavailable'); }
});
server.listen(5174, '127.0.0.1', () => console.log('通信切断試験: http://127.0.0.1:5174/ （架空データ専用）'));
