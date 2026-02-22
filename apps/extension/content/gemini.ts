// Token Monitor — Gemini Content Script
// Intercepts fetch to capture Gemini API responses and extract token usage estimates.

(function () {
  'use strict';

  const PROVIDER_TYPE = 'gemini_consumer';

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

      // Gemini uses batchexecute or streamgenerate endpoints
      if (
        url.includes('generativelanguage') ||
        url.includes('/_/BardChatUi/') ||
        url.includes('/batchexecute')
      ) {
        const clone = response.clone();
        processGeminiResponse(clone, url).catch(() => {});
      }
    } catch {
      // Never break the page
    }

    return response;
  };

  async function processGeminiResponse(response: Response, url: string) {
    try {
      const text = await response.text();

      if (!text || text.length < 10) return;

      // Gemini web uses a proprietary format — extract text content heuristically
      // The response is wrapped in )]}' prefix and contains nested arrays
      let cleanText = text;
      if (cleanText.startsWith(")]}'")) {
        cleanText = cleanText.slice(4);
      }

      // Try JSON parse
      try {
        const parsed = JSON.parse(cleanText);
        extractFromGeminiJSON(parsed, url);
        return;
      } catch {
        // Not JSON — try to extract text length from raw response
      }

      // Fallback: estimate from raw response size (very rough)
      if (text.length > 100) {
        // Gemini web responses contain lots of metadata, so estimate ~20% is actual content
        const contentEstimate = Math.floor(text.length * 0.2);
        const estimatedOutput = Math.ceil(contentEstimate / 4);

        if (estimatedOutput > 5) {
          chrome.runtime.sendMessage({
            type: 'usage_event',
            payload: {
              provider: PROVIDER_TYPE,
              model: 'gemini-2.0-flash',
              inputTokens: 0,
              outputTokens: estimatedOutput,
              timestamp: Date.now(),
              url,
              dataQuality: 'estimated',
            },
          });
        }
      }
    } catch {
      // ignore
    }
  }

  function extractFromGeminiJSON(data: any, url: string) {
    // Walk the nested structure looking for text content
    let responseText = '';
    let model = 'gemini-2.0-flash';

    function walk(node: any) {
      if (typeof node === 'string' && node.length > 20) {
        if (node.length > responseText.length) {
          responseText = node;
        }
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
      }
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        // Check for model info
        if (node.model) model = node.model;
        if (node.modelVersion) model = node.modelVersion;
        for (const val of Object.values(node)) walk(val);
      }
    }

    walk(data);

    if (responseText.length > 10) {
      const estimatedOutput = Math.ceil(responseText.length / 4);
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
  }
})();
