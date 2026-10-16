import type { Side } from '@arena-kingdom/shared';
import { ATLAS_COLORS } from './atlasStyle';
import type { MapStyle } from './displaySettings';

const parse = (hex: string) => Number.parseInt(hex.slice(1), 16);

/** Fixed, colorblind-supporting vocabulary for the historical battle plate. */
export const CAMPAIGN_INK = {
  paper: ATLAS_COLORS.paper,
  paperLight: ATLAS_COLORS.paperLight,
  ocean: ATLAS_COLORS.sea,
  coastline: ATLAS_COLORS.seaLine,
  mountains: ATLAS_COLORS.mountain,
  ink: ATLAS_COLORS.ink,
  blue: ATLAS_COLORS.blue,
  red: ATLAS_COLORS.red,
  border: ATLAS_COLORS.inkSoft,
  selection: ATLAS_COLORS.selection
} as const;

export function campaignSideColor(side: Side): string {
  return side === 'blue' ? CAMPAIGN_INK.blue : CAMPAIGN_INK.red;
}
export function campaignSideColorNumber(side: Side): number {
  return parse(campaignSideColor(side));
}
export function campaignOverlayTheme(style: MapStyle) {
  return {
    atlas: style === 'atlas',
    paper: style === 'atlas' ? parse(CAMPAIGN_INK.paperLight) : 0xf3e8c8,
    ink: style === 'atlas' ? parse(CAMPAIGN_INK.ink) : 0x2b1d0e
  };
}

/** Only visible unit/building state is ever passed to the minimap. */
export function campaignMinimapPalette(style: MapStyle) {
  return style === 'atlas'
    ? { sea: CAMPAIGN_INK.ocean, land: CAMPAIGN_INK.paper, own: '#dad6b5',
        enemy: '#e8c7b5', ridge: CAMPAIGN_INK.mountains,
        ink: CAMPAIGN_INK.ink, blue: CAMPAIGN_INK.blue, red: CAMPAIGN_INK.red,
        camera: '#9d6c33' }
    : { sea: '#17343d', land: '#365044', own: '#436253',
        enemy: '#365044', ridge: '#69716c',
        ink: '#17343d', blue: '#69b9ff', red: '#ff7a82',
        camera: '#ffe7a3' };
}

/** SVG swatch sheet from the actual palette used by runtime HUD and minimap. */
export function campaignKeySvg(): string {
  const rows: ReadonlyArray<[string, string, boolean]> = [
    ['Advance / MOVE', CAMPAIGN_INK.blue, false],
    ['Attack / ASSAULT', CAMPAIGN_INK.red, true],
    ['Front line / INFLUENCE', CAMPAIGN_INK.border, false]
  ];
  const strokes = rows.map(([label, color, attack], index) => {
    const y = 166 + index * 97;
    const path = 'M52 ' + (y + 18) + 'Q180 ' + (y - 29) + ' 314 ' + (y + 17);
    return '<g>'
      + '<path d="' + path + '" fill="none" stroke="' + CAMPAIGN_INK.paperLight
      + '" stroke-width="' + (attack ? 17 : 12) + '"/>'
      + '<path d="' + path + '" fill="none" stroke="' + CAMPAIGN_INK.ink + '" stroke-width="' + (attack ? 8 : 5) + '"/>'
      + '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="' + (attack ? 5 : 2.8)
      + '" ' + (attack ? '' : 'stroke-dasharray="12 8"') + '/>'
      + '<path d="M314 ' + (y + 17) + 'l-22-20 5 14-17 9Z" fill="' + color + '" stroke="' + CAMPAIGN_INK.ink + '" stroke-width="2"/>'
      + '<text x="345" y="' + (y + 22) + '" fill="' + CAMPAIGN_INK.ink + '" font-family="Georgia,serif" font-size="19">' + label + '</text>'
      + '</g>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="780" height="510" viewBox="0 0 780 510">'
  + '<rect width="780" height="510" fill="' + CAMPAIGN_INK.paper + '"/>'
  + '<rect x="15" y="15" width="750" height="480" fill="none" stroke="' + CAMPAIGN_INK.border + '" stroke-width="5"/>'
  + '<text x="390" y="75" text-anchor="middle" fill="' + CAMPAIGN_INK.ink + '" font-family="Georgia,serif" font-size="29">CAMPAIGN ORDERS</text>'
  + '<text x="390" y="110" text-anchor="middle" fill="' + CAMPAIGN_INK.border + '" font-family="Georgia,serif" font-size="14">TACTICAL INK AND SIGN CONVENTIONS</text>'
  + strokes
  + '<text x="390" y="474" text-anchor="middle" fill="' + CAMPAIGN_INK.border + '" font-family="Georgia,serif" font-size="12">Visual conventions only; arrows indicate issued orders, not pathfinder routes.</text>'
  + '</svg>';
}
