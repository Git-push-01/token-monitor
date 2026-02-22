import { WebSocketServer, WebSocket } from 'ws';
import { WS_PORT } from '@token-monitor/shared';
import type { WSHandshake, ExtensionMessage } from '@token-monitor/shared';

interface PairedClient {
  ws: WebSocket;
  clientId: string;
  pairedAt: number;
  lastHeartbeat: number;
}

let wsServer: WebSocketServer | null = null;
let pairingToken: string | null = null;
const pairedClients = new Map<string, PairedClient>();

// Rate limiting: max 50 messages per second per client
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_MESSAGES_PER_SEC = 50;

export function setPairingToken(token: string) {
  pairingToken = token;
}

export function startWebSocketServer(): WebSocketServer {
  wsServer = new WebSocketServer({
    host: '127.0.0.1', // Bind to loopback only — security hardening
    port: WS_PORT,
  });

  console.log(`[WS] Server listening on 127.0.0.1:${WS_PORT}`);

  wsServer.on('connection', (ws, req) => {
    let clientId: string | null = null;
    let authenticated = false;

    // Check for pairing token in subprotocol header
    const protocol = req.headers['sec-websocket-protocol'];
    if (protocol) {
      const parts = protocol.split(',').map(s => s.trim());
      const tokenPart = parts.find(p => p !== 'tokenmonitor.v1');
      if (tokenPart && pairingToken && tokenPart === pairingToken) {
        authenticated = true;
        clientId = `ext-${Date.now()}`;
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Handle handshake first
        if (msg.type === 'handshake') {
          const handshake = msg as WSHandshake;

          if (!pairingToken || handshake.token !== pairingToken) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid pairing token' }));
            ws.close(4001, 'Invalid pairing token');
            return;
          }

          clientId = handshake.clientId;
          authenticated = true;

          pairedClients.set(clientId, {
            ws,
            clientId,
            pairedAt: Date.now(),
            lastHeartbeat: Date.now(),
          });

          ws.send(JSON.stringify({ type: 'handshake_ack', status: 'paired' }));
          console.log(`[WS] Client paired: ${clientId}`);
          return;
        }

        // Reject unauthenticated messages
        if (!authenticated || !clientId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // Rate limiting
        if (!checkRateLimit(clientId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
          return;
        }

        // Handle heartbeat
        if (msg.type === 'heartbeat') {
          const client = pairedClients.get(clientId);
          if (client) client.lastHeartbeat = Date.now();
          ws.send(JSON.stringify({ type: 'heartbeat_ack', ts: Date.now() }));
          return;
        }

        // Handle usage updates from browser extension
        if (msg.type === 'usage_update') {
          handleUsageUpdate(msg as ExtensionMessage);
          return;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      if (clientId) {
        pairedClients.delete(clientId);
        rateLimitMap.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Connection error:', err.message);
    });
  });

  // Stale connection cleanup — remove clients with no heartbeat for 60s
  setInterval(() => {
    const now = Date.now();
    for (const [id, client] of pairedClients) {
      if (now - client.lastHeartbeat > 60_000) {
        console.log(`[WS] Cleaning up stale client: ${id}`);
        client.ws.close(4002, 'Heartbeat timeout');
        pairedClients.delete(id);
      }
    }
  }, 30_000);

  return wsServer;
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(clientId);

  if (!entry || now - entry.windowStart > 1000) {
    entry = { count: 1, windowStart: now };
    rateLimitMap.set(clientId, entry);
    return true;
  }

  entry.count++;
  return entry.count <= MAX_MESSAGES_PER_SEC;
}

// Usage update handler — will be set by the engine
let onUsageUpdate: ((msg: ExtensionMessage) => void) | null = null;

export function setUsageUpdateHandler(handler: (msg: ExtensionMessage) => void) {
  onUsageUpdate = handler;
}

function handleUsageUpdate(msg: ExtensionMessage) {
  if (onUsageUpdate) {
    onUsageUpdate(msg);
  }
}

/**
 * Broadcast a message to all paired clients
 */
export function broadcastToExtensions(message: any) {
  const data = JSON.stringify(message);
  for (const client of pairedClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

export function getConnectedClients(): number {
  return pairedClients.size;
}
