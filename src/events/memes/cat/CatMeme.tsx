import MemeOverlay from "../shared/MemeOverlay";
import CatSvg from "./CatSvg";
import "./CatMeme.css";

type Props = {
  fromLeft: boolean;
  durationMs: number;
  onDone: () => void;
};

export default function CatMeme({ fromLeft, durationMs, onDone }: Props) {
  return (
    <MemeOverlay durationMs={durationMs} onDone={onDone}>
      <div
        className={`cat-walker ${fromLeft ? "cat-walker--from-left" : "cat-walker--from-right"}`}
        style={{ animationDuration: `${durationMs}ms` }}
      >
        <CatSvg />
      </div>
    </MemeOverlay>
  );
}
