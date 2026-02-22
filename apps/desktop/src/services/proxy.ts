import http from 'http';
import https from 'https';
import { URL } from 'url';
import { PROXY_PORT } from '@token-monitor/shared';

/**
 * Local proxy server on port 7878
 * Forwards API calls to the real provider and captures usage data from responses
 *
 * Usage: User sets their API base URL to http://localhost:7878
 * The proxy reads the target from the X-Target-Provider header or path prefix:
 *   /anthropic/... → api.anthropic.com
 *   /openai/...    → api.openai.com
 *   /gemini/...    → generativelanguage.googleapis.com
 *   /openrouter/...→ openrouter.ai
 */

type ResponseHandler = (provider: string, body: any, headers: Record<string, string>, model: string) => void;
let onResponseCapture: ResponseHandler | null = null;

export function setResponseHandler(handler: ResponseHandler) {
  onResponseCapture = handler;
}

const PROVIDER_HOSTS: Record<string, string> = {
  anthropic: 'api.anthropic.com',
  openai: 'api.openai.com',
  gemini: 'generativelanguage.googleapis.com',
  openrouter: 'openrouter.ai',
};

export function startProxyServer(): http.Server {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('Missing URL');
      return;
    }

    // Parse provider from path: /anthropic/v1/messages → anthropic
    const pathParts = req.url.split('/').filter(Boolean);
    const providerKey = pathParts[0];
    const targetHost = PROVIDER_HOSTS[providerKey];

    if (!targetHost) {
      // Handle API endpoint for OpenClaw skill
      if (req.url === '/api/usage' && req.method === 'POST') {
        handleOpenClawUsage(req, res);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unknown provider',
        message: `Use path prefix: /anthropic, /openai, /gemini, or /openrouter`,
        available: Object.keys(PROVIDER_HOSTS),
      }));
      return;
    }

    // Strip provider prefix from path
    const targetPath = '/' + pathParts.slice(1).join('/');

    // Forward headers (except host)
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host' || key.toLowerCase() === 'x-target-provider') continue;
      if (typeof value === 'string') forwardHeaders[key] = value;
    }

    const options = {
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: req.method,
      headers: {
        ...forwardHeaders,
        host: targetHost,
      },
    };

    // Extract model from request body for cost calculation
    let requestBody = '';
    req.on('data', (chunk) => { requestBody += chunk; });
    req.on('end', () => {
      let model = 'unknown';
      try {
        const parsed = JSON.parse(requestBody);
        model = parsed.model || 'unknown';
      } catch { /* not JSON or no model field */ }

      const proxyReq = https.request(options, (proxyRes) => {
        // Forward status and headers
        const responseHeaders = { ...proxyRes.headers } as Record<string, string>;
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

        // Collect response body for usage capture
        let responseBody = '';
        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
          res.write(chunk); // Stream to client
        });

        proxyRes.on('end', () => {
          res.end();

          // Parse and capture usage data
          try {
            const parsed = JSON.parse(responseBody);
            if (onResponseCapture) {
              onResponseCapture(providerKey, parsed, responseHeaders, model);
            }
          } catch {
            // Not JSON or streaming response — skip capture
          }
        });
      });

      proxyReq.on('error', (err) => {
        console.error(`[Proxy] Error forwarding to ${targetHost}:`, err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
      });

      if (requestBody) {
        proxyReq.write(requestBody);
      }
      proxyReq.end();
    });
  });

  server.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(`[Proxy] Listening on 127.0.0.1:${PROXY_PORT}`);
  });

  return server;
}

/**
 * Handle direct usage POSTs from OpenClaw skill
 * POST /api/usage
 */
function handleOpenClawUsage(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (onResponseCapture) {
        onResponseCapture('openclaw', data, {}, data.model || 'unknown');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}
