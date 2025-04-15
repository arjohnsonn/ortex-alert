import { Settings, Bell, BellOff, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AlertEntry from "@/components/AlertEntry";
import SettingsView from "@/pages/settings";
import { useSettingStore } from "@/lib/settings";
import { Button } from "@/components/ui/button";

type SavedEntry = {
  expiryDate: string;
  type: string;
  totalValue: number;
  entries: any[];
  timestamp: string;
  symbol: string;
  time: number;
  strikeRange: number[];
};

type ViewingTab = "all" | "call" | "put";

const pageTitles = {
  main: "Ortex Alerts",
  settings: "Settings",
};
const pageDescs = {
  main: "Alerts for Order Flow",
  settings: "Enabled",
};

function App() {
  const [page, setPage] = useState<"main" | "settings">("main");
  const [activeTab, setActiveTab] = useState<ViewingTab>("all");
  const [savedAlerts, setSavedAlerts] = useState<any>([]);

  const { settings, updateSetting } = useSettingStore();

  useEffect(() => {
    const fetchAlerts = async () => {
      const alerts = await chrome.runtime.sendMessage({
        type: "get",
        data: "alerts",
      });
      setSavedAlerts(alerts);
    };
    fetchAlerts();
  }, []);

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
            <Button
              onClick={async () => {
                setSavedAlerts([]);
                await chrome.runtime.sendMessage({
                  type: "write",
                  data: { key: "alerts", value: [] },
                });
              }}
              className="h-6 w-12 text-xs text-center transition transform duration-200 active:scale-90"
            >
              Clear
            </Button>
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
                {savedAlerts &&
                  savedAlerts
                    .slice()
                    .reverse()
                    .filter((alert: SavedEntry) =>
                      activeTab === "all"
                        ? true
                        : alert.type.toLowerCase() === activeTab
                    )
                    .map((alert: SavedEntry, idx: number) => (
                      <AlertEntry
                        key={idx}
                        type={alert.type.toLowerCase() as "call" | "put"}
                        symbol={alert.symbol}
                        date={alert.timestamp.toString()}
                        value={alert.totalValue}
                        entries={alert.entries.length}
                        time={alert.timestamp.toString()}
                        strikeRange={alert.strikeRange}
                        expires={alert.expiryDate}
                      />
                    ))}
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
