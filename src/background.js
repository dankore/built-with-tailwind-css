// Cache for Tailwind detection results (domain -> { hasTailwindCSS, tailwindVersion })
const domainCache = {};

// Helper functions
const getDomain = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch (error) {
    console.error("Error parsing URL:", error);
    return null;
  }
};

const updateCacheAndBadge = (domain, hasTailwindCSS, tailwindVersion) => {
  domainCache[domain] = { hasTailwindCSS, tailwindVersion };
  console.log(
    `Updated cache for ${domain}: ${hasTailwindCSS}, version: ${tailwindVersion}`
  );
  updateBadge(hasTailwindCSS, tailwindVersion);
};

const updateBadge = (hasTailwindCSS, tailwindVersion = "unknown") => {
  const badgeText = hasTailwindCSS
    ? tailwindVersion === "unknown"
      ? "UN"
      : `${tailwindVersion}`
    : "";

  const badgeBackgroundColor = hasTailwindCSS ? "#0ea5e9" : "#888";
  const badgeTextColor = "#ffffff";

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeBackgroundColor });
  chrome.action.setTitle({
    title: hasTailwindCSS
      ? `Tailwind CSS v${tailwindVersion}`
      : "This website is not using Tailwind CSS",
  });

  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: badgeTextColor });
  }
};

const clearBadge = () => {
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: "#888" });
  chrome.action.setTitle({ title: "Built with Tailwind CSS" });
};

const resetCache = () => {
  Object.keys(domainCache).forEach((domain) => {
    delete domainCache[domain];
  });
  console.log("Cache reset successfully via scheduled alarm");
  clearBadge();
};

const isValidUrl = (tab) => {
  if (!tab || !tab.url) {
    return false;
  }

  const invalidPrefixes = [
    "chrome://",
    "chrome-extension://",
    "about:",
    "data:",
    "file://",
    "blob:",
    "devtools://",
    "view-source:",
    "chrome-devtools://",
    "javascript:",
    "about:blank",
    "chrome.google.com",
    "chromewebstore.google.com"
  ];

  return !invalidPrefixes.some(prefix => tab.url.startsWith(prefix));
};

const evaluateTab = (tabId) => {
  chrome.tabs.get(tabId, (tab) => {
    if (isValidUrl(tab)) {
      const domain = getDomain(tab.url);
      if (domain && domainCache[domain]) {
        console.log(`Cache hit: ${domain}`);
        updateBadge(
          domainCache[domain].hasTailwindCSS,
          domainCache[domain].tailwindVersion
        );
      } else {
        console.log(`Cache miss: ${domain}`);
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: ["content.js"],
          },
          () => {
            chrome.tabs.sendMessage(
              tabId,
              { action: "checkForTailwindCSS" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending message to tab:",
                    chrome.runtime.lastError.message
                  );
                  clearBadge();
                } else {
                  console.log(
                    `Response from content script for ${domain}:`,
                    response
                  );
                  if (
                    response &&
                    typeof response.hasTailwindCSS !== "undefined"
                  ) {
                    updateCacheAndBadge(
                      domain,
                      response.hasTailwindCSS,
                      response.tailwindVersion
                    );
                  }
                }
              }
            );
          }
        );
      }
    } else {
      clearBadge();
      console.log(`Skipping tab with URL: ${tab ? tab.url : "unknown"}`);
    }
  });
};

// Event listeners
chrome.tabs.onActivated.addListener(({ tabId }) => evaluateTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    evaluateTab(tabId);
  }
});
chrome.tabs.onRemoved.addListener(clearBadge);

// Create an alarm to reset the cache every two weeks
chrome.alarms.create("resetCacheAlarm", { periodInMinutes: 20160 });

// Listen for the cache reset alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetCacheAlarm") {
    resetCache();
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script:", message);

  if (message.requestUpdate) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.tabs.get(tabId, (tab) => {
          if (tab && tab.url) {
            const domain = getDomain(tab.url);
            if (domain && domainCache[domain]) {
              console.log(`Popup Cache hit: ${domain}`);
              sendResponse(domainCache[domain]);
            } else {
              console.log(`Popup Cache miss: ${domain}`);
              evaluateTab(tabId);
              sendResponse({
                hasTailwindCSS: false,
                tailwindVersion: "unknown",
              });
            }
          }
        });
      } else {
        console.log("No active tab available");
      }
    });
    return true; // To allow asynchronous `sendResponse`
  }

  if (typeof message.hasTailwindCSS !== "undefined") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.url) {
          const domain = getDomain(tab.url);
          if (domain) {
            updateCacheAndBadge(
              domain,
              message.hasTailwindCSS,
              message.tailwindVersion
            );
          }
        }
      });
    }
  } else {
    console.log("Invalid message received");
  }
  sendResponse({ status: "done" });
  return true; // Ensure the sendResponse is maintained
});
