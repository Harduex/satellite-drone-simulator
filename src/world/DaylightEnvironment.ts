import * as Cesium from "cesium";

export interface DaylightState {
  sunDirection: Cesium.Cartesian3;
  moonDirection: Cesium.Cartesian3;
  sunElevation: number;
  moonElevation: number;
  moonIllumination: number;
  daylight: number;
  twilight: number;
  exposure: number;
  cloudBrightness: number;
  moonLightIntensity: number;
  observer: Cesium.Cartesian3;
  up: Cesium.Cartesian3;
  rotation: Cesium.Matrix3;
  sunPosition: Cesium.Cartesian3;
  moonPosition: Cesium.Cartesian3;
  moonToSun: Cesium.Cartesian3;
  moonToEarth: Cesium.Cartesian3;
}

export function createDaylightState(): DaylightState {
  return {
    sunDirection: new Cesium.Cartesian3(), moonDirection: new Cesium.Cartesian3(),
    sunElevation: 0, moonElevation: 0, moonIllumination: 0,
    daylight: 1, twilight: 0, exposure: 1, cloudBrightness: 1, moonLightIntensity: 0,
    observer: new Cesium.Cartesian3(), up: new Cesium.Cartesian3(), rotation: new Cesium.Matrix3(),
    sunPosition: new Cesium.Cartesian3(), moonPosition: new Cesium.Cartesian3(),
    moonToSun: new Cesium.Cartesian3(), moonToEarth: new Cesium.Cartesian3(),
  };
}

function smooth(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function updateDaylightInto(time: Cesium.JulianDate, longitude: number, latitude: number, out: DaylightState): DaylightState {
  // Cesium's supported fallback avoids loading Earth-orientation datasets for visual daylight.
  Cesium.Transforms.computeTemeToPseudoFixedMatrix(time, out.rotation);
  Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, out.sunPosition);
  Cesium.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(time, out.moonPosition);
  Cesium.Matrix3.multiplyByVector(out.rotation, out.sunPosition, out.sunPosition);
  Cesium.Matrix3.multiplyByVector(out.rotation, out.moonPosition, out.moonPosition);
  Cesium.Cartesian3.fromDegrees(longitude, latitude, 0, Cesium.Ellipsoid.WGS84, out.observer);
  Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(out.observer, out.up);
  Cesium.Cartesian3.subtract(out.sunPosition, out.observer, out.sunDirection);
  Cesium.Cartesian3.normalize(out.sunDirection, out.sunDirection);
  Cesium.Cartesian3.subtract(out.moonPosition, out.observer, out.moonDirection);
  Cesium.Cartesian3.normalize(out.moonDirection, out.moonDirection);
  out.sunElevation = Math.asin(Cesium.Math.clamp(Cesium.Cartesian3.dot(out.sunDirection, out.up), -1, 1));
  out.moonElevation = Math.asin(Cesium.Math.clamp(Cesium.Cartesian3.dot(out.moonDirection, out.up), -1, 1));
  Cesium.Cartesian3.subtract(out.sunPosition, out.moonPosition, out.moonToSun);
  Cesium.Cartesian3.normalize(out.moonToSun, out.moonToSun);
  Cesium.Cartesian3.negate(out.moonPosition, out.moonToEarth);
  Cesium.Cartesian3.normalize(out.moonToEarth, out.moonToEarth);
  out.moonIllumination = Cesium.Math.clamp((1 + Cesium.Cartesian3.dot(out.moonToSun, out.moonToEarth)) / 2, 0, 1);
  const elevation = out.sunElevation * Cesium.Math.DEGREES_PER_RADIAN;
  out.daylight = smooth(-6, 12, elevation);
  out.twilight = smooth(-12, -3, elevation) * (1 - smooth(0, 10, elevation));
  out.exposure = 0.025 + 0.975 * out.daylight;
  out.cloudBrightness = 0.08 + 0.9 * out.daylight;
  out.moonLightIntensity = 0.06 * out.moonIllumination * smooth(0, 10, out.moonElevation * Cesium.Math.DEGREES_PER_RADIAN) * (1 - out.daylight);
  return out;
}

function solarNoon(date: Date, longitude: number): Date {
  const day = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  // NOAA fractional-year equation of time, in minutes; independent of civil timezone/DST.
  const daysInYear = new Date(Date.UTC(date.getUTCFullYear(), 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const gamma = 2 * Math.PI * (day - 1) / daysInYear;
  const correction = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + (720 - 4 * longitude - correction) * 60000);
}

export function selectPleasantDay(now: Date, longitude: number, latitude: number): Date {
  const solarDate = new Date(now.getTime() + longitude * 4 * 60000);
  let noon = solarNoon(solarDate, longitude);
  const state = updateDaylightInto(Cesium.JulianDate.fromDate(noon), longitude, latitude, createDaylightState());
  if (state.sunElevation < Cesium.Math.toRadians(15)) {
    noon = solarNoon(new Date(Date.UTC(solarDate.getUTCFullYear(), latitude >= 0 ? 5 : 11, 21)), longitude);
  }
  return noon;
}
