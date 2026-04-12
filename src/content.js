(function () {
  const BOOTSTRAP_KEY = '__BUILT_WITH_TAILWIND_CSS_BOOTSTRAP__';
  if (window[BOOTSTRAP_KEY]) {
    return;
  }
  window[BOOTSTRAP_KEY] = true;

  const DEBUG = false;
  const log = (...args) => {
    if (DEBUG) {
      console.log(...args);
    }
  };

  const MAX_STYLESHEET_CHECKS = 24;
  const FETCH_CONCURRENCY = 3;
  const MAX_DOM_NODES_TO_SCAN = 8000;

  const isTailwindCssText = text => {
    if (!text || typeof text !== 'string') {
      return false;
    }
    const t = text;
    if (t.includes('tailwindcss') || t.includes('https://tailwindcss.com')) {
      return true;
    }
    if (t.includes('--tw-')) {
      return true;
    }
    if (/@import\s+["']tailwindcss["']/.test(t) || /@import\s+"tailwindcss"/.test(t)) {
      return true;
    }
    if (/@theme\b/.test(t) || /@layer\s+utilities/.test(t)) {
      return true;
    }
    return false;
  };

  const extractTailwindVersion = text => {
    const regexHasVersion = /(?:^|\s)tailwindcss\s+v?([^\s]+)/gi;
    const versions = [];
    let match;
    while ((match = regexHasVersion.exec(text))) {
      versions.push(match[1]);
    }
    return versions.length > 0 ? versions[0] : null;
  };

  const isTailwindStylesheet = async href => {
    try {
      const response = await fetch(href);
      const text = await response.text();
      return {
        containsTailwindClass: isTailwindCssText(text),
        version: extractTailwindVersion(text),
      };
    } catch (e) {
      log(`Could not access stylesheet: ${href}`, e);
      return { containsTailwindClass: false, version: null };
    }
  };

  const runPool = async (items, limit, worker) => {
    if (items.length === 0) {
      return [];
    }
    const results = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= items.length) {
          return;
        }
        results[idx] = await worker(items[idx], idx);
      }
    };

    const poolSize = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
    return results;
  };

  const checkStylesheetsForTailwind = async () => {
    const sheets = Array.from(document.styleSheets).filter(sheet => sheet?.href);
    const hrefs = sheets
      .map(s => s.href)
      .filter(h => /\.css($|\?)/i.test(h) || h.includes('.css?'))
      .slice(0, MAX_STYLESHEET_CHECKS);

    const results = await runPool(hrefs, FETCH_CONCURRENCY, async href => {
      const result = await isTailwindStylesheet(href);
      return { href, ...result };
    });

    for (const r of results) {
      if (r && r.containsTailwindClass) {
        log('Tailwind CSS found in stylesheet:', r.href);
        return { hasTailwindCSSInStylesheets: true, tailwindVersion: r.version || 'unknown' };
      }
    }

    return { hasTailwindCSSInStylesheets: false, tailwindVersion: 'unknown' };
  };

  const checkStyleTagsForTailwind = () => {
    const styleTags = Array.from(document.querySelectorAll('style'));
    for (const tag of styleTags) {
      if (isTailwindCssText(tag.textContent || tag.innerHTML)) {
        log('Tailwind CSS found in style tag.');
        return true;
      }
    }
    return false;
  };

  const checkElementsForTailwind = () => {
    const treeWalker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let count = 0;
    let node = treeWalker.nextNode();
    while (node && count < MAX_DOM_NODES_TO_SCAN) {
      count++;
      const el = node;
      if (el.classList && el.classList.length) {
        for (const cls of el.classList) {
          if (isTailwindCssText(cls)) {
            log('Tailwind CSS found in HTML class attribute.');
            return true;
          }
        }
      }
      node = treeWalker.nextNode();
    }
    return false;
  };

  const checkForTailwindCSS = async () => {
    log('Starting Tailwind CSS detection...');

    const { hasTailwindCSSInStylesheets, tailwindVersion } = await checkStylesheetsForTailwind();
    if (hasTailwindCSSInStylesheets) {
      const result = { hasTailwindCSS: true, tailwindVersion };
      sendTailwindStatus(result.hasTailwindCSS, result.tailwindVersion);
      return result;
    }

    if (checkStyleTagsForTailwind()) {
      const result = { hasTailwindCSS: true, tailwindVersion: 'unknown' };
      sendTailwindStatus(result.hasTailwindCSS, result.tailwindVersion);
      return result;
    }

    if (checkElementsForTailwind()) {
      const result = { hasTailwindCSS: true, tailwindVersion: 'unknown' };
      sendTailwindStatus(result.hasTailwindCSS, result.tailwindVersion);
      return result;
    }

    const result = { hasTailwindCSS: false, tailwindVersion: 'unknown' };
    sendTailwindStatus(result.hasTailwindCSS, result.tailwindVersion);
    return result;
  };

  const sendTailwindStatus = (hasTailwindCSS, tailwindVersion) => {
    chrome.runtime.sendMessage({ status: 'CSS Check Done', hasTailwindCSS, tailwindVersion }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError.message);
      } else {
        log('Final detection result sent, response:', response);
      }
    });
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received in content.js:', message);

    if (message.action === 'checkForTailwindCSS') {
      checkForTailwindCSS().then(result => sendResponse(result));
      return true;
    }
    return false;
  });
})();
