// Token Monitor — Popup Script

const statusDot = document.getElementById('statusDot')!;
const statusText = document.getElementById('statusText')!;
const tokenInput = document.getElementById('tokenInput') as HTMLInputElement;
const pairBtn = document.getElementById('pairBtn')!;
const pairingSection = document.getElementById('pairingSection')!;
const statsSection = document.getElementById('statsSection')!;
const eventCount = document.getElementById('eventCount')!;
const connectionStatus = document.getElementById('connectionStatus')!;

// Check connection status
chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
  if (response?.connected) {
    statusDot.className = 'dot connected';
    statusText.textContent = 'Connected';
    connectionStatus.textContent = 'Connected';
    statsSection.style.display = 'block';
  } else {
    statusDot.className = 'dot disconnected';
    statusText.textContent = 'Disconnected';
    connectionStatus.textContent = 'Disconnected';
  }

  if (response?.pairingToken) {
    tokenInput.placeholder = '••••••••  (paired)';
  }
});

// Load saved event count
chrome.storage.local.get('eventCount', (result) => {
  eventCount.textContent = String(result.eventCount || 0);
});

// Pair button
pairBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) return;

  pairBtn.textContent = 'Pairing…';
  (pairBtn as HTMLButtonElement).disabled = true;

  chrome.runtime.sendMessage({ type: 'set_pairing_token', token }, (response) => {
    if (response?.ok) {
      pairBtn.textContent = '✓ Paired';
      tokenInput.value = '';
      tokenInput.placeholder = '••••••••  (paired)';

      // Recheck status after a moment
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'get_status' }, (r) => {
          if (r?.connected) {
            statusDot.className = 'dot connected';
            statusText.textContent = 'Connected';
            statsSection.style.display = 'block';
          }
        });
      }, 2000);
    } else {
      pairBtn.textContent = 'Pair';
      (pairBtn as HTMLButtonElement).disabled = false;
    }
  });
});
