import type { AnchorId, CapturePresetId } from '../types/game';

export interface CapturePreset {
  readonly id: CapturePresetId;
  readonly label: string;
  readonly anchor: AnchorId;
  readonly pos: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly reference: string;
}

export const CAPTURE_PRESET_ORDER: readonly CapturePresetId[] = [
  'title',
  'harbor',
  'jungle',
  'ruins',
  'volcano',
  'lagoon',
  'skull-cave',
];

export const CAPTURE_PRESETS: Record<CapturePresetId, CapturePreset> = {
  title: {
    id: 'title',
    label: 'Title Overview',
    anchor: 'harborSpawn',
    pos: [-10.6, 27.5, 209.6],
    lookAt: [10.0, 14.0, 56.0],
    reference: 'island-overview.png',
  },
  harbor: {
    id: 'harbor',
    label: 'Pirate Harbor',
    anchor: 'harborSpawn',
    pos: [-10.5, 8.2, 141.0],
    lookAt: [3.0, 4.8, 96.0],
    reference: 'pirate-harbor.png',
  },
  jungle: {
    id: 'jungle',
    label: 'Fern Jungle',
    anchor: 'jungleTrail',
    pos: [-101.0, 26.8, 43.0],
    lookAt: [-111.0, 18.0, 8.0],
    reference: 'fern-jungle.png',
  },
  ruins: {
    id: 'ruins',
    label: 'Dino Ruins',
    anchor: 'ruinsTerrace',
    pos: [-75.5, 31.5, -63.0],
    lookAt: [-94.0, 23.0, -88.0],
    reference: 'dino-ruins.png',
  },
  volcano: {
    id: 'volcano',
    label: 'Volcano Ridge',
    anchor: 'volcanoSummit',
    pos: [44.0, 49.0, -32.0],
    lookAt: [89.0, 56.0, -86.0],
    reference: 'volcano-ridge.png',
  },
  lagoon: {
    id: 'lagoon',
    label: 'Waterfall Lagoon',
    anchor: 'lagoonDock',
    pos: [112.0, 10.5, 42.0],
    lookAt: [129.0, 7.5, -2.0],
    reference: 'waterfall-lagoon.png',
  },
  'skull-cave': {
    id: 'skull-cave',
    label: 'Skull Rock Cave',
    anchor: 'skullCaveMouth',
    pos: [79.4, 6.2, 131.5],
    lookAt: [95.5, 4.8, 108.0],
    reference: 'skull-cave.png',
  },
};

export function isCapturePresetId(value: string): value is CapturePresetId {
  return Object.prototype.hasOwnProperty.call(CAPTURE_PRESETS, value);
}
