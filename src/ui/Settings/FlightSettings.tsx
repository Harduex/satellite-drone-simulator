import { useStore } from "../../store";
import { SettingsPanelHeader, Slider } from "./shared";
import css from "./FlightSettings.module.css";

export function FlightSettings({ onClose }: { onClose: () => void }) {
  const volume = useStore(s => s.audioVolume);
  const setVolume = useStore(s => s.setAudioVolume);
  const showSticks = useStore(s => s.showStickOverlay);
  const setShowSticks = useStore(s => s.setShowStickOverlay);
  const realTime = useStore(s => s.realTimeOfDay);
  const setRealTime = useStore(s => s.setRealTimeOfDay);
  const traffic = useStore(s => s.roadTrafficEnabled);
  const setTraffic = useStore(s => s.setRoadTrafficEnabled);
  const pedestrians = useStore(s => s.pedestriansEnabled);
  const setPedestrians = useStore(s => s.setPedestriansEnabled);
  return (
    <div>
      <SettingsPanelHeader title="Flight Settings" onClose={onClose} />
      <label className={css.toggle}>
        <span>Road Traffic</span>
        <input type="checkbox" role="switch" aria-label="Road Traffic"
          checked={traffic} onChange={event => setTraffic(event.target.checked)} />
      </label>
      <p className={css.hint}>Simulated cars on real roads.</p>
      <label className={css.toggle}>
        <span>Pedestrians</span>
        <input type="checkbox" role="switch" aria-label="Pedestrians"
          checked={pedestrians} onChange={event => setPedestrians(event.target.checked)} />
      </label>
      <p className={css.hint}>Simulated walkers on mapped footpaths.</p>
      <label className={css.toggle}>
        <span>Live stick display</span>
        <input type="checkbox" role="switch" aria-label="Live stick display"
          checked={showSticks} onChange={event => setShowSticks(event.target.checked)} />
      </label>
      <label className={css.toggle}>
        <span>Real time of day</span>
        <input type="checkbox" role="switch" aria-label="Real time of day"
          checked={realTime} onChange={event => setRealTime(event.target.checked)} />
      </label>
      <p className={css.hint}>Use the current time at your flying location. Turn off for bright solar noon.</p>
      <Slider label={volume === 0 ? "Sound · muted" : "Drone sound"} labelWidth={120}
        value={Math.round(volume * 100)} min={0} max={100} unit="%"
        onChange={value => setVolume(value / 100)} />
    </div>
  );
}
