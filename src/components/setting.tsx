import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettingStore } from "@/lib/settings";
import { Settings } from "@/lib/settings";

async function sendMessage(message: any) {
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab && tab.id !== undefined) {
        await chrome.tabs.sendMessage(tab.id, message);
      }
    } catch (e) {
      // Optionally, handle the error here
    }
  })();
}

interface SettingField {
  title: string;
  id: keyof Settings;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  callback?: (...args: any[]) => void;
}

interface InputField extends SettingField {
  type: "string";
  placeholder: string | number;
}

const BooleanSetting = (props: SettingField) => {
  const { updateSetting } = useSettingStore();
  return (
    <div className="flex flex-row items-center justify-between">
      <p className="font-normal text-sm">{props.title}</p>
      <Switch
        id={props.id}
        checked={props.value}
        onCheckedChange={() => {
          props.value = !props.value;
          updateSetting(props.id, props.value);

          if (props.callback) {
            props.callback(props.value);
          }
          sendMessage("update");
        }}
      />
    </div>
  );
};

const InputSetting = (props: InputField) => {
  const { updateSetting } = useSettingStore();

  return (
    <div className="flex flex-row items-center justify-between">
      <p className="font-normal text-sm">{props.title}</p>

      <Input
        type="number"
        placeholder={props.placeholder.toString()}
        onChange={(e) => {
          const value = parseInt(e.target.value);
          if (isNaN(value)) {
            return;
          }
          props.value = value;
          updateSetting(props.id, props.value);

          if (props.callback) {
            props.callback(props.value);
          }

          sendMessage("update");
        }}
        className="w-1/4 h-7"
      />
    </div>
  );
};

export { BooleanSetting, InputSetting };
