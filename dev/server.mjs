// Dev runner without Meteor: builds scss, serves repo root statically, SPA fallback to dev/index.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3000;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

// Meteor load order: client/lib first, then remaining dirs; deeper paths before shallower; alphabetical.
function clientScripts() {
    const all = [];
    (function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) all.push(path.relative(root, p));
        }
    })(path.join(root, 'client'));
    const depth = f => f.split(path.sep).length;
    const lib = all.filter(f => f.startsWith('client/lib/')).sort((a, b) => a.endsWith('app.js') ? -1 : b.endsWith('app.js') ? 1 : 0);
    const rest = all.filter(f => !f.startsWith('client/lib/')).sort((a, b) => depth(b) - depth(a) || a.localeCompare(b));
    return [...lib, ...rest];
}

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    try {
        if (url === '/dev/scripts.js') {
            // Load each script in order via document.write-free sync XHR-free approach: concatenate.
            return send(200, types['.js'], clientScripts().map(f => `/* ${f} */\n` + fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n'));
        }
        if (url === '/dev/main.css') {
            return send(200, types['.css'], sass.compile(path.join(root, 'client/stylesheets/main.scss')).css);
        }
        const file = path.join(root, url);
        if (file.startsWith(root + path.sep) && !file.includes(path.sep + '.git') && fs.existsSync(file) && fs.statSync(file).isFile() && url !== '/index.html') {
            return send(200, types[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
        }
        send(200, types['.html'], fs.readFileSync(path.join(root, 'dev/index.html')));
    } catch (err) {
        console.error(err);
        send(500, 'text/plain', String(err.stack || err));
    }
}).listen(port, () => console.log(`cpu-simulator on http://localhost:${port}`));
