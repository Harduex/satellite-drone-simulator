import { useStore } from "../../store";
import { SettingsPanelHeader, Slider } from "./shared";
import css from "./FlightSettings.module.css";

export function FlightSettings({ onClose }: { onClose: () => void }) {
  const volume = useStore(s => s.audioVolume);
  const setVolume = useStore(s => s.setAudioVolume);
  const showSticks = useStore(s => s.showStickOverlay);
  const setShowSticks = useStore(s => s.setShowStickOverlay);
  return (
    <div>
      <SettingsPanelHeader title="Flight Settings" onClose={onClose} />
      <label className={css.toggle}>
        <span>Live stick display</span>
        <input type="checkbox" role="switch" aria-label="Live stick display"
          checked={showSticks} onChange={event => setShowSticks(event.target.checked)} />
      </label>
      <Slider label={volume === 0 ? "Sound · muted" : "Drone sound"} labelWidth={120}
        value={Math.round(volume * 100)} min={0} max={100} unit="%"
        onChange={value => setVolume(value / 100)} />
    </div>
  );
}
