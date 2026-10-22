import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('packages an original self-contained swallow with both wings in its fly clip', () => {
  const bytes = readFileSync(new URL('../../../public/models/birds/swallow.glb', import.meta.url));
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.length).toBeLessThan(100000);
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
    asset: { copyright: string }; buffers: { uri?: string }[]; images?: unknown[];
    animations: { name: string; channels: { target: { node: number; path: string } }[] }[];
    nodes: { name: string }[];
  };
  expect(document.asset.copyright).toContain('CC0-1.0');
  expect(document.buffers.every(buffer => !buffer.uri)).toBe(true);
  expect(document.images ?? []).toHaveLength(0);
  const fly = document.animations.find(clip => clip.name === 'fly')!;
  expect(fly.channels.map(channel => [document.nodes[channel.target.node]!.name, channel.target.path]).sort())
    .toEqual([['LeftWing', 'rotation'], ['RightWing', 'rotation']]);
});
