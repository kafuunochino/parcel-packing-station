import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
http.createServer(async(req,res)=>{
 try {
  const relative = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  const data = await readFile(file);
  res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html','.wav':'audio/wav','.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
  res.end(data);
 } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4199,'127.0.0.1',()=>console.log('Local-only http://127.0.0.1:4199'));
