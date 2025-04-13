import { create } from "zustand";

/**
 * Reads a value from chrome.storage.local for a given key.
 *
 * @param key - The key of the item to read.
 * @returns A promise that resolves to the value stored, or undefined if not found.
 */
export async function get<T>(key: string): Promise<T | undefined> {
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
export async function write(key: string, value: any): Promise<void> {
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

export type Settings = {
  enabled: boolean;
  darkMode: boolean;
  valueThreshold: number;
  minStrike: number;
  maxStrike: number;
  minExp: number;
  maxExp: number;
};

export const defaultSettings: Settings = {
  enabled: true,
  darkMode: false,
  valueThreshold: 800000,
  minStrike: 100,
  maxStrike: 800,
  minExp: 0,
  maxExp: 365,
};

const initialSettings: Settings = defaultSettings;

const useSettingStore = create<{
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setAllSettings: (settings: Settings) => void;
}>((set, get) => ({
  settings: initialSettings,
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const currentSettings = get().settings;
    const newSettings = {
      ...currentSettings,
      [key]: value,
    };
    write("settings", newSettings);
    console.log("Updated settings:", newSettings);
    set({ settings: newSettings });
  },
  setAllSettings: (settings: Settings) => {
    write("settings", settings);
    console.log("Updated settings:", settings);
    set({ settings });
  },
}));

(async () => {
  const storedSettings: Settings = (await get("settings")) as Settings;
  useSettingStore.getState().setAllSettings(storedSettings);
})();

export { useSettingStore };
