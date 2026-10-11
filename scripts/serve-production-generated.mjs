import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = new Map([
  ['/code.txt', ['Code.gs', 'text/plain; charset=utf-8']],
  ['/Index.html.txt', ['Index.html', 'text/plain; charset=utf-8']],
  ['/appsscript.json.txt', ['appsscript.json', 'text/plain; charset=utf-8']],
]);
const root = resolve('apps-script/production-generated');
const port = Number(process.argv[2] ?? 8765);

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const target = files.get(request.url ?? '');
  if (!target) { response.writeHead(404).end('Not found'); return; }
  try {
    response.setHeader('Content-Type', target[1]);
    response.end(await readFile(resolve(root, target[0])));
  } catch {
    response.writeHead(500).end('Unavailable');
  }
}).listen(port, '127.0.0.1', () => console.log(`Generated files: http://127.0.0.1:${port}`));
