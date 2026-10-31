import { useStore } from '../../store';
import { DEFAULT_ACTUAL_RATES } from '../../core/flight-controller/RatesConfig';
import type { ActualAxisRates, ActualRatesConfig } from '../../core/physics/types';
import { Slider } from './shared';
import css from './ControllerSetup.module.css';

export function RatesSettings() {
  const rates = useStore(s => s.rates);
  const setRates = useStore(s => s.setRates);
  const actual = rates.actual ?? DEFAULT_ACTUAL_RATES;
  const updateAxis = (axis: keyof ActualRatesConfig, values: Partial<ActualAxisRates>) => {
    setRates({ actual: { ...actual, [axis]: { ...actual[axis], ...values } } });
  };
  return <section className={css.stepPanel} aria-label="Flight rates">
    <h3 className={css.stepTitle}>Flight rates</h3>
    <label className={css.presetRow}>
      <span className={css.presetLabel}>Rate model</span>
      <select className={css.selectInput} aria-label="Rate model" value={rates.model ?? 'polynomial'}
        onChange={event => setRates({ model: event.target.value === 'actual' ? 'actual' : 'polynomial' })}>
        <option value="polynomial">Polynomial (original)</option>
        <option value="actual">Betaflight Actual</option>
      </select>
    </label>
    {rates.model === 'actual' ? <>
      <p className={css.hint}>Center sensitivity, maximum rate and expo are independent for each axis. Switching models keeps both sets of values.</p>
      {(['roll', 'pitch', 'yaw'] as const).map(axis => {
        const label = axis[0]!.toUpperCase() + axis.slice(1);
        return <div key={axis}>
          <h4 className={css.sectionLabel}>{label}</h4>
          <Slider label={`${label} center`} value={actual[axis].centerSensitivity} min={0} max={2000} step={10} unit="deg/s" labelWidth={105}
            onChange={value => updateAxis(axis, { centerSensitivity: value })} />
          <Slider label={`${label} max`} value={actual[axis].maxRate} min={0} max={2000} step={10} unit="deg/s" labelWidth={105}
            onChange={value => updateAxis(axis, { maxRate: value })} />
          <Slider label={`${label} expo`} value={actual[axis].expo} min={0} max={1} step={0.01} labelWidth={105}
            onChange={value => updateAxis(axis, { expo: value })} />
          {actual[axis].maxRate < actual[axis].centerSensitivity && <p className={css.hint}>Effective maximum is the center sensitivity.</p>}
        </div>;
      })}
    </> : <>
      <Slider label="Roll Rate" value={rates.rollRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={value => setRates({ rollRate: value })} />
      <Slider label="Pitch Rate" value={rates.pitchRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={value => setRates({ pitchRate: value })} />
      <Slider label="Yaw Rate" value={rates.yawRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={value => setRates({ yawRate: value })} />
      <Slider label="Expo" value={rates.expo} min={0} max={1} step={0.05} labelWidth={80} onChange={value => setRates({ expo: value })} />
    </>}
  </section>;
}
