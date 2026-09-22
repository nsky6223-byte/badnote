import { useState } from "react";
import DrawingCanvas from "./canvas/DrawingCanvas";
import type { Tool } from "./canvas/engine/strokeEngine";
import Toolbar from "./components/Toolbar";

function App() {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [penSize, setPenSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);

  return (
    <div className="app">
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        penSize={penSize}
        onPenSizeChange={setPenSize}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
      />
      <div className="canvas-area">
        <DrawingCanvas tool={tool} color={color} penSize={penSize} eraserSize={eraserSize} />
      </div>
    </div>
  );
}

export default App;
