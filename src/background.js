'use strict';

importScripts('/utils.js');

const { getFromStorage, setToStorage, getCurrentTabRootDomainFromStorage, getUrlProtocolPlusHostname } = Utils;

const Engine = {
  storageCache: {},
  /**
   * Initialize Engine
   */
  async init() {
    // get all stored domains and their values from local storage
    Engine.storageCache = await Engine.getAllStorageSyncData();

    // on tab change, get the current tab's root domain and check if it has Tailwind CSS
    this.performOnTabChange();

    // create alarm to delete local storage and cache
    Engine.createAlarm();

    // delete local storage and cache after a week
    Engine.reset('reset');

    chrome.webRequest.onCompleted.addListener(Engine.onStyleSheetRequestComplete, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['stylesheet'],
    });
  },

  disAllowedList: ['https://chrome.google.com', 'https://chrome.google.com/'],

  /**
   * Create an alarm to delete local storage and cache
   */
  createAlarm() {
    chrome.alarms.create('reset', {
      // get week in minutes
      periodInMinutes: 60 * 24 * 7,
    });

    console.log('Reset alarm set to occur every week');
  },

  /**
   * Listen for alarm and act accordingly
   */
  reset(alarmName) {
    chrome.alarms.onAlarm.addListener(async alarm => {
      if (alarm.name === alarmName) {
        try {
          console.log(alarmName, 'Resetting...');
          Engine.resetCacheAndLocalStorage()
            .then(() => {
              console.log('storage after reset', Engine.storageCache);
            })
            .catch(error => console.error('reset', error));
        } catch (error) {
          console.error('reset', error);
        }
      }
    });
  },

  /**
   * Clear caches
   */
  async resetCacheAndLocalStorage() {
    Engine.storageCache = {};
    await Utils.promisify(chrome.storage.sync, 'clear');
  },

  /**
   * Get all storage data
   * @returns {Promise<any>}
   * @private
   * @see https://developer.chrome.com/extensions/storage#type-StorageArea
   * @see https://developer.chrome.com/extensions/storage#method-StorageArea.get
   * @see https://developer.chrome.com/extensions/storage#type-StorageArea.StorageArea
   * */
  async getAllStorageSyncData() {
    // Immediately return a promise and start asynchronous work
    return new Promise((resolve, reject) => {
      // Asynchronously fetch all data from storage.sync.
      chrome.storage.sync.get(null, items => {
        // Pass any observed errors down the promise chain.
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        // Pass the data retrieved from storage down the promise chain.
        resolve(items);
      });
    });
  },

  /**
   * Perform action on tab change
   */
  performOnTabChange() {
    chrome.tabs.onActivated.addListener(async () => {
      getCurrentTabRootDomainFromStorage().then(({ storage, rootDomain }) => {
        // check cache for root domain
        if (!Engine.storageCache[rootDomain] && Engine.beginsWithHttpProtocols(rootDomain) && !Engine.disAllowedList.includes(rootDomain)) {
          fetch(rootDomain)
            .then(async function (response) {
              // regex get stylesheet
              const regex = /<link[^>]*rel="stylesheet"[^>]*href="([^"]*)"[^>]*>/g;

              const links = [];
              let match;
              const text = await response.text();

              while ((match = regex.exec(text)) !== null) {
                links.push(match[1]);
              }

              if (links.length > 0) {
                for await (const link of links) {
                  if (Engine.beginsWithHttpProtocols(link) && !Engine.disAllowedList.includes(link)) {
                    await Engine.fetchStyleSheet(link, rootDomain);
                  } else {
                    await Engine.fetchStyleSheet(`${rootDomain}${link}`, rootDomain);
                  }
                }
              } else {
                // no stylesheet found
                console.log('no stylesheet found for root domain -', rootDomain);

                await setToStorage(rootDomain, {});
                Engine.storageCache[rootDomain] = {};
              }
            })
            .catch(error => console.log('fetch error', error));
        } else {
          console.log('cache hit', rootDomain);
        }
      });
    });
  },

  /**
   * Check if string is starts with https:// or http:// or www.
   * @param {String} url
   * */
  beginsWithHttpProtocols(url) {
    if (url) {
      return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('www.');
    }
  },

  async fetchStyleSheet(url, rootDomain) {
    fetch(url)
      .then(response => response.text())
      .then(async text => {
        await Engine.analyze(text, rootDomain);
      })
      .catch(error => console.log(rootDomain, error));
  },

  /**
   * analyze stylesheets
   * @param {Object} request
   */
  async onStyleSheetRequestComplete(request) {
    await Engine.fetchStyleSheet(request.url, getUrlProtocolPlusHostname(request.initiator));
  },

  async analyze(text, rootDomain) {
    if (rootDomain) {
      // detect tailwindcss
      const regexHasTailwindcss = /(?<![\w\d])(?:tailwind|tailwindcss|--tw-bg-opacity|--tw-hue-rotate|--tw-translate-x|--tw-ring-offset-width|--tw-ring-shadow|--tw-content)(?![\w\d])/gi;
      const hasTailwindCss = regexHasTailwindcss.test(text);

      // detect tailwindcss version
      const regexHasVersion = /(?:^|\s)tailwindcss\s+([^\s]+)/gi;
      const versions = [];

      let match;

      while ((match = regexHasVersion.exec(text))) {
        versions.push(match[1]);
      }

      await setToStorage(rootDomain, { versions, hasTailwindCss });

      // Cache the data
      Engine.storageCache[rootDomain] = { versions, hasTailwindCss };
    }
  },
};

Engine.init();
