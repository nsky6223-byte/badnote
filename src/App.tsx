import { useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasHandle, type SelectionInfo } from "./canvas/DrawingCanvas";
import Toolbar from "./components/Toolbar";
import { DEFAULT_SETTINGS, type DrawSettings } from "./settings";

const NO_SELECTION: SelectionInfo = {
  hasSelection: false,
  canRecolor: false,
  canCrop: false,
  cropActive: false,
};

function App() {
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  const [selection, setSelection] = useState<SelectionInfo>(NO_SELECTION);
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const updateSettings = (patch: Partial<DrawSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="app">
      <Toolbar
        settings={settings}
        onChange={updateSettings}
        selection={selection}
        onCopy={() => canvasRef.current?.copySelection()}
        onCut={() => canvasRef.current?.cutSelection()}
        onDelete={() => canvasRef.current?.deleteSelection()}
        onDuplicate={() => canvasRef.current?.duplicateSelection()}
        onRecolor={(color) => canvasRef.current?.recolorSelection(color)}
        onToggleCrop={() => canvasRef.current?.toggleCrop()}
        onAddImage={(file) => canvasRef.current?.addImage(file)}
      />
      <div className="canvas-area">
        <DrawingCanvas ref={canvasRef} settings={settings} onSelectionChange={setSelection} />
      </div>
    </div>
  );
}

export default App;
