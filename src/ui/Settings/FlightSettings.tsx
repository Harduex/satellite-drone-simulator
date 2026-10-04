import { useStore } from "../../store";
import { SettingsPanelHeader, Slider } from "./shared";

export function FlightSettings({ onClose }: { onClose: () => void }) {
  const volume = useStore(s => s.audioVolume);
  const setVolume = useStore(s => s.setAudioVolume);
  return (
    <div>
      <SettingsPanelHeader title="Flight Settings" onClose={onClose} />
      <Slider label={volume === 0 ? "Sound · muted" : "Drone sound"} labelWidth={120}
        value={Math.round(volume * 100)} min={0} max={100} unit="%"
        onChange={value => setVolume(value / 100)} />
    </div>
  );
}
