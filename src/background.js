// Cache for Tailwind detection results (domain -> { hasTailwindCSS, tailwindVersion })
const domainCache = {};

// Helper functions
const getDomain = url => {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
};

const updateCacheAndBadge = (domain, tabId, hasTailwindCSS, tailwindVersion) => {
  domainCache[domain] = { hasTailwindCSS, tailwindVersion };
  console.log(`Updated cache for ${domain}: ${hasTailwindCSS}, version: ${tailwindVersion}`);
  updateBadge(tabId, hasTailwindCSS, tailwindVersion);
};

const updateBadge = (tabId, hasTailwindCSS, tailwindVersion = 'unknown') => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) {
      console.warn(`Cannot update badge: No tab with id ${tabId}`);
      return;
    }

    let badgeText = '';
    if (hasTailwindCSS) {
      if (tailwindVersion === 'unknown') {
        badgeText = 'UN';
      } else {
        badgeText = `${tailwindVersion}`;
      }
    }

    const badgeBackgroundColor = hasTailwindCSS ? '#0ea5e9' : '#888';
    const badgeTextColor = '#ffffff';

    chrome.action.setBadgeText({ tabId, text: badgeText });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badgeBackgroundColor });
    chrome.action.setTitle({
      tabId,
      title: hasTailwindCSS ? `Tailwind CSS v${tailwindVersion}` : 'This website is not using Tailwind CSS',
    });

    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ tabId, color: badgeTextColor });
    }
  });
};

const clearBadge = tabId => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) {
      console.warn(`Cannot clear badge: No tab with id ${tabId}`);
      return;
    }
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#888' });
    chrome.action.setTitle({ tabId, title: 'Built with Tailwind CSS' });
  });
};

const resetCache = () => {
  Object.keys(domainCache).forEach(domain => {
    delete domainCache[domain];
  });
  console.log('Cache reset successfully via scheduled alarm');
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

  // List of hostnames that are known to be invalid for scripting
  const invalidHostnames = ['chrome.google.com', 'chromewebstore.google.com'];

  // Check if the hostname is one of the known invalid ones
  const isInvalidHostname = invalidHostnames.some(invalidHostname => hostname.endsWith(invalidHostname));

  // List of protocols that are considered invalid for scripting
  const invalidProtocols = ['chrome:', 'about:', 'data:', 'file:', 'blob:', 'devtools:', 'view-source:', 'javascript:', 'chrome-extension:', 'chrome-devtools:'];

  // Check if the protocol is one of the known invalid ones
  const isInvalidProtocol = invalidProtocols.some(protocol => url.protocol.startsWith(protocol));

  return !isInvalidHostname && !isInvalidProtocol;
};

const evaluateTab = tabId => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) {
      console.warn(`Cannot evaluate tab: No tab with id ${tabId}`);
      return;
    }
    if (isValidUrl(tab)) {
      const domain = getDomain(tab.url);
      if (domain && domainCache[domain]) {
        console.log(`Cache hit: ${domain}`);
        updateBadge(tabId, domainCache[domain].hasTailwindCSS, domainCache[domain].tailwindVersion);
      } else {
        console.log(`Cache miss: ${domain}`);
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: ['content.js'],
          },
          () => {
            chrome.tabs.sendMessage(tabId, { action: 'checkForTailwindCSS' }, response => {
              if (chrome.runtime.lastError) {
                console.error('Error sending message to tab:', chrome.runtime.lastError.message);
                clearBadge(tabId);
              } else {
                console.log(`Response from content script for ${domain}:`, response);
                if (response && typeof response.hasTailwindCSS !== 'undefined') {
                  updateCacheAndBadge(domain, tabId, response.hasTailwindCSS, response.tailwindVersion);
                }
              }
            });
          }
        );
      }
    } else {
      clearBadge(tabId);
      console.log(`Skipping tab with URL: ${tab ? tab.url : 'unknown'}`);
    }
  });
};

// Event listeners
chrome.tabs.onActivated.addListener(({ tabId }) => evaluateTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    evaluateTab(tabId);
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  clearBadge(tabId);
  const domain = Object.keys(domainCache).find(domain => domainCache[domain].tabId === tabId);
  if (domain) {
    delete domainCache[domain];
  }
});

// Create an alarm to reset the cache every two weeks
chrome.alarms.create('resetCacheAlarm', { periodInMinutes: 20160 });

// Listen for the cache reset alarm
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'resetCacheAlarm') {
    resetCache();
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background script:', message);

  if (message.requestUpdate) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.tabs.get(tabId, tab => {
          if (tab?.url) {
            const domain = getDomain(tab.url);
            if (domain && domainCache[domain]) {
              console.log(`Popup Cache hit: ${domain}`);
              sendResponse(domainCache[domain]);
            } else {
              console.log(`Popup Cache miss: ${domain}`);
              evaluateTab(tabId);
              sendResponse({
                hasTailwindCSS: false,
                tailwindVersion: 'unknown',
              });
            }
          }
        });
      } else {
        console.log('No active tab available');
      }
    });
    return true; // To allow asynchronous `sendResponse`
  }

  if (typeof message.hasTailwindCSS !== 'undefined') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.tabs.get(tabId, tab => {
        if (tab.url) {
          const domain = getDomain(tab.url);
          if (domain) {
            updateCacheAndBadge(domain, tabId, message.hasTailwindCSS, message.tailwindVersion);
          }
        }
      });
    }
  } else {
    console.log('Invalid message received');
  }
  sendResponse({ status: 'done' });
  return true; // Ensure the sendResponse is maintained
});
