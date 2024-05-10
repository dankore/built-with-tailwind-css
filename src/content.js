// Content script wrapped in an IIFE
(function () {
  // Helper functions
  const isTailwindClass = (text) => {
    const hasTailwindReference = text.includes("tailwindcss") || text.includes("https://tailwindcss.com");
    const hasUniqueTailwindFeatures = text.includes("tw-") || text.includes("--tw-"); // Tailwind prefix and custom properties
    return hasTailwindReference || hasUniqueTailwindFeatures;
  };

  const extractTailwindVersion = async (text) => {
    const regexHasVersion = /(?:^|\s)tailwindcss\s+v?([^\s]+)/gi;
    const versions = [];
    let match;

    while ((match = regexHasVersion.exec(text))) {
      versions.push(match[1]);
    }

    return versions.length > 0 ? versions[0] : null;
  };

  const isTailwindStylesheet = async (sheet) => {
    try {
      const response = await fetch(sheet.href);
      const text = await response.text();
      const containsTailwindClass = isTailwindClass(text);
      const version = await extractTailwindVersion(text);
      return { containsTailwindClass, version };
    } catch (e) {
      console.warn(`Could not access stylesheet: ${sheet.href}`, e);
      return { containsTailwindClass: false, version: null };
    }
  };

  const checkForTailwindCSS = async () => {
    // Check all stylesheets
    const stylesheets = Array.from(document.styleSheets).filter((sheet) => sheet.href && sheet.href.includes(".css"));
    const tailwindResults = await Promise.all(stylesheets.map(isTailwindStylesheet));
    const hasTailwindCSSInStylesheets = tailwindResults.some((result) => result.containsTailwindClass);
    const tailwindVersion = tailwindResults.find((result) => result.version)?.version;

    // Check inline styles in <style> tags
    const styleTags = Array.from(document.querySelectorAll("style"));
    const hasTailwindCSSInInlineStyles = styleTags.some((tag) => isTailwindClass(tag.innerHTML));

    // Check inline styles in HTML attributes
    const allElements = Array.from(document.querySelectorAll("*"));
    const hasTailwindCSSInAttributes = allElements.some((el) => {
      const classList = Array.from(el.classList);
      return classList.some((cls) => isTailwindClass(cls));
    });

    // Final determination of whether Tailwind CSS is present
    const hasTailwindCSS = hasTailwindCSSInStylesheets || hasTailwindCSSInInlineStyles || hasTailwindCSSInAttributes;

    chrome.runtime.sendMessage(
      { status: "CSS Check Done", hasTailwindCSS, tailwindVersion: tailwindVersion || "unknown" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError.message);
        } else {
          console.log("Final detection result sent, response:", response);
        }
      }
    );
  };

  // Listen for explicit requests to check Tailwind CSS
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkForTailwindCSS") {
      checkForTailwindCSS(); // Start detection
      sendResponse({ status: "CSS Check Initiated" });
    }
    return true;
  });
})();