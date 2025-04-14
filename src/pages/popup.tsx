import { Settings, Bell, BellOff, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AlertEntry from "@/components/AlertEntry";
import SettingsView from "@/pages/settings";
import { useSettingStore } from "@/lib/settings";

type ViewingTab = "all" | "call" | "put";

const pageTitles = {
  main: "Ortex Alerts",
  settings: "Settings",
};
const pageDescs = {
  main: "Alerts for Order Flow",
  settings: "Settings",
};

function App() {
  const [page, setPage] = useState<"main" | "settings">("main");
  const [activeTab, setActiveTab] = useState<ViewingTab>("all");

  const { settings, updateSetting } = useSettingStore();
  console.log(settings);

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  return (
    <>
      <div className="poppins p-4 w-[31rem] h-[35rem] flex flex-col dark:bg-zinc-900 dark:text-white bg-white text-black">
        <div className="w-full flex flex-row justify-between">
          <h1 className="text-xl font-bold">{pageTitles[page]}</h1>
          <div className="flex flex-row gap-x-4 items-center">
            <button
              className="transition transform active:scale-90"
              onClick={() => {
                updateSetting("darkMode", !settings.darkMode);
                if (!settings.darkMode) {
                  document.documentElement.classList.add("dark");
                } else {
                  document.documentElement.classList.remove("dark");
                }
              }}
            >
              {settings.darkMode ? (
                <Sun size={16} className="text-white border-white" />
              ) : (
                <Moon size={16} className="text-black" />
              )}
            </button>
            <button
              className="transition transform active:scale-90"
              onClick={() =>
                page === "main" ? setPage("settings") : setPage("main")
              }
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
        <div className="w-full mt-2 flex flex-row justify-between">
          <h2 className="text-xs">{pageDescs[page]}</h2>
          <button
            className={`transition transform active:scale-90 ${
              settings.enabled ? "text-green-500" : "text-red-500"
            }`}
            onClick={() => {
              updateSetting("enabled", !settings.enabled);
            }}
          >
            <div className="flex flex-row gap-x-2 items-center">
              {settings.enabled ? <Bell size={16} /> : <BellOff size={16} />}
              <p className="text-xs">
                {settings.enabled ? "Active" : "Inactive"}
              </p>
            </div>
          </button>
        </div>

        {page === "main" ? (
          <div className="mt-2 overflow-y-auto flex-1">
            <Tabs
              defaultValue="all"
              value={activeTab}
              onValueChange={(value: string) =>
                setActiveTab(value as ViewingTab)
              }
            >
              <TabsList className="w-full h-8 dark:bg-zinc-800">
                <TabsTrigger
                  value="all"
                  className="w-full h-8 dark:bg-zinc-800"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="call"
                  className="w-full h-8 dark:bg-zinc-800"
                >
                  Calls
                </TabsTrigger>
                <TabsTrigger
                  value="put"
                  className="w-full h-8 dark:bg-zinc-800"
                >
                  Puts
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value={activeTab}
                className="flex flex-col gap-y-2 overflow-y-auto"
              >
                {/* FILLER ENTRIES */}
                <AlertEntry
                  type="call"
                  symbol="AAPL"
                  date={new Date().toISOString()}
                  volume={1000}
                  entries={1}
                  time={new Date().toISOString()}
                  strikeRange={[150, 160]}
                  expires={new Date().toISOString()}
                />

                <AlertEntry
                  type="call"
                  symbol="SPY"
                  date={new Date().toISOString()}
                  volume={500}
                  entries={2}
                  time={new Date().toISOString()}
                  strikeRange={[430, 440]}
                  expires={new Date().toISOString()}
                />

                <AlertEntry
                  type="put"
                  symbol="SPY"
                  date={new Date().toISOString()}
                  volume={300}
                  entries={1}
                  time={new Date().toISOString()}
                  strikeRange={[420, 430]}
                  expires={new Date().toISOString()}
                />

                <AlertEntry
                  type="call"
                  symbol="QQQ"
                  date={new Date().toISOString()}
                  volume={600}
                  entries={1}
                  time={new Date().toISOString()}
                  strikeRange={[350, 360]}
                  expires={new Date().toISOString()}
                />

                <AlertEntry
                  type="put"
                  symbol="NVDA"
                  date={new Date().toISOString()}
                  volume={700}
                  entries={2}
                  time={new Date().toISOString()}
                  strikeRange={[200, 210]}
                  expires={new Date().toISOString()}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <SettingsView />
        )}

        <p className="text-xxs font-light text-center pt-3">
          This extension is <b>not</b> financial advice. Conduct your own
          research before investing or trading.
        </p>
      </div>
    </>
  );
}

export default App;
