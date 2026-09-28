import { useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasHandle } from "./canvas/DrawingCanvas";
import Toolbar from "./components/Toolbar";
import { DEFAULT_SETTINGS, type DrawSettings } from "./settings";

function App() {
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  const [hasSelection, setHasSelection] = useState(false);
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const updateSettings = (patch: Partial<DrawSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="app">
      <Toolbar
        settings={settings}
        onChange={updateSettings}
        hasSelection={hasSelection}
        onCopy={() => canvasRef.current?.copySelection()}
        onCut={() => canvasRef.current?.cutSelection()}
        onDelete={() => canvasRef.current?.deleteSelection()}
        onDuplicate={() => canvasRef.current?.duplicateSelection()}
        onRecolor={(color) => canvasRef.current?.recolorSelection(color)}
      />
      <div className="canvas-area">
        <DrawingCanvas ref={canvasRef} settings={settings} onSelectionChange={setHasSelection} />
      </div>
    </div>
  );
}

export default App;
