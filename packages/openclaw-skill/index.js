// Token Monitor — OpenClaw Skill
// Fires after each AI response, POSTing usage data to the Token Monitor desktop app.

const http = require('http');

const DEFAULT_PORT = 7878;

/**
 * OpenClaw skill handler — called after each AI response.
 * @param {object} context - The OpenClaw skill context
 * @param {object} context.request - The original request
 * @param {object} context.response - The AI response
 * @param {object} context.usage - Token usage data
 * @param {object} context.config - Skill configuration
 */
module.exports = async function tokenMonitorSkill(context) {
  const { request, response, usage, config } = context;
  const port = config?.desktop_port || DEFAULT_PORT;

  const payload = {
    provider: 'openclaw',
    model: request?.model || response?.model || 'unknown',
    inputTokens: usage?.input_tokens || usage?.prompt_tokens || 0,
    outputTokens: usage?.output_tokens || usage?.completion_tokens || 0,
    cacheReadTokens: usage?.cache_read_tokens || 0,
    cacheWriteTokens: usage?.cache_write_tokens || 0,
    costUSD: usage?.cost || undefined,
    timestamp: Date.now(),
    metadata: {
      skillId: request?.skill_id,
      conversationId: request?.conversation_id,
    },
  };

  return new Promise((resolve) => {
    const data = JSON.stringify(payload);

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/usage',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 2000,
      },
      (res) => {
        res.resume(); // drain
        resolve();
      }
    );

    req.on('error', () => {
      // Desktop app not running — silently ignore
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve();
    });

    req.write(data);
    req.end();
  });
};
