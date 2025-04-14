import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettingStore } from "@/lib/settings";
import { Settings } from "@/lib/settings";
import { useState, useEffect } from "react";

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
  // Initialize local state with the incoming value.
  const [localValue, setLocalValue] = useState(props.value);

  // Optionally, update local state if the prop value ever changes.
  useEffect(() => {
    setLocalValue(props.value);
  }, [props.value]);

  return (
    <div className="flex flex-row items-center justify-between">
      <p className="font-normal text-sm">{props.title}</p>

      <Input
        type="number"
        placeholder={props.placeholder.toString()}
        value={localValue}
        onChange={(e) => {
          const value = parseInt(e.target.value);
          if (isNaN(value)) {
            return;
          }
          // Update local state so the user sees the change immediately.
          setLocalValue(value);
        }}
        onBlur={() => {
          // When the input loses focus, update the store and send the message
          updateSetting(props.id, localValue);
          if (props.callback) {
            props.callback(localValue);
          }
          sendMessage("update");
        }}
        className="w-1/4 h-7"
      />
    </div>
  );
};

export { BooleanSetting, InputSetting };
