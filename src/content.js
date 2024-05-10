
// Content script wrapped in an IIFE
(function () {
  // Helper functions
  const isTailwindClass = (text) => {
    console.log("Checking for Tailwind class in text:", text);
    const hasTailwindReference = text.includes("tailwindcss") || text.includes("https://tailwindcss.com");
    const hasUniqueTailwindFeatures = text.includes("tw-") || text.includes("--tw-"); // Tailwind prefix and custom properties
    return hasTailwindReference || hasUniqueTailwindFeatures;
  };

  const extractTailwindVersion = (text) => {
    console.log("Extracting Tailwind version from text:", text);
    const regexHasVersion = /(?:^|\s)tailwindcss\s+v?([^\s]+)/gi;
    const versions = [];
    let match;

    while ((match = regexHasVersion.exec(text))) {
      versions.push(match[1]);
    }

    console.log("Extracted versions:", versions);
    return versions.length > 0 ? versions[0] : null;
  };

  const isTailwindStylesheet = async (sheet) => {
    try {
      console.log("Checking stylesheet:", sheet.href);
      const response = await fetch(sheet.href);
      const text = await response.text();
      const containsTailwindClass = isTailwindClass(text);
      const version = extractTailwindVersion(text);
      return { containsTailwindClass, version };
    } catch (e) {
      console.warn(`Could not access stylesheet: ${sheet.href}`, e);
      return { containsTailwindClass: false, version: null };
    }
  };

  const checkStylesheetsForTailwind = async () => {
    console.log("Checking stylesheets for Tailwind CSS...");
    const stylesheets = Array.from(document.styleSheets).filter((sheet) => sheet.href && sheet.href.includes(".css"));
    const tailwindResults = await Promise.all(stylesheets.map(isTailwindStylesheet));
    const hasTailwindCSSInStylesheets = tailwindResults.some((result) => result.containsTailwindClass);
    const tailwindVersion = tailwindResults.find((result) => result.version)?.version;

    return { hasTailwindCSSInStylesheets, tailwindVersion: tailwindVersion || "unknown" };
  };

  const checkStyleTagsForTailwind = () => {
    console.log("Checking style tags for Tailwind CSS...");
    const styleTags = Array.from(document.querySelectorAll("style"));
    const hasTailwindCSSInStyleTags = styleTags.some((tag) => isTailwindClass(tag.innerHTML));
    return hasTailwindCSSInStyleTags;
  };

  const checkElementsForTailwind = () => {
    console.log("Checking HTML elements for Tailwind CSS...");
    const allElements = Array.from(document.querySelectorAll("*"));
    const hasTailwindCSSInAttributes = allElements.some((el) => {
      const classList = Array.from(el.classList);
      return classList.some((cls) => isTailwindClass(cls));
    });
    return hasTailwindCSSInAttributes;
  };

  const checkForTailwindCSS = async () => {
    console.log("Starting Tailwind CSS detection...");

    // Check stylesheets first
    const { hasTailwindCSSInStylesheets, tailwindVersion } = await checkStylesheetsForTailwind();
    if (hasTailwindCSSInStylesheets) {
      console.log("Tailwind CSS found in stylesheets:", { tailwindVersion });
      sendTailwindStatus(true, tailwindVersion);
      return;
    }

    // Check style tags next
    if (checkStyleTagsForTailwind()) {
      console.log("Tailwind CSS found in style tags");
      sendTailwindStatus(true, "unknown");
      return;
    }

    // Finally, check HTML elements
    if (checkElementsForTailwind()) {
      console.log("Tailwind CSS found in HTML attributes");
      sendTailwindStatus(true, "unknown");
      return;
    }

    console.log("Tailwind CSS not found");
    sendTailwindStatus(false, "unknown");
  };

  const sendTailwindStatus = (hasTailwindCSS, tailwindVersion) => {
    chrome.runtime.sendMessage(
      { status: "CSS Check Done", hasTailwindCSS, tailwindVersion },
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
    console.log("Message received in content.js:", message);

    if (message.action === "checkForTailwindCSS") {
      checkForTailwindCSS(); // Start detection
      sendResponse({ status: "CSS Check Initiated" });
    } else {
      console.log("Unknown action:", message.action);
    }
    return true;
  });
})();
