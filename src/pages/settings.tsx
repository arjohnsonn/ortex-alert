import { BooleanSetting } from "@/components/setting";
import { useSettingStore } from "@/lib/settings";

const settings = () => {
  const { settings } = useSettingStore();

  return (
    <div className="mt-4 overflow-y-auto flex-1">
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
    </div>
  );
};

export default settings;
