import { useState } from "react";
import DrawingCanvas from "./canvas/DrawingCanvas";
import Toolbar from "./components/Toolbar";
import { DEFAULT_SETTINGS, type DrawSettings } from "./settings";

function App() {
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);

  const updateSettings = (patch: Partial<DrawSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="app">
      <Toolbar settings={settings} onChange={updateSettings} />
      <div className="canvas-area">
        <DrawingCanvas settings={settings} />
      </div>
    </div>
  );
}

export default App;
