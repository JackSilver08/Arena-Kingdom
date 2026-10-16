import { MOUNTAIN_RIDGES } from '@arena-kingdom/shared';
import { ATLAS_COLORS as C } from './atlasStyle';

// The ellipse is the EXACT unwalkable footprint. Ink outside it is forbidden.
export function engravedRidgesArt() {
  return MOUNTAIN_RIDGES.map(({cx,cy,rx,ry},index)=>{
    const peaks=Array.from({length:9},(_,j)=>{
      const x=-rx*.91+j*(rx*1.82/8);
      const width=rx*(.25 + (j%3)*.035);
      const height=ry*(1.05+(j%4)*.17);
      const summit=x+width*.47;
      const base=ry*.72+(j%2)*2;
      const left=x-width*.45;
      const right=x+width;
      const top=-height*.78;
      const hatch=Array.from({length:4},(_,k)=>{
        const yy=top+height*(.42+k*.115);
        const xx=summit+width*(.11+k*.10);
        return `<path d="M${xx.toFixed(1)} ${yy.toFixed(1)}l${(width*.10).toFixed(1)} ${(height*.12).toFixed(1)}" stroke="${C.mountainInk}" stroke-width="1.5" fill="none" opacity=".78"/>`;
      }).join('');
      return `<g>
        <path d="M${left.toFixed(1)} ${base.toFixed(1)}L${summit.toFixed(1)} ${top.toFixed(1)}L${right.toFixed(1)} ${base.toFixed(1)}Z" fill="${j%2?'#bbb09e':'#d4c8b3'}" stroke="${C.mountainInk}" stroke-width="2.1"/>
        <path d="M${summit.toFixed(1)} ${top.toFixed(1)}L${right.toFixed(1)} ${base.toFixed(1)}L${summit.toFixed(1)} ${(base*.75).toFixed(1)}Z" fill="${C.mountain}" opacity=".72"/>
        <path d="M${summit.toFixed(1)} ${top.toFixed(1)}l${(-width*.17).toFixed(1)} ${(height*.33).toFixed(1)}l${(width*.2).toFixed(1)} ${(-height*.1).toFixed(1)}" fill="none" stroke="#f0e7d1" stroke-width="2" opacity=".85"/>
        ${hatch}
      </g>`;
    }).join('');
    const contour=Array.from({length:5},(_,j)=>{
      const y=-ry*.7+j*ry*.34;
      return `<path d="M${(-rx*.94).toFixed(1)} ${y.toFixed(1)}q${(rx*.48).toFixed(1)} -${(ry*.24).toFixed(1)} ${(rx*.92).toFixed(1)} 0t${(rx*.92).toFixed(1)} 0" fill="none" stroke="${C.mountainInk}" stroke-width="1.15" stroke-dasharray="4 6" opacity=".33"/>`;
    }).join('');
    return `<g data-blocked-ridge="${index}" data-footprint="${cx},${cy},${rx},${ry}" data-engraving="mountain" transform="translate(${cx} ${cy})">
      <defs><clipPath id="atlas-mountain-clip-${index}"><ellipse rx="${rx}" ry="${ry}"/></clipPath></defs>
      <ellipse rx="${rx}" ry="${ry}" fill="#d3c6af" stroke="${C.mountainInk}" stroke-width="2"/>
      <g clip-path="url(#atlas-mountain-clip-${index})">
        <ellipse cy="${(ry*.45).toFixed(1)}" rx="${rx}" ry="${ry}" fill="#a79a87" opacity=".34"/>
        ${contour}${peaks}
        <path d="M${-rx} ${ry*.61}Q0 ${ry*.28} ${rx} ${ry*.61}" fill="none" stroke="#756955" stroke-width="2.2"/>
      </g>
    </g>`;
  }).join('');
}
