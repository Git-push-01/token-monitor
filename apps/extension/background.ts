// Token Monitor — Background Service Worker (MV3)
// Maintains WebSocket connection to the desktop app and relays usage events from content scripts.

const WS_PORT = 7879;
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;
const RECONNECT_DELAY_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;

let ws: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pairingToken: string | null = null;
let connected = false;

// ─── WebSocket Connection ─────────────────────────────────

async function loadPairingToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('pairingToken');
  return result.pairingToken || null;
}

async function savePairingToken(token: string): Promise<void> {
  await chrome.storage.local.set({ pairingToken: token });
  pairingToken = token;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL, pairingToken ? `token-monitor-${pairingToken}` : undefined);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    connected = true;
    updateBadge('ON', '#22c55e');

    // Send handshake if we have a token but didn't use subprotocol
    if (pairingToken) {
      ws?.send(JSON.stringify({
        type: 'handshake',
        pairingToken,
        clientType: 'extension',
        version: '0.1.0',
      }));
    }

    startHeartbeat();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'heartbeat') {
        ws?.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    connected = false;
    stopHeartbeat();
    updateBadge('OFF', '#ef4444');
    scheduleReconnect();
  };

  ws.onerror = () => {
    connected = false;
    ws?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── Badge ────────────────────────────────────────────────

function updateBadge(text: string, color: string) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ─── Message Handling ─────────────────────────────────────

// Content scripts send usage data here; we relay to desktop app via WebSocket
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'usage_event') {
    relayToDesktop(message.payload);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'set_pairing_token') {
    savePairingToken(message.token).then(() => {
      // Reconnect with new token
      ws?.close();
      connect();
      sendResponse({ ok: true });
    });
    return true; // async response
  }

  if (message.type === 'get_status') {
    sendResponse({ connected, pairingToken: !!pairingToken });
    return;
  }
});

function relayToDesktop(payload: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Queue for later or just drop — desktop app not connected
    return;
  }

  ws.send(JSON.stringify({
    type: 'usage',
    payload,
  }));
}

// ─── Token Estimator ──────────────────────────────────────
// Very rough client-side estimation (chars / 4)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Make it available to content scripts via message passing
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'estimate_tokens') {
    sendResponse({ tokens: estimateTokens(message.text) });
    return;
  }
});

// ─── Init ─────────────────────────────────────────────────

loadPairingToken().then((token) => {
  pairingToken = token;
  connect();
});
