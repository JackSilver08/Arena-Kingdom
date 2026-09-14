/**
 * Arena Kingdom v2 battlefield: two equal 2D flat islands.
 * Rendering only. Gameplay geometry lives in shared/rules.ts.
 */
const svg=(viewBox:string,body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

export function arenaMapArtV2() {
  const left='M125 270C125 205 185 160 270 166C335 172 365 125 445 148C515 168 585 132 650 175C710 215 785 205 825 268C858 320 846 380 870 430L870 470L910 470L910 610L870 610L870 650C845 710 858 775 816 822C765 880 696 866 645 902C575 948 500 900 435 918C360 938 315 900 250 905C172 910 125 850 138 780C148 720 102 690 128 620C154 550 112 500 130 435C148 372 125 330 125 270Z';
  const right='M1795 270C1795 205 1735 160 1650 166C1585 172 1555 125 1475 148C1405 168 1335 132 1270 175C1210 215 1135 205 1095 268C1062 320 1074 380 1050 430L1050 470L1010 470L1010 610L1050 610L1050 650C1075 710 1062 775 1104 822C1155 880 1224 866 1275 902C1345 948 1420 900 1485 918C1560 938 1605 900 1670 905C1748 910 1795 850 1782 780C1772 720 1818 690 1792 620C1766 550 1808 500 1790 435C1772 372 1795 330 1795 270Z';
  const beach=(d:string)=>d;
  return svg('0 0 1920 1080',`
    <defs>
      <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#073c5d"/><stop offset=".5" stop-color="#07567a"/><stop offset="1" stop-color="#042f4d"/></linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#77b95b"/><stop offset="1" stop-color="#4f963f"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
      <pattern id="specks" width="70" height="70" patternUnits="userSpaceOnUse"><circle cx="12" cy="16" r="1.4" fill="#3c813b" opacity=".35"/><circle cx="47" cy="39" r="1.2" fill="#b9d97c" opacity=".3"/><path d="M28 60l2-5 2 5" stroke="#8fc66a" stroke-width="1.5" opacity=".35"/></pattern>
    </defs>
    <rect width="1920" height="1080" fill="url(#ocean)"/>
    <g fill="none" stroke="#62b6c6" stroke-width="4" stroke-linecap="round" opacity=".28">
      <path d="M90 180c70-30 125-20 190 7s120 25 180-5"/><path d="M1460 190c70-26 130-20 190 5s105 24 170-2"/>
      <path d="M120 850c65-25 120-20 175 5s110 22 170-4"/><path d="M1450 850c70-27 130-20 190 6s110 22 180-3"/>
    </g>
    <path d="${left}" fill="#001f2e" opacity=".45" filter="url(#shadow)" transform="translate(0 22)"/>
    <path d="${right}" fill="#001f2e" opacity=".45" filter="url(#shadow)" transform="translate(0 22)"/>
    <path d="${left}" fill="#f2d58b" stroke="#e7bd63" stroke-width="16" stroke-linejoin="round"/>
    <path d="${right}" fill="#f2d58b" stroke="#e7bd63" stroke-width="16" stroke-linejoin="round"/>
    <path d="${left}" fill="none" stroke="#fff0b8" stroke-width="5" stroke-linejoin="round" opacity=".9"/>
    <path d="${right}" fill="none" stroke="#fff0b8" stroke-width="5" stroke-linejoin="round" opacity=".9"/>
    <path d="M160 285C160 230 208 195 280 200C345 205 378 165 450 183C520 201 585 170 642 210C700 250 755 240 790 295C818 338 802 390 830 438L830 642C800 690 818 748 785 795C738 850 682 832 630 870C570 912 505 865 440 883C370 902 322 865 260 870C202 875 162 830 176 770C190 710 148 680 170 620C192 560 150 510 172 450C194 390 160 345 160 285Z" fill="url(#grass)"/>
    <path d="M1760 285C1760 230 1712 195 1640 200C1575 205 1542 165 1470 183C1400 201 1335 170 1278 210C1220 250 1165 240 1130 295C1102 338 1118 390 1090 438L1090 642C1120 690 1102 748 1135 795C1182 850 1238 832 1290 870C1350 912 1415 865 1480 883C1550 902 1598 865 1660 870C1718 875 1758 830 1744 770C1730 710 1772 680 1750 620C1728 560 1770 510 1748 450C1726 390 1760 345 1760 285Z" fill="url(#grass)"/>
    <path d="M160 280H830V870H160Z" fill="url(#specks)" opacity=".65" clip-path="url(#clipL)"/>
    <g>
      <rect x="842" y="400" width="236" height="86" rx="7" fill="#aeb5b7" stroke="#58666b" stroke-width="7"/><path d="M860 420h200M860 445h200M860 470h200" stroke="#d8dddc" stroke-width="4" opacity=".65"/>
      <rect x="842" y="594" width="236" height="86" rx="7" fill="#aeb5b7" stroke="#58666b" stroke-width="7"/><path d="M860 614h200M860 639h200M860 664h200" stroke="#d8dddc" stroke-width="4" opacity=".65"/>
      <g fill="#d9dfdf" stroke="#59666a" stroke-width="5"><rect x="830" y="390" width="24" height="106" rx="6"/><rect x="1066" y="390" width="24" height="106" rx="6"/><rect x="830" y="584" width="24" height="106" rx="6"/><rect x="1066" y="584" width="24" height="106" rx="6"/></g>
    </g>
    <g fill="none" stroke="#b9e6e8" stroke-width="7" opacity=".38" stroke-linecap="round"><path d="M825 500c40-18 70-18 110 0M985 500c40-18 70-18 110 0M825 580c40 18 70 18 110 0M985 580c40 18 70 18 110 0"/></g>
  `);
}