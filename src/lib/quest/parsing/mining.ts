import { toTrimmedLines } from './pasteParsing';

export class MiningParseError extends Error {}

const FLOOR_LINE = /^Floor\s+(\d+)$/i;

/** Map canonical in-game names to our internal camelCase keys */
const MINING_LOCATION_MAP: Record<string, string> = {
  'spring cave': 'springCave',
  'highland hollow': 'highlandHollow',
  'sol grotto': 'solGrotto',
  'ember caverns': 'emberCaverns',
  "fenrir's den": 'fenrirsDen',
  'mossrock mine': 'mossrockMine',
};

/**
 * Parses raw copy-pasted "Mining" page text into floor progress records.
 */
export function parseMiningPagePaste(rawText: string): Record<string, number> {
  const lines = toTrimmedLines(rawText);

  // Locate the start anchor
  const locationsAnchorIdx = lines.findIndex(
    (l) => l.toLowerCase() === 'mining locations'
  );

  if (locationsAnchorIdx === -1) {
    throw new MiningParseError(
      'Could not find "Mining Locations" in pasted text — make sure you copied the full Mining page.'
    );
  }

  const floors: Record<string, number> = {
    springCave: 0,
    highlandHollow: 0,
    solGrotto: 0,
    emberCaverns: 0,
    fenrirsDen: 0,
    mossrockMine: 0,
  };

  // Scan downward from "Mining Locations"
  for (let i = locationsAnchorIdx; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    const mappedKey = MINING_LOCATION_MAP[lineLower];

    if (mappedKey) {
      // Look forward up to 6 lines for the matching "Floor N" line
      for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
        const match = FLOOR_LINE.exec(lines[j]);
        if (match) {
          floors[mappedKey] = parseInt(match[1], 10);
          break;
        }
      }
    }
  }

  return floors;
}