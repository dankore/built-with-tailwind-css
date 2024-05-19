// Content script wrapped in an IIFE
(function () {
  // Helper functions
  const isTailwindClass = (text) => text.includes("tailwindcss") || text.includes("https://tailwindcss.com") || text.includes("--tw-");

  const extractTailwindVersion = (text) => {
    const regex = /(?:^|\s)tailwindcss\s+v?([^\s]+)/gi;
    const versions = [];
    let match;
    while ((match = regex.exec(text))) {
      versions.push(match[1]);
    }
    return versions.length > 0 ? versions[0] : null;
  };

  const isTailwindStylesheet = async (sheet) => {
    try {
      const response = await fetch(sheet.href);
      const text = await response.text();
      return { containsTailwindClass: isTailwindClass(text), version: extractTailwindVersion(text) };
    } catch {
      return { containsTailwindClass: false, version: null };
    }
  };

  const checkStylesheetsForTailwind = async () => {
    const stylesheets = Array.from(document.styleSheets).filter(sheet => sheet.href && sheet.href.includes(".css"));
    for (const sheet of stylesheets) {
      const result = await isTailwindStylesheet(sheet);
      if (result.containsTailwindClass) {
        return { hasTailwindCSSInStylesheets: true, tailwindVersion: result.version || "unknown" };
      }
    }
    return { hasTailwindCSSInStylesheets: false, tailwindVersion: "unknown" };
  };

  const checkStyleTagsForTailwind = () => {
    const styleTags = Array.from(document.querySelectorAll("style"));
    return styleTags.some(tag => isTailwindClass(tag.innerHTML));
  };

  const checkElementsForTailwind = () => {
    const allElements = Array.from(document.querySelectorAll("*"));
    return allElements.some(el => Array.from(el.classList).some(cls => isTailwindClass(cls)));
  };

  const checkForTailwindCSS = async () => {
    const { hasTailwindCSSInStylesheets, tailwindVersion } = await checkStylesheetsForTailwind();
    if (hasTailwindCSSInStylesheets) {
      sendTailwindStatus(true, tailwindVersion);
      return;
    }
    if (checkStyleTagsForTailwind() || checkElementsForTailwind()) {
      sendTailwindStatus(true, "unknown");
      return;
    }
    sendTailwindStatus(false, "unknown");
  };

  const sendTailwindStatus = (hasTailwindCSS, tailwindVersion) => {
    chrome.runtime.sendMessage({ status: "CSS Check Done", hasTailwindCSS, tailwindVersion });
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkForTailwindCSS") {
      checkForTailwindCSS().then(() => sendResponse({ status: "CSS Check Initiated" }));
    }
    return true;
  });
})();
