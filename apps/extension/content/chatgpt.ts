// Token Monitor — ChatGPT Content Script
// Intercepts fetch to capture conversation API responses and extract token usage estimates.

(function () {
  'use strict';

  console.log('[TokenMonitor] ChatGPT content script loaded');

  const PROVIDER_TYPE = 'chatgpt_consumer';

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

      // ChatGPT conversation endpoint
      if (url.includes('/backend-api/conversation')) {
        console.log('[TokenMonitor] Intercepted ChatGPT conversation request:', url);
        const clone = response.clone();
        processChatGPTResponse(clone, url).catch((err) => {
          console.error('[TokenMonitor] Error processing response:', err);
        });
      }
    } catch {
      // Never break the page
    }

    return response;
  };

  async function processChatGPTResponse(response: Response, url: string) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      await processSSEStream(response, url);
    }
  }

  async function processSSEStream(response: Response, url: string) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let fullResponse = '';
    let model = 'gpt-4o';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // Extract model
            if (parsed.message?.metadata?.model_slug) {
              model = parsed.message.metadata.model_slug;
            }

            // Accumulate response text
            if (parsed.message?.content?.parts) {
              for (const part of parsed.message.content.parts) {
                if (typeof part === 'string') {
                  fullResponse = part; // ChatGPT sends full text in each update
                }
              }
            }
          } catch {
            // ignore parse errors on individual lines
          }
        }
      }

      // Estimate tokens from response length
      if (fullResponse.length > 0) {
        const estimatedOutput = Math.ceil(fullResponse.length / 4);
        console.log(`[TokenMonitor] ChatGPT response captured: model=${model}, ~${estimatedOutput} tokens`);
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
    } catch {
      // Stream reading error
    }
  }
})();
