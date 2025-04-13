import { Switch } from "@/components/ui/switch";
import { useSettingStore } from "@/lib/settings";
import { Settings } from "@/lib/settings";

type Props = {
  title: string;
  id: keyof Settings;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  callback: (...args: any[]) => void;
};

const BooleanSetting = (props: Props) => {
  const { updateSetting } = useSettingStore();
  return (
    <div className="flex flex-row items-center justify-between">
      <p className="font-bold text-xl">{props.title}</p>
      <Switch
        id={props.id}
        checked={props.value}
        onCheckedChange={() => {
          props.value = !props.value;
          updateSetting(props.id, props.value);

          if (props.callback) {
            props.callback(props.value);
          }
        }}
      />
    </div>
  );
};

export { BooleanSetting };
