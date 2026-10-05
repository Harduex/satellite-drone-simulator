import { describe, expect, it, vi } from "vitest";
import { PbfWriter } from "pbf";
import {
  RoadSource,
  normalizeRoadProperties,
  selectCoverageTiles,
  readBoundedResponse,
  validateTileTemplate,
  validateRoadTileGeometry,
  clipRoadLine,
} from "../RoadSource";

describe("road source boundary", () => {
  it("limits concurrent tile requests and reuses bounded cached roads", async () => {
    const geometry = new PbfWriter();
    for (const number of [9, 0, 0, 10, 200, 0]) geometry.writeVarint(number);
    const tile = new PbfWriter();
    tile.writeMessage(
      3,
      (_value, layer) => {
        layer.writeStringField(1, "transportation");
        layer.writeStringField(3, "class");
        layer.writeVarintField(5, 4096);
        layer.writeMessage(
          4,
          (_value, value) => value.writeStringField(1, "minor"),
          undefined,
        );
        layer.writeMessage(
          2,
          (_value, feature) => {
            feature.writeBytesField(2, new Uint8Array([0, 0]));
            feature.writeVarintField(3, 2);
            feature.writeBytesField(4, geometry.finish());
          },
          undefined,
        );
      },
      undefined,
    );
    const bytes = tile.finish();
    let maximum = 0,
      active = 0,
      requests = 0;
    const releases: (() => void)[] = [];
    const fetcher: typeof fetch = async (input) => {
      if (String(input).endsWith("/planet"))
        return new Response(
          JSON.stringify({
            tiles: ["https://tiles.openfreemap.org/v/{z}/{x}/{y}.pbf"],
          }),
        );
      active++;
      requests++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) =>
        releases.push(() => {
          active--;
          resolve();
        }),
      );
      return new Response(new Uint8Array(bytes).buffer);
    };
    const source = new RoadSource(
      (p) => ({ x: p.longitude, y: p.latitude, z: 0 }),
      fetcher,
    );
    const keys = Array.from({ length: 20 }, (_, x) => ({ z: 14, x, y: 0 })),
      signal = new AbortController().signal;
    const loading = source.loadTiles(keys, signal);
    for (let batch = 0; batch < 4; batch++) {
      await vi.waitFor(() => expect(releases.length).toBe(4));
      releases.splice(0).forEach((release) => release());
    }
    expect(await loading).toHaveLength(16);
    expect(maximum).toBe(4);
    expect(source.pendingRequests).toBe(0);
    expect(source.cachedTiles).toBe(16);
    expect(source.cachedBytes).toBeLessThan(24 * 1024 * 1024);
    expect(await source.loadTiles(keys, signal)).toHaveLength(16);
    expect(requests).toBe(16);
    source.clear();
    expect(source.cachedTiles).toBe(0);
    expect(source.cachedBytes).toBe(0);
  });
  it("clips provider buffers to shared tile boundaries for seam connections", () => {
    expect(
      clipRoadLine(
        [
          { x: -10, y: 50 },
          { x: 50, y: 50 },
          { x: 110, y: 50 },
        ],
        100,
      ),
    ).toEqual([
      [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ],
    ]);
    expect(
      clipRoadLine(
        [
          { x: -10, y: -10 },
          { x: -20, y: -20 },
        ],
        100,
      ),
    ).toEqual([]);
  });
  it("does not apply transportation limits to unrelated layers", () => {
    const tile = new PbfWriter();
    tile.writeMessage(
      3,
      (_value, layer) => {
        layer.writeStringField(1, "building");
        for (let i = 0; i < 10001; i++)
          layer.writeBytesField(2, new Uint8Array());
      },
      undefined,
    );
    expect(() => validateRoadTileGeometry(tile.finish())).not.toThrow();
  });
  it("rejects command counts before the decoder allocates geometry", () => {
    const geometry = new PbfWriter();
    geometry.writeVarint(100001 * 8 + 1);
    const tile = new PbfWriter();
    tile.writeMessage(
      3,
      (_value, layer) => {
        layer.writeStringField(1, "transportation");
        layer.writeMessage(
          2,
          (_unused, feature) => feature.writeBytesField(4, geometry.finish()),
          undefined,
        );
      },
      undefined,
    );
    expect(() => validateRoadTileGeometry(tile.finish())).toThrow(
      "vertex limit",
    );
  });
  it("does not invoke native fetch with the source object as receiver", async () => {
    vi.stubGlobal("fetch", function (this: unknown) {
      if (this !== undefined && this !== globalThis)
        throw new TypeError("Illegal invocation");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            tiles: ["https://tiles.openfreemap.org/v/{z}/{x}/{y}.pbf"],
          }),
        ),
      );
    });
    try {
      await expect(
        new RoadSource(() => ({ x: 0, y: 0, z: 0 })).loadTiles(
          [],
          new AbortController().signal,
        ),
      ).resolves.toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects restricted access regardless of provider representation", () => {
    for (const access of [false, "no", "private"])
      expect(normalizeRoadProperties({ class: "minor", access })).toBeNull();
    expect(
      normalizeRoadProperties({ class: "minor", oneway: -1 }),
    ).toMatchObject({ oneway: -1 });
    expect(normalizeRoadProperties({ class: "minor" })).toMatchObject({
      oneway: 0,
    });
  });
  it("excludes buried, pedestrian, service and unknown direction geometry", () => {
    for (const properties of [
      { class: "path" },
      { class: "minor", brunnel: "tunnel" },
      { class: "minor", service: "parking_aisle" },
      { class: "primary", oneway: 3 },
      { class: "primary", oneway: null },
      { class: "primary", oneway: true },
      { class: "primary", oneway: "" },
    ]) {
      expect(normalizeRoadProperties(properties)).toBeNull();
    }
  });
  it("prioritizes bounded geographic tiles and wraps the antimeridian", () => {
    const keys = selectCoverageTiles({ longitude: 179.999, latitude: 60 });
    expect(keys.length).toBeLessThanOrEqual(16);
    expect(keys.some((k) => k.x === 0)).toBe(true);
    expect(keys.every((k) => k.x >= 0 && k.x < 16384)).toBe(true);
    expect(selectCoverageTiles({ longitude: 0, latitude: 89 })).toEqual([]);
  });
  it("rejects arbitrary provider hosts and insecure templates", () => {
    expect(() =>
      validateTileTemplate("https://example.com/{z}/{x}/{y}.pbf"),
    ).toThrow();
    expect(() =>
      validateTileTemplate("http://tiles.openfreemap.org/{z}/{x}/{y}.pbf"),
    ).toThrow();
    expect(
      validateTileTemplate(
        "https://tiles.openfreemap.org/planet/v/{z}/{x}/{y}.pbf",
      ),
    ).toContain("{x}");
  });
  it("limits streamed bytes without trusting content length", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.close();
      },
    });
    await expect(readBoundedResponse(new Response(stream), 4)).rejects.toThrow(
      "limit",
    );
  });
});
