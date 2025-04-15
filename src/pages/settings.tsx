import { BooleanSetting, InputSetting } from "@/components/setting";
import { defaultSettings, useSettingStore } from "@/lib/settings";

const Settings = () => {
  const { settings } = useSettingStore();

  return (
    <div className="mt-4 gap-y-2 flex flex-col overflow-y-auto flex-1">
      <BooleanSetting
        title="Dark Mode"
        value={settings.darkMode}
        id="darkMode"
        callback={(value: boolean) => {
          if (value) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }}
      />
      <BooleanSetting
        title="Alert Sound"
        value={settings.alertSound}
        id="alertSound"
      />
      <BooleanSetting
        title={`${
          settings.dateFormat ? "MM DD, YYYY" : "YYYY-MM-DD"
        } Date Format`}
        value={settings.dateFormat}
        id="dateFormat"
      />
      <BooleanSetting
        title="Use Words for Date"
        value={settings.dateWords}
        id="dateWords"
      />
      <InputSetting
        title="Value Threshold"
        value={settings.valueThreshold}
        id="valueThreshold"
        type="string"
        placeholder={defaultSettings.valueThreshold}
      />
      <InputSetting
        title="Min Strike"
        value={settings.minStrike}
        id="minStrike"
        type="string"
        placeholder={defaultSettings.minStrike}
      />
      <InputSetting
        title="Max Strike"
        value={settings.maxStrike}
        id="maxStrike"
        type="string"
        placeholder={defaultSettings.maxStrike}
      />
      <InputSetting
        title="Min Expiration Days"
        value={settings.minExp}
        id="minExp"
        type="string"
        placeholder={defaultSettings.minExp}
      />
      <InputSetting
        title="Max Expiration Days"
        value={settings.maxExp}
        id="maxExp"
        type="string"
        placeholder={defaultSettings.maxExp}
      />
    </div>
  );
};

export default Settings;
