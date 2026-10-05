import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = 4174;
const files = new Map([
  ['/index.html', { url: new URL('../demo/index.html', import.meta.url), type: 'text/html; charset=utf-8' }],
  ['/app.js', { url: new URL('../demo/app.js', import.meta.url), type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { url: new URL('../demo/styles.css', import.meta.url), type: 'text/css; charset=utf-8' }],
]);
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  response.end(body);
}

const server = createServer(async (request, response) => {
  let pathname;
  try {
    // Decode the raw path before URL normalization can discard dot segments.
    pathname = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch {
    send(response, 400, 'Malformed request path.');
    return;
  }
  if (!pathname.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(pathname) || pathname.split('/').some((segment) => segment === '.' || segment === '..')) {
    send(response, 400, 'Invalid request path.');
    return;
  }
  console.log(`${request.method} ${pathname}`);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Only GET and HEAD are supported.', { Allow: 'GET, HEAD' });
    return;
  }
  // The whitelist is the filesystem boundary. Routes never become disk paths.
  const file = files.get(pathname) || (/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(pathname) ? files.get('/index.html') : undefined);
  if (!file) {
    send(response, 404, request.method === 'HEAD' ? undefined : 'Not found.');
    return;
  }
  try {
    const body = await readFile(file.url);
    response.writeHead(200, { ...securityHeaders, 'Content-Type': file.type, 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(`Unable to serve ${pathname}: ${error.code || 'unknown error'}`);
    send(response, 500, request.method === 'HEAD' ? undefined : 'Demo files are unavailable.');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the existing server before starting this demo.` : `Demo server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Harbor demo: http://${host}:${port}/overview`);
  console.log('Local simulated data only. Press Ctrl+C to stop.');
});
