/**
 * Reads a value from chrome.storage.local for a given key.
 *
 * @param key - The key of the item to read.
 * @returns A promise that resolves to the value stored, or undefined if not found.
 */
async function get<T>(key: string): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error reading from chrome.storage.local:",
          chrome.runtime.lastError.message
        );
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result[key]);
    });
  });
}

/**
 * Writes a key-value pair to chrome.storage.local.
 *
 * @param key - The key under which the value should be stored.
 * @param value - The value to store (must be JSON-serializable).
 * @returns A promise that resolves when the value has been stored.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function write(key: string, value: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error writing to chrome.storage.local:",
          chrome.runtime.lastError.message
        );
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

/**
 * Removes a key (and its associated value) from chrome.storage.local.
 *
 * @param key - The key of the item to remove.
 * @returns A promise that resolves when the item has been removed.
 */
export async function remove(key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error removing from chrome.storage.local:",
          chrome.runtime.lastError.message
        );
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

type Request = {
  type: string;
  data?: any;
};

chrome.runtime.onMessage.addListener(
  (request: Request, _sender, sendResponse) => {
    if (request.type === "get") {
      // We still need to use this pattern for Chrome message listeners
      (async () => {
        try {
          const data = await get(request.data);

          sendResponse(data);
        } catch (err) {
          console.error(err);
          sendResponse("");
        }
      })();

      // Return true to indicate that we will send a response asynchronously
      return true;
    } else if (request.type === "write") {
      // We still need to use this pattern for Chrome message listeners
      (async () => {
        try {
          const data = await write(request.data.key, request.data.value);

          sendResponse(data);
        } catch (err) {
          console.error(err);
          sendResponse("");
        }
      })();
    }
  }
);
