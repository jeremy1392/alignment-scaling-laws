/* =========================================================
   Align.House: the inside of the house (the "aligned" world).
   The scene is drawn in fixed coordinates (x 0 → 1700,
   y -440 → 600) and scaled with a transform: anything placed
   on it (fly, trap…) uses those coordinates directly. At first
   only the living room is framed; each grow() widens the
   frame and reveals a new room, along with what attracts
   flies there.
   ========================================================= */
(function ($, A) {
  'use strict';

  // Framing per level: living room → + kitchen → + upstairs → + garden
  const VIEWS = [
    { x: 0, y: 0, w: 800, h: 600 },
    { x: 0, y: 0, w: 1160, h: 600 },
    { x: 0, y: -440, w: 1160, h: 1040 },
    { x: 0, y: -440, w: 1700, h: 1040 }
  ];
  // Fly zone per level
  const ZONES = [
    { x1: 40, y1: 50, x2: 760, y2: 500 },
    { x1: 40, y1: 50, x2: 1120, y2: 500 },
    { x1: 40, y1: -400, x2: 1120, y2: 500 },
    { x1: 40, y1: -400, x2: 1660, y2: 520 }
  ];
  // What each new room brings that attracts flies
  const SOURCES = [
    [],
    [{ x: 926, y: 300, name: 'the fridge' }],
    [{ x: 1022, y: -114, name: 'the bathroom trash can' }],
    [{ x: 1342, y: 368, name: 'the garden compost' }]
  ];
  const REVEALS = [
    '',
    'The house grows: you can now see the kitchen fridge.',
    'The house grows: an upstairs appears, with a bedroom and a bathroom.',
    'The house grows: the garden appears, with its compost.'
  ];

  let level = 0;
  const view = { ...VIEWS[0] };
  const FLY_ZONE = { ...ZONES[0] };

  // Bare wall spots where a crack can appear
  // (away from the fly-ribbon slots, see trap.js)
  const WALL_SPOTS = [
    { x: 175, y: 385 },
    { x: 285, y: 380 },
    { x: 370, y: 300 },
    { x: 540, y: 280 },
    { x: 630, y: 300 },
    { x: 685, y: 262 },
    { x: 775, y: 385 },
    { x: 485, y: 62 }
  ];

  // Bare wall areas, per room, where deceptive flies settle and blend in
  const WALLS = [
    [{ x1: 30, y1: 40, x2: 800, y2: 420 }],
    [{ x1: 875, y1: 80, x2: 1120, y2: 240 }],
    [{ x1: 20, y1: -400, x2: 590, y2: -90 }, { x1: 630, y1: -400, x2: 1150, y2: -250 }],
    []
  ];

  const SVG = `
<svg class="house-svg" viewBox="0 -440 1700 1040" width="1700" height="1040" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Inside a house">
  <defs>
    <pattern id="wp" width="48" height="48" patternUnits="userSpaceOnUse">
      <rect width="48" height="48" fill="#f1e0bf"/>
      <rect width="3" height="48" fill="#e9d4ab"/>
      <rect x="24" width="1" height="48" fill="#ecdab6"/>
      <path d="M36 18 l4 6 l-4 6 l-4 -6z" fill="#e3c998"/>
      <circle cx="12" cy="38" r="1.6" fill="#e3c998"/>
    </pattern>
    <linearGradient id="wallShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a3a1a" stop-opacity=".2"/>
      <stop offset=".45" stop-color="#5a3a1a" stop-opacity="0"/>
      <stop offset="1" stop-color="#5a3a1a" stop-opacity=".14"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7cc3ec"/>
      <stop offset="1" stop-color="#d9f0fb"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8f5a39"/>
      <stop offset="1" stop-color="#6a3e27"/>
    </linearGradient>
    <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff1b8" stop-opacity=".6"/>
      <stop offset="1" stop-color="#fff1b8" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#fff4c2" stop-opacity=".95"/>
      <stop offset="1" stop-color="#fff4c2" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="curtain" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a23d2c"/>
      <stop offset=".5" stop-color="#cf5a43"/>
      <stop offset="1" stop-color="#a23d2c"/>
    </linearGradient>
    <pattern id="tiles" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#c9d3d6"/>
      <rect x="1" y="1" width="14" height="14" rx="1" fill="#f3f6f6"/>
    </pattern>
    <pattern id="checker" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#e9e4da"/>
      <rect width="10" height="10" fill="#3f4a52"/>
      <rect x="10" y="10" width="10" height="10" fill="#3f4a52"/>
    </pattern>
    <pattern id="wp2" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#dfe8f1"/>
      <rect width="2" height="40" fill="#d3dfeb"/>
      <circle cx="20" cy="20" r="2" fill="#c7d5e4"/>
    </pattern>
    <linearGradient id="sky2" gradientUnits="userSpaceOnUse" x1="0" y1="-440" x2="0" y2="452">
      <stop offset="0" stop-color="#7cc3ec"/>
      <stop offset="1" stop-color="#e1f3fb"/>
    </linearGradient>
    <linearGradient id="fridge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#d5dde2"/>
      <stop offset=".35" stop-color="#f6f9fa"/>
      <stop offset="1" stop-color="#c9d2d8"/>
    </linearGradient>
  </defs>

  <!-- Living room wall -->
  <rect width="830" height="452" fill="url(#wp)"/>
  <rect width="830" height="452" fill="url(#wallShade)"/>

  <!-- Cornice -->
  <rect width="830" height="22" fill="#fbf3e4"/>
  <rect y="22" width="830" height="3" fill="#dcc59c"/>

  <!-- Window -->
  <rect x="80" y="80" width="220" height="232" rx="4" fill="#fbf3e4" stroke="#dcc59c" stroke-width="2"/>
  <rect x="94" y="94" width="192" height="204" fill="url(#sky)"/>
  <circle cx="245" cy="135" r="16" fill="#fff4c2"/>
  <g fill="#fff" opacity=".9">
    <ellipse cx="135" cy="142" rx="26" ry="9"/>
    <ellipse cx="152" cy="134" rx="16" ry="9"/>
    <ellipse cx="230" cy="176" rx="18" ry="6"/>
  </g>
  <path d="M94 250 Q140 215 190 240 T286 232 V298 H94Z" fill="#8cc58a"/>
  <path d="M94 270 Q150 245 210 268 T286 262 V298 H94Z" fill="#5fa36a"/>
  <rect x="187" y="94" width="6" height="204" fill="#fbf3e4"/>
  <rect x="94" y="193" width="192" height="6" fill="#fbf3e4"/>
  <rect x="68" y="310" width="244" height="12" rx="2" fill="#fbf3e4" stroke="#dcc59c" stroke-width="2"/>
  <!-- Curtains -->
  <rect x="50" y="64" width="280" height="7" rx="3.5" fill="#6b4226"/>
  <path d="M56 70 H108 C104 140 112 220 100 300 C96 320 84 330 70 334 C66 300 60 260 62 200 C64 140 56 100 56 70Z" fill="url(#curtain)"/>
  <path d="M324 70 H272 C276 140 268 220 280 300 C284 320 296 330 310 334 C314 300 320 260 318 200 C316 140 324 100 324 70Z" fill="url(#curtain)"/>
  <rect x="62" y="236" width="42" height="7" rx="3" fill="#e9b07a"/>
  <rect x="276" y="236" width="42" height="7" rx="3" fill="#e9b07a"/>

  <!-- Picture frame -->
  <path d="M600 100 L635 26 L670 100" fill="none" stroke="#8a6a44" stroke-width="1.5"/>
  <circle cx="635" cy="26" r="3" fill="#6b4226"/>
  <rect x="560" y="100" width="150" height="112" rx="3" fill="#6b4226"/>
  <rect x="571" y="111" width="128" height="90" fill="#f6dc9c"/>
  <circle cx="665" cy="137" r="11" fill="#f2a65a"/>
  <path d="M571 201 L610 150 L635 178 L660 155 L699 201Z" fill="#3d6b8c"/>
  <path d="M571 201 L600 175 L625 201Z" fill="#2c5270"/>

  <!-- Lamp light -->
  <path d="M396 186 H484 L640 452 H240Z" fill="url(#cone)" opacity=".5"/>

  <!-- Kitchen, at the back (hidden until the house grows) -->
  <g class="kitchen">
    <!-- Ceiling, side walls and floor in perspective: the room is set back -->
    <path d="M838 25 H1160 L1130 70 H868Z" fill="#efe6d6"/>
    <path d="M838 25 L868 70 V415 L838 452Z" fill="#e2d4ba"/>
    <path d="M1160 25 L1130 70 V415 L1160 452Z" fill="#d6c8ae"/>
    <rect x="868" y="70" width="262" height="345" fill="#dfe9e1"/>
    <rect x="868" y="250" width="262" height="165" fill="url(#tiles)"/>
    <path d="M868 415 H1130 L1160 452 H838Z" fill="url(#checker)"/>
    <!-- Wall cabinet -->
    <rect x="990" y="104" width="130" height="74" rx="3" fill="#6d8a96"/>
    <line x1="1055" y1="108" x2="1055" y2="174" stroke="#56707b" stroke-width="2"/>
    <circle cx="1047" cy="160" r="2.5" fill="#d9e1e6"/>
    <circle cx="1063" cy="160" r="2.5" fill="#d9e1e6"/>
    <!-- Counter -->
    <rect x="985" y="332" width="145" height="83" fill="#6d8a96"/>
    <line x1="1057" y1="338" x2="1057" y2="410" stroke="#56707b" stroke-width="2"/>
    <rect x="1000" y="346" width="44" height="4" rx="2" fill="#d9e1e6"/>
    <rect x="1070" y="346" width="44" height="4" rx="2" fill="#d9e1e6"/>
    <rect x="980" y="324" width="150" height="10" rx="2" fill="#ece5d7"/>
    <path d="M1085 324 V300 Q1085 292 1095 292 H1102 V298" fill="none" stroke="#9aa7b0" stroke-width="4" stroke-linecap="round"/>
    <path d="M998 324 L1001 304 H1023 L1026 324Z" fill="#c8553d"/>
    <rect x="1006" y="298" width="12" height="7" rx="2" fill="#2b2b2b"/>
    <!-- The fridge -->
    <ellipse cx="925" cy="416" rx="48" ry="5" fill="#000" opacity=".15"/>
    <rect x="884" y="200" width="84" height="214" rx="9" fill="url(#fridge)" stroke="#aeb9c0" stroke-width="1.5"/>
    <line x1="886" y1="272" x2="966" y2="272" stroke="#aeb9c0" stroke-width="2"/>
    <rect x="953" y="220" width="6" height="40" rx="3" fill="#8e9ba4"/>
    <rect x="953" y="286" width="6" height="66" rx="3" fill="#8e9ba4"/>
    <rect x="898" y="300" width="20" height="24" fill="#fffbe6" transform="rotate(-6 908 312)"/>
    <circle cx="908" cy="298" r="3.5" fill="#e85d75"/>
    <rect x="926" y="318" width="10" height="10" rx="2" fill="#f2c14e"/>
    <circle cx="932" cy="350" r="4" fill="#3d6b8c"/>
    <rect x="890" y="408" width="72" height="6" rx="2" fill="#9aa7b0"/>
    <!-- Depth: the kitchen is slightly darker -->
    <path d="M838 25 H1160 V452 H838Z" fill="#1a1208" opacity=".08"/>
  </g>
  <!-- Frame of the opening to the kitchen -->
  <rect x="822" y="22" width="16" height="432" fill="#fbf3e4"/>
  <rect x="822" y="22" width="2" height="432" fill="#dcc59c"/>
  <rect x="836" y="22" width="2" height="432" fill="#dcc59c"/>

  <!-- Baseboard -->
  <rect y="436" width="822" height="18" fill="#fbf3e4"/>
  <rect y="436" width="822" height="2" fill="#dcc59c"/>

  <!-- Wooden floor -->
  <rect y="452" width="1160" height="148" fill="url(#floor)"/>
  <g stroke="#000" stroke-opacity=".13" stroke-width="2">
    <line x1="0" y1="482" x2="1160" y2="482"/>
    <line x1="0" y1="518" x2="1160" y2="518"/>
    <line x1="0" y1="558" x2="1160" y2="558"/>
    <line x1="960" y1="454" x2="960" y2="482"/>
    <line x1="860" y1="482" x2="860" y2="518"/>
    <line x1="1100" y1="482" x2="1100" y2="518"/>
    <line x1="1000" y1="518" x2="1000" y2="558"/>
    <line x1="900" y1="558" x2="900" y2="600"/>
    <line x1="140" y1="454" x2="140" y2="482"/>
    <line x1="430" y1="454" x2="430" y2="482"/>
    <line x1="690" y1="454" x2="690" y2="482"/>
    <line x1="60"  y1="482" x2="60"  y2="518"/>
    <line x1="300" y1="482" x2="300" y2="518"/>
    <line x1="580" y1="482" x2="580" y2="518"/>
    <line x1="190" y1="518" x2="190" y2="558"/>
    <line x1="470" y1="518" x2="470" y2="558"/>
    <line x1="740" y1="518" x2="740" y2="558"/>
    <line x1="90"  y1="558" x2="90"  y2="600"/>
    <line x1="360" y1="558" x2="360" y2="600"/>
    <line x1="640" y1="558" x2="640" y2="600"/>
  </g>

  <!-- Rug -->
  <ellipse cx="480" cy="540" rx="250" ry="40" fill="#b85a3e"/>
  <ellipse cx="480" cy="540" rx="222" ry="30" fill="none" stroke="#e9b07a" stroke-width="2" stroke-dasharray="6 6"/>

  <!-- Plant -->
  <ellipse cx="55" cy="472" rx="40" ry="6" fill="#000" opacity=".15"/>
  <g fill="#467d41">
    <path d="M55 405 C36 392 20 380 8 360 C30 362 46 380 55 405Z"/>
    <path d="M55 405 C72 392 92 384 108 372 C92 392 72 402 55 405Z"/>
  </g>
  <g fill="#5f9c58">
    <path d="M55 405 C30 380 18 350 22 320 C40 340 52 370 55 405Z"/>
    <path d="M55 405 C60 370 75 340 98 326 C96 360 80 385 55 405Z"/>
    <path d="M55 405 C48 365 50 330 60 300 C68 335 64 370 55 405Z"/>
  </g>
  <path d="M28 404 H82 L75 470 H35Z" fill="#c8553d"/>
  <rect x="24" y="398" width="62" height="10" rx="2" fill="#d96a50"/>

  <!-- Table -->
  <ellipse cx="500" cy="512" rx="160" ry="12" fill="#000" opacity=".18"/>
  <rect x="380" y="388" width="12" height="122" fill="#6a3f25"/>
  <rect x="608" y="388" width="12" height="122" fill="#6a3f25"/>
  <rect x="372" y="386" width="256" height="14" fill="#74462a"/>
  <rect x="356" y="372" width="288" height="16" rx="3" fill="#8f5a36"/>
  <!-- Vase and flowers -->
  <g stroke="#4f8a4b" stroke-width="2" fill="none">
    <path d="M436 334 C432 312 426 302 420 292"/>
    <path d="M436 334 C438 306 442 296 448 286"/>
    <path d="M436 334 C436 316 434 306 434 298"/>
  </g>
  <circle cx="420" cy="290" r="6" fill="#e85d75"/>
  <circle cx="448" cy="284" r="6" fill="#f2c14e"/>
  <circle cx="434" cy="296" r="5" fill="#f08a5d"/>
  <g fill="#fff3d6"><circle cx="420" cy="290" r="2"/><circle cx="448" cy="284" r="2"/><circle cx="434" cy="296" r="1.6"/></g>
  <path d="M424 372 C412 360 414 342 426 334 H446 C458 342 460 360 448 372Z" fill="#3d6b8c"/>
  <!-- Mug and books -->
  <rect x="556" y="350" width="22" height="22" rx="3" fill="#fbf3e4"/>
  <path d="M578 355 h5 a5 5 0 0 1 0 10 h-5" fill="none" stroke="#fbf3e4" stroke-width="3"/>
  <rect x="596" y="362" width="38" height="10" rx="1" fill="#3d6b8c"/>
  <rect x="600" y="353" width="32" height="9" rx="1" fill="#e2b54a"/>

  <!-- Chair -->
  <ellipse cx="696" cy="514" rx="55" ry="8" fill="#000" opacity=".15"/>
  <rect x="722" y="300" width="12" height="212" rx="3" fill="#6a3f25"/>
  <rect x="714" y="294" width="28" height="10" rx="3" fill="#7a4a2b"/>
  <rect x="654" y="410" width="11" height="102" fill="#6a3f25"/>
  <rect x="650" y="400" width="88" height="12" rx="3" fill="#8f5a36"/>
  <rect x="652" y="391" width="74" height="11" rx="5" fill="#c8553d"/>

  <!-- Pendant lamp -->
  <circle id="lamp-glow" cx="440" cy="192" r="70" fill="url(#glow)" opacity=".75"/>
  <line x1="440" y1="22" x2="440" y2="140" stroke="#2b2b2b" stroke-width="2"/>
  <path d="M418 140 H462 L490 186 H390Z" fill="#2f4858"/>
  <path d="M418 140 H462 L466 147 H414Z" fill="#3e5f73"/>
  <ellipse cx="440" cy="186" rx="50" ry="5" fill="#25394a"/>
  <circle cx="440" cy="190" r="8" fill="#fff6c8"/>

  <!-- ===== Upstairs (revealed by the 2nd expansion) ===== -->
  <g class="upstairs">
    <!-- Walls: bedroom, then bathroom -->
    <rect y="-420" width="600" height="358" fill="url(#wp2)"/>
    <rect y="-420" width="600" height="358" fill="url(#wallShade)"/>
    <rect x="618" y="-420" width="542" height="358" fill="#edf2f0"/>
    <rect x="618" y="-240" width="542" height="178" fill="url(#tiles)"/>
    <!-- Cornice, partition, baseboard, floor, slab -->
    <rect y="-440" width="1160" height="20" fill="#fbf3e4"/>
    <rect y="-420" width="1160" height="3" fill="#dcc59c"/>
    <rect x="600" y="-420" width="18" height="358" fill="#fbf3e4"/>
    <rect x="600" y="-420" width="2" height="358" fill="#dcc59c"/>
    <rect x="616" y="-420" width="2" height="358" fill="#dcc59c"/>
    <rect y="-74" width="1160" height="12" fill="#fbf3e4"/>
    <rect y="-62" width="1160" height="38" fill="url(#floor)"/>
    <rect y="-24" width="1160" height="24" fill="#5e4632"/>
    <rect y="-24" width="1160" height="3" fill="#4a3727"/>
    <!-- Bedroom window -->
    <rect x="230" y="-360" width="150" height="140" rx="4" fill="#fbf3e4" stroke="#dcc59c" stroke-width="2"/>
    <rect x="242" y="-348" width="126" height="116" fill="url(#sky)"/>
    <ellipse cx="282" cy="-310" rx="20" ry="7" fill="#fff" opacity=".9"/>
    <rect x="302" y="-348" width="6" height="116" fill="#fbf3e4"/>
    <!-- Small frame -->
    <rect x="130" y="-335" width="64" height="50" fill="#6b4226"/>
    <rect x="136" y="-329" width="52" height="38" fill="#cfe6f0"/>
    <path d="M136 -291 L156 -312 L170 -300 L188 -318 V-291Z" fill="#5fa36a"/>
    <!-- Pendant light -->
    <line x1="470" y1="-417" x2="470" y2="-370" stroke="#2b2b2b" stroke-width="2"/>
    <path d="M452 -370 H488 L496 -350 H444Z" fill="#c8553d"/>
    <!-- Bed -->
    <ellipse cx="245" cy="-64" rx="165" ry="6" fill="#000" opacity=".15"/>
    <rect x="104" y="-96" width="8" height="30" fill="#6a3f25"/>
    <rect x="378" y="-96" width="8" height="30" fill="#6a3f25"/>
    <rect x="92" y="-250" width="16" height="160" rx="4" fill="#7a4a2b"/>
    <rect x="382" y="-168" width="12" height="78" rx="3" fill="#7a4a2b"/>
    <rect x="104" y="-150" width="282" height="40" rx="6" fill="#f4efe6"/>
    <path d="M178 -158 H386 V-112 H178 Q168 -135 178 -158Z" fill="#6d8fc4"/>
    <ellipse cx="142" cy="-158" rx="32" ry="11" fill="#fff"/>
    <!-- Nightstand and lamp -->
    <rect x="412" y="-140" width="58" height="72" rx="3" fill="#8f5a36"/>
    <line x1="416" y1="-108" x2="466" y2="-108" stroke="#6a3f25" stroke-width="2"/>
    <rect x="438" y="-160" width="6" height="20" fill="#3d3d3d"/>
    <path d="M426 -182 H456 L462 -160 H420Z" fill="#e9b07a"/>
    <!-- Wardrobe -->
    <rect x="500" y="-310" width="88" height="242" rx="3" fill="#8f5a36"/>
    <line x1="544" y1="-304" x2="544" y2="-74" stroke="#6a3f25" stroke-width="2"/>
    <circle cx="538" cy="-190" r="3" fill="#e9b07a"/>
    <circle cx="550" cy="-190" r="3" fill="#e9b07a"/>
    <!-- Bathtub -->
    <line x1="640" y1="-330" x2="900" y2="-330" stroke="#9aa7b0" stroke-width="3"/>
    <path d="M650 -330 H690 V-160 Q672 -170 650 -160Z" fill="#9fd3c7" opacity=".85"/>
    <path d="M648 -150 H900 V-128 Q900 -88 860 -86 H690 Q648 -88 648 -128Z" fill="#f7f9fa" stroke="#c9d3d6" stroke-width="2"/>
    <rect x="668" y="-86" width="10" height="16" rx="3" fill="#c9d3d6"/>
    <rect x="868" y="-86" width="10" height="16" rx="3" fill="#c9d3d6"/>
    <path d="M884 -150 V-170 Q884 -178 876 -178 H868" fill="none" stroke="#9aa7b0" stroke-width="4" stroke-linecap="round"/>
    <!-- Sink and mirror -->
    <rect x="930" y="-292" width="62" height="86" rx="8" fill="#cfe6f0" stroke="#b8c3ca" stroke-width="2"/>
    <rect x="921" y="-172" width="80" height="18" rx="6" fill="#f7f9fa" stroke="#c9d3d6" stroke-width="2"/>
    <rect x="953" y="-156" width="16" height="86" fill="#f7f9fa" stroke="#c9d3d6" stroke-width="2"/>
    <path d="M961 -172 V-184 H970" fill="none" stroke="#9aa7b0" stroke-width="3" stroke-linecap="round"/>
    <!-- Trash can: attracts flies -->
    <rect x="1008" y="-112" width="28" height="42" rx="3" fill="#8e9ba4"/>
    <rect x="1005" y="-118" width="34" height="7" rx="2" fill="#6f7b84"/>
    <!-- Toilet -->
    <rect x="1094" y="-182" width="26" height="56" rx="4" fill="#f7f9fa" stroke="#c9d3d6" stroke-width="2"/>
    <path d="M1052 -126 H1120 V-112 Q1114 -92 1090 -90 H1084 V-70 H1066 V-92 Q1052 -100 1052 -126Z" fill="#f7f9fa" stroke="#c9d3d6" stroke-width="2"/>
    <!-- Ceiling light -->
    <path d="M845 -417 Q860 -394 875 -417Z" fill="#fff6c8"/>
  </g>

  <!-- ===== Garden (revealed by the 3rd expansion) ===== -->
  <g class="garden">
    <rect x="1186" y="-440" width="514" height="900" fill="url(#sky2)"/>
    <circle cx="1610" cy="-330" r="38" fill="#fff4c2"/>
    <g fill="#fff" opacity=".9">
      <ellipse cx="1330" cy="-280" rx="44" ry="13"/>
      <ellipse cx="1360" cy="-292" rx="26" ry="13"/>
      <ellipse cx="1500" cy="-150" rx="34" ry="10"/>
    </g>
    <!-- Tree -->
    <rect x="1560" y="150" width="26" height="310" fill="#7a4a2b"/>
    <g fill="#5f9c58">
      <circle cx="1573" cy="120" r="95"/>
      <circle cx="1500" cy="170" r="62"/>
      <circle cx="1645" cy="165" r="62"/>
    </g>
    <circle cx="1573" cy="40" r="60" fill="#6aa84f"/>
    <!-- Fence -->
    <rect x="1186" y="402" width="514" height="6" fill="#efe4d0"/>
    <rect x="1186" y="430" width="514" height="6" fill="#efe4d0"/>
    ${Array.from({ length: 20 }, (_, i) => `<rect x="${1196 + i * 26}" y="388" width="12" height="64" rx="3" fill="#fbf3e4"/>`).join('')}
    <!-- Lawn -->
    <rect x="1186" y="452" width="514" height="148" fill="#7cb35b"/>
    <g fill="#74aa53">
      <rect x="1186" y="482" width="514" height="18"/>
      <rect x="1186" y="530" width="514" height="18"/>
      <rect x="1186" y="578" width="514" height="18"/>
    </g>
    <!-- Compost: attracts flies -->
    <ellipse cx="1342" cy="462" rx="52" ry="6" fill="#000" opacity=".15"/>
    <rect x="1298" y="372" width="88" height="88" rx="4" fill="#4f6b3a"/>
    <g stroke="#3e5530" stroke-width="3">
      <line x1="1298" y1="394" x2="1386" y2="394"/>
      <line x1="1298" y1="416" x2="1386" y2="416"/>
      <line x1="1298" y1="438" x2="1386" y2="438"/>
    </g>
    <rect x="1292" y="364" width="100" height="10" rx="3" fill="#3e5530"/>
    <!-- Bins -->
    <rect x="1412" y="398" width="40" height="60" rx="4" fill="#5b6670"/>
    <rect x="1408" y="390" width="48" height="9" rx="3" fill="#47515a"/>
    <!-- Outer wall of the house -->
    <rect x="1160" y="-440" width="26" height="1040" fill="#d6c09c"/>
    <rect x="1182" y="-440" width="4" height="1040" fill="#bfa77f"/>
  </g>
</svg>`;

  const CRACK_SVG = `
<svg viewBox="-45 -45 90 90" width="90" height="90" aria-hidden="true">
  <g fill="none" stroke="#5b4630" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0 0 L6 -10 L2 -18 L9 -30"/>
    <path d="M6 -10 L17 -8 L24 -14"/>
    <path d="M0 0 L-9 6 L-12 17 L-20 22"/>
    <path d="M-9 6 L-19 3 L-27 6"/>
    <path d="M0 0 L7 9 L16 12 L22 21"/>
    <path d="M0 0 L-6 -7 L-14 -9"/>
  </g>
  <ellipse cx="0" cy="0" rx="5" ry="4" fill="#2b2118"/>
</svg>`;

  let $host, $fit, $stage;

  function build($el) {
    $host = $el;
    $fit = $('<div class="house-fit"></div>').appendTo($host);
    $stage = $('<div class="house-stage"></div>').append(SVG, '<div class="uv-light"></div>').appendTo($fit);
    new ResizeObserver(fit).observe($host[0]);
    fit();
  }

  // Scale the framed part of the scene to its container
  function fit() {
    const el = $host[0];
    const cs = getComputedStyle(el);
    const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const k = Math.max(.05, Math.min(w / view.w, h / view.h));
    $fit.css({ width: view.w * k, height: view.h * k });
    $stage.css('transform', `scale(${k}) translate(${-view.x}px, ${-view.y}px)`);
  }

  // The house grows: the frame pulls back and reveals the next room.
  // Resolves with the sentence describing what appeared.
  function grow() {
    if (level >= VIEWS.length - 1) return $.Deferred().resolve('').promise();
    level++;
    const from = { ...view }, to = VIEWS[level];
    return A.tween(0, 1, A.T(2600), 'easeInOutCubic', t => {
      ['x', 'y', 'w', 'h'].forEach(k => { view[k] = A.lerp(from[k], to[k], t); });
      fit();
    }).then(() => {
      Object.assign(FLY_ZONE, ZONES[level]);
      return REVEALS[level];
    });
  }

  // Everything that attracts flies in the visible rooms
  function sources() {
    return SOURCES.slice(0, level + 1).flat();
  }

  // A source "activates": a ripple spreads from it
  function pulseAt(x, y) {
    const $p = $('<div class="source-pulse"></div>').css({ left: x, top: y }).appendTo($stage);
    setTimeout(() => $p.remove(), A.T(2400));
  }

  // The house loses its colors as the model loses capacity (c: 0 → 1)
  function vitality(c) {
    $stage.find('.house-svg').css('filter', `saturate(${(.25 + .75 * c).toFixed(3)}) brightness(${(.68 + .32 * c).toFixed(3)})`);
  }

  // A random point on a bare wall of a visible room
  function wallPoint() {
    const rects = WALLS.slice(0, level + 1).flat();
    const r = rects[A.randInt(0, rects.length - 1)];
    return { x: A.rand(r.x1, r.x2), y: A.rand(r.y1, r.y2) };
  }

  // UV lamp: the room goes dark, deceptive flies glow
  function uv(on) {
    $stage.toggleClass('uv', on);
  }

  // n distinct spots, picked at random
  function randomWallSpots(n) {
    const pool = WALL_SPOTS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = A.randInt(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  // A crack appears in the wall. Resolves with the crack element.
  function crackAt(x, y) {
    const $c = $(`<div class="crack">${CRACK_SVG}</div>`)
      .css({ left: x, top: y, opacity: 0 })
      .appendTo($stage);
    $c.animate({ opacity: 1 }, A.T(600));
    return A.tween(.2, 1, A.T(900), 'easeOutBack', s => $c.css('transform', `scale(${s})`))
      .then(() => $c);
  }

  // The wall closes behind the fly
  function closeCrack($c) {
    $c.delay(A.T(800)).fadeOut(A.T(2500), () => $c.remove());
  }

  // The lamp flickers for a moment
  function flicker() {
    const glow = $stage.find('#lamp-glow')[0];
    glow.classList.remove('flicker');
    void glow.getBoundingClientRect();
    glow.classList.add('flicker');
  }

  A.House = {
    flyZone: FLY_ZONE,
    lamp: { x: 440, y: 200 },      // the pendant lamp of the first room (moths circle it)
    build,
    stage: () => $stage,
    randomWallSpots,
    crackAt,
    closeCrack,
    flicker,
    grow,
    sources,
    wallPoint,
    uv,
    pulseAt,
    vitality,
    level: () => level
  };
})(jQuery, window.Align);
