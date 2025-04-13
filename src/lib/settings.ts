import { create } from "zustand";
import { get, write } from "./storage";

export type Settings = {
  enabled: boolean;
  darkMode: boolean;
};

const defaultSettings: Settings = {
  enabled: false,
  darkMode: false,
};

let initialSettings: Settings = defaultSettings;

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
