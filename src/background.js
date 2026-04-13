const DEBUG = false;
const log = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const warn = (...args) => {
  if (DEBUG) {
    console.warn(...args);
  }
};

const CACHE_STORAGE_KEY = 'domainCacheV1';

const cacheStorage = chrome.storage.session || chrome.storage.local;
const actionApi = chrome.action || chrome.browserAction;

const storageGet = keyOrKeys => {
  try {
    const maybePromise = cacheStorage.get(keyOrKeys);
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise;
    }
  } catch (_) {
    // Fall through to callback form.
  }
  return new Promise((resolve, reject) => {
    cacheStorage.get(keyOrKeys, result => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result || {});
    });
  });
};

const storageSet = items => {
  try {
    const maybePromise = cacheStorage.set(items);
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise;
    }
  } catch (_) {
    // Fall through to callback form.
  }
  return new Promise((resolve, reject) => {
    cacheStorage.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
};

const storageRemove = keyOrKeys => {
  try {
    const maybePromise = cacheStorage.remove(keyOrKeys);
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise;
    }
  } catch (_) {
    // Fall through to callback form.
  }
  return new Promise((resolve, reject) => {
    cacheStorage.remove(keyOrKeys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
};

const executeContentScript = (tabId, file, done) => {
  if (chrome.scripting?.executeScript) {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: [file],
      },
      done
    );
    return;
  }

  if (chrome.tabs.executeScript) {
    chrome.tabs.executeScript(tabId, { file }, () => done());
    return;
  }

  done();
};

let domainCache = {};
let hydratePromise = null;

const ensureHydrated = () => {
  if (!hydratePromise) {
    hydratePromise = storageGet(CACHE_STORAGE_KEY).then(result => {
      const raw = result[CACHE_STORAGE_KEY];
      if (raw && typeof raw === 'object') {
        domainCache = { ...raw };
      }
    });
  }
  return hydratePromise;
};

const persistDomainCache = () =>
  storageSet({ [CACHE_STORAGE_KEY]: domainCache }).catch(err => {
    console.error('Failed to persist domain cache:', err);
  });

const getDomain = url => {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
};

/** Chrome’s action badge only fits ~4 visible characters; shorten so digits aren’t clipped. */
const BADGE_TEXT_MAX = 4;

const formatBadgeVersion = tailwindVersion => {
  if (!tailwindVersion || tailwindVersion === 'unknown') {
    return 'UN';
  }
  const s = String(tailwindVersion).trim();
  const parts = s.split('.').filter(p => p.length > 0);
  if (parts.length >= 2) {
    const majorMinor = `${parts[0]}.${parts[1]}`;
    if (majorMinor.length <= BADGE_TEXT_MAX) {
      return majorMinor;
    }
    return majorMinor.slice(0, BADGE_TEXT_MAX);
  }
  if (s.length <= BADGE_TEXT_MAX) {
    return s;
  }
  return s.slice(0, BADGE_TEXT_MAX);
};

const updateCacheAndBadge = (domain, tabId, hasTailwindCSS, tailwindVersion) => {
  domainCache[domain] = { hasTailwindCSS, tailwindVersion };
  log(`Updated cache for ${domain}: ${hasTailwindCSS}, version: ${tailwindVersion}`);
  persistDomainCache();
  updateBadge(tabId, hasTailwindCSS, tailwindVersion);
};

const updateBadge = (tabId, hasTailwindCSS, tailwindVersion = 'unknown') => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) {
      warn(`Cannot update badge: No tab with id ${tabId}`);
      return;
    }

    let badgeText = '';
    if (hasTailwindCSS) {
      badgeText = formatBadgeVersion(tailwindVersion);
    }

    const badgeBackgroundColor = hasTailwindCSS ? '#0ea5e9' : '#888';
    const badgeTextColor = '#ffffff';

    actionApi.setBadgeText({ tabId, text: badgeText });
    actionApi.setBadgeBackgroundColor({ tabId, color: badgeBackgroundColor });
    actionApi.setTitle({
      tabId,
      title: hasTailwindCSS ? `Tailwind CSS v${tailwindVersion}` : 'This website is not using Tailwind CSS',
    });

    if (actionApi.setBadgeTextColor) {
      actionApi.setBadgeTextColor({ tabId, color: badgeTextColor });
    }
  });
};

const clearBadge = tabId => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) {
      warn(`Cannot clear badge: No tab with id ${tabId}`);
      return;
    }
    actionApi.setBadgeText({ tabId, text: '' });
    actionApi.setBadgeBackgroundColor({ tabId, color: '#888' });
    actionApi.setTitle({ tabId, title: 'Built with Tailwind CSS' });
  });
};

const resetCache = () => {
  domainCache = {};
  hydratePromise = null;
  storageRemove(CACHE_STORAGE_KEY).catch(() => {});
  log('Cache reset successfully via scheduled alarm');
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => clearBadge(tab.id));
  });
};

const isValidUrl = tab => {
  if (!tab?.url) {
    return false;
  }

  const url = new URL(tab.url);
  const hostname = url.hostname;

  const invalidHostnames = ['chrome.google.com', 'chromewebstore.google.com'];
  const isInvalidHostname = invalidHostnames.some(invalidHostname => hostname.endsWith(invalidHostname));

  const invalidProtocols = [
    'chrome:',
    'about:',
    'data:',
    'file:',
    'blob:',
    'devtools:',
    'view-source:',
    'javascript:',
    'chrome-extension:',
    'chrome-devtools:',
  ];
  const isInvalidProtocol = invalidProtocols.some(protocol => url.protocol.startsWith(protocol));

  return !isInvalidHostname && !isInvalidProtocol;
};

const injectAndDetect = (tabId, domain, onResult) => {
  executeContentScript(tabId, 'content.js', () => {
    if (chrome.runtime.lastError) {
      log('Error injecting content script:', chrome.runtime.lastError.message);
      onResult(null);
      return;
    }
    chrome.tabs.sendMessage(tabId, { action: 'checkForTailwindCSS' }, response => {
      if (chrome.runtime.lastError) {
        log('Error sending message to tab:', chrome.runtime.lastError.message);
        onResult(null);
        return;
      }
      if (response && typeof response.hasTailwindCSS !== 'undefined') {
        updateCacheAndBadge(
          domain,
          tabId,
          response.hasTailwindCSS,
          response.tailwindVersion ?? 'unknown'
        );
        onResult(response);
      } else {
        onResult(null);
      }
    });
  });
};

const evaluateTab = tabId => {
  ensureHydrated().then(() => {
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError || !tab) {
        warn(`Cannot evaluate tab: No tab with id ${tabId}`);
        return;
      }
      if (isValidUrl(tab)) {
        const domain = getDomain(tab.url);
        if (domain && domainCache[domain]) {
          log(`Cache hit: ${domain}`);
          updateBadge(tabId, domainCache[domain].hasTailwindCSS, domainCache[domain].tailwindVersion);
        } else if (domain) {
          log(`Cache miss: ${domain}`);
          injectAndDetect(tabId, domain, result => {
            if (!result) {
              clearBadge(tabId);
            }
          });
        }
      } else {
        clearBadge(tabId);
        log(`Skipping tab with URL: ${tab ? tab.url : 'unknown'}`);
      }
    });
  });
};

chrome.tabs.onActivated.addListener(({ tabId }) => evaluateTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    evaluateTab(tabId);
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  clearBadge(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  hydratePromise = null;
  ensureHydrated();
});
chrome.runtime.onStartup.addListener(() => {
  hydratePromise = null;
  ensureHydrated();
});

chrome.alarms.create('resetCacheAlarm', { periodInMinutes: 20160 });

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'resetCacheAlarm') {
    resetCache();
  }
});

ensureHydrated();

const sendPopupPayload = (sendResponse, tab, result) => {
  const hostname = tab?.url ? getDomain(tab.url) || '' : '';
  if (result && typeof result.hasTailwindCSS !== 'undefined') {
    sendResponse({
      hasTailwindCSS: result.hasTailwindCSS,
      tailwindVersion: result.tailwindVersion ?? 'unknown',
      hostname,
    });
  } else {
    sendResponse({
      hasTailwindCSS: false,
      tailwindVersion: 'unknown',
      hostname,
    });
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Message received in background script:', message);

  if (message.requestUpdate) {
    ensureHydrated().then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) {
          log('No active tab available');
          sendResponse({ hasTailwindCSS: false, tailwindVersion: 'unknown', hostname: '' });
          return;
        }
        const tabId = tabs[0].id;
        chrome.tabs.get(tabId, tab => {
          if (!tab?.url) {
            sendResponse({ hasTailwindCSS: false, tailwindVersion: 'unknown', hostname: '' });
            return;
          }
          const domain = getDomain(tab.url);
          const hostname = domain || '';
          const bypass = Boolean(message.bypassCache);

          if (!bypass && domain && domainCache[domain]) {
            log(`Popup Cache hit: ${domain}`);
            sendResponse({
              ...domainCache[domain],
              hostname,
            });
            return;
          }

          log(`Popup Cache miss or refresh: ${domain}`);
          if (!isValidUrl(tab)) {
            sendPopupPayload(sendResponse, tab, null);
            return;
          }
          if (!domain) {
            sendPopupPayload(sendResponse, tab, null);
            return;
          }

          injectAndDetect(tabId, domain, result => {
            sendPopupPayload(sendResponse, tab, result);
          });
        });
      });
    });
    return true;
  }

  sendResponse({ status: 'ignored' });
  return false;
});
