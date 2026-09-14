import type { Side } from '@arena-kingdom/shared';

const INK = '#263238';
const TEAM = {
  blue: { roof: '#2f72c4', darkRoof: '#1f4f8b', banner: '#2c6fd0' },
  red: { roof: '#b84d4d', darkRoof: '#7f3030', banner: '#b54040' }
} as const;

const house = (x: number, y: number, w: number, h: number, wall: string, roof: string, door: string) => `
  <g stroke="${INK}" stroke-width="1.8" stroke-linejoin="round">
    <rect x="${x + w * 0.12}" y="${y + h * 0.38}" width="${w * 0.76}" height="${h * 0.62}" rx="2" fill="${wall}"/>
    <path d="M${x} ${y + h * 0.42} L${x + w / 2} ${y} L${x + w} ${y + h * 0.42} Z" fill="${roof}"/>
    <path d="M${x + w * 0.12} ${y + h * 0.38} L${x + w * 0.88} ${y + h * 0.38}" stroke="#f1dfb5" stroke-width="1.4" opacity=".8"/>
    <rect x="${x + w * 0.42}" y="${y + h * 0.67}" width="${w * 0.16}" height="${h * 0.33}" fill="${door}"/>
    <rect x="${x + w * 0.22}" y="${y + h * 0.52}" width="${w * 0.18}" height="${h * 0.16}" fill="#a9d4e8"/>
  </g>`;

export function villageArt(side: Side) {
  const t = TEAM[side];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 74">
    <defs>
      <filter id="shadow-${side}" x="-30%" y="-30%" width="160%" height="170%">
        <feGaussianBlur stdDeviation="2.2"/>
      </filter>
    </defs>
    <ellipse cx="48" cy="67" rx="39" ry="5.5" fill="#173b35" opacity=".24" filter="url(#shadow-${side})"/>
    ${house(4, 20, 32, 36, '#d9c39b', t.roof, '#704d38')}
    ${house(58, 17, 34, 39, '#ead8b2', t.darkRoof, '#5c4432')}
    <path d="M81 17 V5" stroke="#4b5563" stroke-width="1.8"/>
    <path d="M82 6 H94 L91 9 L94 12 H82 Z" fill="${t.banner}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M28 56 C36 49 45 49 53 56" fill="none" stroke="#9b7a4f" stroke-width="2" opacity=".8"/>
    <circle cx="49" cy="61" r="2.4" fill="#8dbb54"/>
    <circle cx="54" cy="59" r="1.8" fill="#b7ce76"/>
  </svg>`;
}
