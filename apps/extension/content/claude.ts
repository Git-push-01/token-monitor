// Token Monitor — Claude.ai Content Script
// Intercepts fetch to capture conversation API responses and extract token usage estimates.

(function () {
  'use strict';

  const PROVIDER_TYPE = 'claude_consumer';

  // Intercept fetch to capture API responses
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

      // Claude.ai conversation API endpoints
      if (url.includes('/api/organizations/') && url.includes('/chat_conversations/')) {
        // Clone response so we can read it without consuming
        const clone = response.clone();
        processClaudeResponse(clone, url).catch(() => {});
      }
    } catch {
      // Never break the page
    }

    return response;
  };

  async function processClaudeResponse(response: Response, url: string) {
    // Claude.ai uses SSE streaming
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      await processSSEStream(response, url);
    } else if (contentType.includes('application/json')) {
      const body = await response.json();
      if (body.completion || body.content) {
        emitUsageEvent(body, url);
      }
    }
  }

  async function processSSEStream(response: Response, url: string) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let fullResponse = '';
    let model = 'claude-unknown';
    let inputText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // Extract model from message_start
            if (parsed.type === 'message_start' && parsed.message?.model) {
              model = parsed.message.model;
            }

            // Extract usage from message_delta (final event)
            if (parsed.type === 'message_delta' && parsed.usage) {
              const usage = parsed.usage;
              chrome.runtime.sendMessage({
                type: 'usage_event',
                payload: {
                  provider: PROVIDER_TYPE,
                  model,
                  inputTokens: usage.input_tokens || 0,
                  outputTokens: usage.output_tokens || 0,
                  timestamp: Date.now(),
                  url,
                  dataQuality: 'estimated',
                },
              });
              return;
            }

            // Accumulate content for estimation
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullResponse += parsed.delta.text;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // If we never got explicit usage data, estimate from accumulated text
      if (fullResponse.length > 0) {
        const estimatedOutput = Math.ceil(fullResponse.length / 4);
        chrome.runtime.sendMessage({
          type: 'usage_event',
          payload: {
            provider: PROVIDER_TYPE,
            model,
            inputTokens: 0, // Can't estimate input from client side
            outputTokens: estimatedOutput,
            timestamp: Date.now(),
            url,
            dataQuality: 'estimated',
          },
        });
      }
    } catch {
      // Stream error — ignore
    }
  }

  function emitUsageEvent(body: any, url: string) {
    const model = body.model || 'claude-unknown';
    const outputText = body.completion || body.content?.[0]?.text || '';
    const estimatedOutput = Math.ceil(outputText.length / 4);

    chrome.runtime.sendMessage({
      type: 'usage_event',
      payload: {
        provider: PROVIDER_TYPE,
        model,
        inputTokens: 0,
        outputTokens: estimatedOutput,
        timestamp: Date.now(),
        url,
        dataQuality: 'estimated',
      },
    });
  }
})();
