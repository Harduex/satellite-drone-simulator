import * as Cesium from "cesium";
import type { DaylightState } from "./DaylightEnvironment";

export interface EnvironmentSky {
  primitives: readonly Cesium.Primitive[];
  update(state: DaylightState, cameraPosition: Cesium.Cartesian3): void;
  destroy(): void;
}

/** Camera-centered geometry keeps the sky inside the 30 km FPV frustum. */
export function createEnvironmentSky(longitude: number, latitude: number): EnvironmentSky {
  const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(Cesium.Cartesian3.fromDegrees(longitude, latitude));
  const material = new Cesium.Material({
    fabric: {
      type: "FlightEnvironmentSky",
      uniforms: {
        localUp: up, sunDirection: new Cesium.Cartesian3(1, 0, 0), moonDirection: new Cesium.Cartesian3(0, 1, 0),
        daylight: 1, twilight: 0, sunVisible: 0, moonVisible: 0,
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec3 ray = normalize(czm_inverseViewRotation * -materialInput.positionToEyeEC);
          float elevation = max(0.0, dot(ray, localUp));
          float gradient = pow(elevation, 0.45);
          vec3 day = mix(vec3(0.765, 0.847, 0.902), vec3(0.224, 0.459, 0.706), gradient);
          vec3 night = mix(vec3(0.017, 0.023, 0.046), vec3(0.004, 0.007, 0.020), gradient);
          vec3 dusk = mix(vec3(0.55, 0.26, 0.14), vec3(0.025, 0.055, 0.15), gradient);
          vec3 sky = mix(night, day, daylight);
          sky = mix(sky, dusk, twilight * (1.0 - daylight * 0.5));
          float sunAngle = acos(clamp(dot(ray, sunDirection), -1.0, 1.0));
          float sunDisk = 1.0 - smoothstep(0.0043, 0.0048, sunAngle);
          float sunGlow = exp(-sunAngle * sunAngle / 0.001) * 0.18;
          sky += vec3(1.0, 0.87, 0.60) * (sunDisk + sunGlow) * sunVisible;
          float moonCos = dot(ray, moonDirection);
          vec3 tangent = (ray - moonDirection * moonCos) / 0.0045;
          float radiusSquared = dot(tangent, tangent);
          vec3 lunarNormal = tangent - moonDirection * sqrt(max(0.0, 1.0 - radiusSquared));
          float lit = max(0.0, dot(lunarNormal, sunDirection));
          float lunarDisk = (1.0 - smoothstep(0.93, 1.0, radiusSquared)) * step(0.0, moonCos);
          sky = mix(sky, vec3(0.82, 0.85, 0.9) * (0.015 + 0.985 * lit), lunarDisk * moonVisible);
          material.diffuse = sky;
          material.alpha = 1.0;
          return material;
        }
      `,
    },
    translucent: false,
  });
  const primitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({ geometry: new Cesium.EllipsoidGeometry({
      radii: new Cesium.Cartesian3(29000, 29000, 29000),
      vertexFormat: Cesium.MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
      stackPartitions: 32, slicePartitions: 64,
    }) }),
    appearance: new Cesium.MaterialAppearance({
      material, materialSupport: Cesium.MaterialAppearance.MaterialSupport.BASIC,
      flat: true, translucent: false, closed: false,
      renderState: { cull: { enabled: true, face: Cesium.CullFace.FRONT }, depthTest: { enabled: true }, depthMask: false },
    }),
    asynchronous: false, allowPicking: false, shadows: Cesium.ShadowMode.DISABLED,
  });
  return {
    primitives: [primitive],
    update(state, cameraPosition) {
      Cesium.Matrix4.fromTranslation(cameraPosition, primitive.modelMatrix);
      Cesium.Cartesian3.clone(state.sunDirection, material.uniforms.sunDirection);
      Cesium.Cartesian3.clone(state.moonDirection, material.uniforms.moonDirection);
      material.uniforms.daylight = state.daylight;
      material.uniforms.twilight = state.twilight;
      material.uniforms.sunVisible = state.sunElevation >= 0 ? 1 : 0;
      material.uniforms.moonVisible = state.moonElevation >= 0 ? 1 : 0;
    },
    destroy() { if (!primitive.isDestroyed()) primitive.destroy(); },
  };
}
