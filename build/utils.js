const Utils = {
  /**
   * Get value from local storage
   * @param {String} key
   * @param {string|mixed|null} defaultValue
   */
  async getFromStorage(key) {
    try {
      const option = await Utils.promisify(chrome.storage.sync, 'get', key);

      if (option[key] !== undefined) {
        return option[key];
      }
    } catch (error) {
      console.error('getFromStorage', error);
    }
  },

  /**
   * Get value from local storage
   * @param {String} key
   * @param {string|mixed|null} value
   */
  async setToStorage(key, value) {
    try {
      await Utils.promisify(chrome.storage.sync, 'set', {
        [key]: value,
      });
    } catch (error) {
      console.error(' setToStorage |', error);
    }
  },

  getUrlProtocolPlusHostname(url) {
    // regex to get root domain
    const regex = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www?\.)?([^:\/?\n]+)/gim;
    const match = regex.exec(url) || [];
    const rootDomain = match.length ? match[0] : null;

    return rootDomain;
  },
  /**
   * Get root domain value from local storage
   * @returns {Promise<any>}
   * @private
   * @see https://developer.chrome.com/extensions/storage#type-StorageArea
   * @see https://developer.chrome.com/extensions/storage#method-StorageArea.get
   * @see https://developer.chrome.com/extensions/storage#type-StorageArea.StorageArea
   * */
  async getCurrentTabRootDomainFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
        const activeTab = tabs[0];
        const activeTabUrl = activeTab.url;
        const rootDomain = Utils.getUrlProtocolPlusHostname(activeTabUrl);

        // get local storage
        const storage = await Utils.getFromStorage(rootDomain);

        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        resolve({ storage, rootDomain });
      });
    });
  },
  /**
   * Uses promises to await the chrome API
   * @param {Object} context
   * @param {String} method
   * @param  {...any} args
   */
  promisify(context, method, ...args) {
    return new Promise((resolve, reject) => {
      context[method](...args, (...args) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        resolve(...args);
      });
    });
  },
};
