/**
 * Approved Cannon art. The previous embedded WebP blob was malformed in the browser, so the
 * production asset is now a self-contained SVG data URI. This keeps it crisp at recruitment-card
 * size and avoids an external file/decode dependency.
 */
function cannonSvg(side: 'blue' | 'red') {
  const main = side === 'red' ? '#e84545' : '#2f7de1';
  const dark = side === 'red' ? '#9f1f2a' : '#184a9b';
  const light = side === 'red' ? '#ff9b9b' : '#8fc2ff';
  const ink = side === 'red' ? '#5f1620' : '#123566';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112">
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M10 75 L25 66 L49 72 L44 88 L11 91 Z" fill="${dark}" stroke="${ink}" stroke-width="3"/>
      <path d="M28 67 Q49 56 66 69 L59 88 Q41 84 26 78 Z" fill="${main}" stroke="${ink}" stroke-width="3"/>
      <path d="M37 65 L42 54 L72 25 Q78 19 86 24 L90 34 L57 69 Z" fill="${main}" stroke="${ink}" stroke-width="3"/>
      <path d="M50 55 L74 31 Q80 25 88 28 L92 38 L60 67 Z" fill="${light}" opacity=".72"/>
      <path d="M72 25 L88 20 Q96 18 100 24 L100 38 L88 44 Z" fill="${main}" stroke="${ink}" stroke-width="3"/>
      <ellipse cx="95" cy="31" rx="9" ry="14" transform="rotate(-18 95 31)" fill="${light}" stroke="${ink}" stroke-width="3"/>
      <ellipse cx="95" cy="31" rx="4.5" ry="8.5" transform="rotate(-18 95 31)" fill="#f7fbff" stroke="${dark}" stroke-width="2"/>
      <circle cx="37" cy="76" r="24" fill="#f7fbff" stroke="${ink}" stroke-width="4"/>
      <circle cx="37" cy="76" r="20" fill="${main}" stroke="${ink}" stroke-width="3"/>
      <circle cx="37" cy="76" r="13" fill="#173b70" stroke="#f7fbff" stroke-width="2.5"/>
      <circle cx="37" cy="76" r="5" fill="#f7fbff"/>
      <path d="M37 61 V68 M37 84 V91 M22 76 H29 M45 76 H52 M26.5 65.5 L31.5 70.5 M42.5 81.5 L47.5 86.5 M47.5 65.5 L42.5 70.5 M31.5 81.5 L26.5 86.5"
        stroke="#f7fbff" stroke-width="2.5"/>
      <path d="M27 47 Q42 41 53 50" fill="none" stroke="${ink}" stroke-width="5"/>
      <path d="M30 47 Q43 43 51 49" fill="none" stroke="${light}" stroke-width="2"/>
    </g>
  </svg>`;
}

function toDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function cannonIconDataUrl(side: 'blue' | 'red') {
  return toDataUrl(cannonSvg(side));
}
