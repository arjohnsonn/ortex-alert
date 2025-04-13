import { Settings, Bell, BellOff, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AlertEntry from "@/components/AlertEntry";

function App() {
  const [enabled, setEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <>
      <div
        className={`poppins p-4 w-[31rem] h-[35rem] border-4 border-black flex flex-col ${
          isDarkMode ? "bg-zinc-900 text-white" : "bg-white text-black"
        }`}
      >
        <div className="w-full flex flex-row justify-between">
          <h1 className="text-xl font-bold">Ortex Alert</h1>
          <div className="flex flex-row gap-x-4 items-center">
            <button
              className="transition transform active:scale-90"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? (
                <Sun size={16} className="text-white border-white" />
              ) : (
                <Moon size={16} className="text-black" />
              )}
            </button>
            <button className="transition transform active:scale-90">
              <Settings size={16} />
            </button>
          </div>
        </div>``
        <div className="w-full mt-1 flex flex-row justify-between">
          <h2 className="text-xs">For Options Flow</h2>
          <button
            className={`transition transform active:scale-90 ${
              enabled ? "text-green-500" : "text-red-500"
            }`}
            onClick={() => setEnabled(!enabled)}
          >
            <div className="flex flex-row gap-x-2 items-center">
              {enabled ? <Bell size={16} /> : <BellOff size={16} />}
              <p className="text-xs">{enabled ? "Active" : "Inactive"}</p>
            </div>
          </button>
        </div>

        <div className="mt-2 overflow-y-auto flex-1">
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsList
              className={`w-full h-8 ${isDarkMode ? "bg-zinc-800" : ""}`}
            >
              <TabsTrigger
                value="all"
                className={`${
                  isDarkMode ? "data-[state=active]:bg-zinc-700 text-white" : ""
                }`}
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="call"
                className={`${
                  isDarkMode ? "data-[state=active]:bg-zinc-700 text-white" : ""
                }`}
              >
                Calls
              </TabsTrigger>
              <TabsTrigger
                value="put"
                className={`${
                  isDarkMode ? "data-[state=active]:bg-zinc-700 text-white" : ""
                }`}
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
                darkMode={isDarkMode}
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
                darkMode={isDarkMode}
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
                darkMode={isDarkMode}
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
                darkMode={isDarkMode}
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
                darkMode={isDarkMode}
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
      </div>
    </>
  );
}

export default App;
