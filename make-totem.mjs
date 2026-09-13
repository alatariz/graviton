// make-totem.mjs
import fs from 'fs';

const totemSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" fill="none">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#34d399"/>
      <stop offset="80%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>

  <!-- Cybernetic Totem Mask for GRAVITON -->
  <g stroke="url(#neonGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
    <!-- Horns / Gravitational Flux Wings -->
    <path d="M 40 45 C 20 30 15 10 30 2 C 34 20 48 32 55 42" />
    <path d="M 120 45 C 140 30 145 10 130 2 C 126 20 112 32 105 42" />

    <!-- Crown Crest & Singularity Apex -->
    <polygon points="80,12 87,28 80,34 73,28" fill="rgba(16,185,129,0.2)" />
    <line x1="80" y1="2" x2="80" y2="12" stroke-width="1.5" />
    <circle cx="80" cy="2" r="2" fill="#fff" />

    <!-- Helmet Crown Arch -->
    <path d="M 48 40 L 73 28 L 87 28 L 112 40 L 125 65 L 115 85 L 128 115 L 110 135 L 80 150 L 50 135 L 32 115 L 45 85 L 35 65 Z" fill="rgba(6,10,18,0.7)" />

    <!-- Forehead Circuit Lines -->
    <path d="M 60 48 L 72 48 L 76 60 L 84 60 L 88 48 L 100 48" />
    <line x1="80" y1="36" x2="80" y2="58" />

    <!-- Visor / Eye Slits (Luminous Horizon) -->
    <polygon points="52,72 74,72 70,78 54,78" fill="#34d399" />
    <polygon points="108,72 86,72 90,78 106,78" fill="#34d399" />
    
    <!-- Central Eye / Singularity Lens -->
    <circle cx="80" cy="75" r="4" fill="#ffffff" stroke="#10b981" stroke-width="1.5" />

    <!-- Nose Bridge & Midface Armor Plates -->
    <path d="M 76 80 L 72 98 L 80 106 L 88 98 L 84 80" />
    <line x1="80" y1="84" x2="80" y2="105" stroke-dasharray="2 2" />

    <!-- Cheek Circuit Traces -->
    <path d="M 48 88 L 64 88 L 68 102" />
    <path d="M 112 88 L 96 88 L 92 102" />
    <path d="M 42 106 L 58 106 L 65 118" />
    <path d="M 118 106 L 102 106 L 95 118" />

    <!-- Mouth Grid / Synthesizer Vocoder -->
    <line x1="72" y1="114" x2="88" y2="114" stroke-width="2.5" />
    <line x1="74" y1="120" x2="86" y2="120" stroke-width="2" />
    <line x1="76" y1="126" x2="84" y2="126" stroke-width="1.5" />

    <!-- Chin Lattice / Quantum DNA Helix Nodes -->
    <path d="M 70 134 C 74 140 86 140 90 146 C 86 152 74 152 70 158 C 74 164 86 164 90 170 C 86 176 74 176 80 184" fill="none" stroke-width="1.8" />
    <path d="M 90 134 C 86 140 74 140 70 146 C 74 152 86 152 90 158 C 86 164 74 164 70 170 C 74 176 86 176 80 184" fill="none" stroke-width="1.8" />

    <!-- DNA Connecting Rungs -->
    <line x1="73" y1="140" x2="87" y2="140" stroke-width="1.2" />
    <line x1="73" y1="152" x2="87" y2="152" stroke-width="1.2" />
    <line x1="73" y1="164" x2="87" y2="164" stroke-width="1.2" />
    <line x1="76" y1="176" x2="84" y2="176" stroke-width="1.2" />

    <!-- Bottom Pendulum Node -->
    <circle cx="80" cy="188" r="3" fill="#34d399" stroke="#fff" stroke-width="1" />
  </g>
</svg>`;

fs.writeFileSync('public/icon.svg', totemSvg, 'utf8');
console.log('High-end Graviton cybernetic totem generated at public/icon.svg');
