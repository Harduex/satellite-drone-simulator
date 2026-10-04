import { useStore } from "../../store";
import { DualStickCrosshair } from "../StickDisplay";
import css from "./LiveSticks.module.css";

export function LiveSticks() {
  const visible = useStore(s => s.showStickOverlay);
  const sticks = useStore(s => s.liveSticks);
  if (!visible) return null;
  return (
    <div className={css.root} role="group" aria-label="Live flight sticks">
      <DualStickCrosshair leftX={sticks.yaw} leftY={sticks.throttle}
        rightX={sticks.roll} rightY={sticks.pitch} size={80} />
    </div>
  );
}
