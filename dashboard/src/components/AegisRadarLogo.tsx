import React from 'react';

interface AegisRadarLogoProps {
  className?: string;
  size?: number;
}

export default function AegisRadarLogo({ className = '', size = 36 }: AegisRadarLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]"
      >
        <defs>
          {/* Radar Sweep Gradient */}
          <linearGradient id="radarSweep" x1="50" y1="50" x2="85" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#15803d" stopOpacity="0" />
          </linearGradient>

          {/* Glowing Green Core Radial */}
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="1" />
            <stop offset="50%" stopColor="#22c55e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#052e16" stopOpacity="0.1" />
          </radialGradient>

          {/* Outer Shield Glow */}
          <linearGradient id="shieldRing" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* 1. Dark Transparent Base Circle */}
        <circle cx="50" cy="50" r="48" fill="#010501" fillOpacity="0.9" stroke="url(#shieldRing)" strokeWidth="2.5" />

        {/* 2. Outer Aegis Shield Interlocking Arcs */}
        <path
          d="M50 4 A46 46 0 0 1 96 50 A46 46 0 0 1 50 96 A46 46 0 0 1 4 50 A46 46 0 0 1 50 4"
          stroke="#4ade80"
          strokeWidth="1.2"
          strokeDasharray="18 6"
          strokeLinecap="round"
        />

        {/* 3. Top Aegis Crown Arcs */}
        <path
          d="M26 30 C34 18, 66 18, 74 30 C66 38, 34 38, 26 30 Z"
          stroke="#22c55e"
          strokeWidth="1.2"
          fill="#052e16"
          fillOpacity="0.4"
        />
        <path
          d="M34 22 C42 16, 58 16, 66 22"
          stroke="#86efac"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* 4. Concentric Radar Range Rings */}
        <circle cx="50" cy="50" r="36" stroke="#22c55e" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
        <circle cx="50" cy="50" r="26" stroke="#4ade80" strokeWidth="1.2" opacity="0.8" />
        <circle cx="50" cy="50" r="16" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2" opacity="0.9" />
        <circle cx="50" cy="50" r="8" stroke="#86efac" strokeWidth="1.2" opacity="0.9" />

        {/* 5. Radar Crosshair Grids */}
        <line x1="50" y1="14" x2="50" y2="86" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
        <line x1="14" y1="50" x2="86" y2="50" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
        <line x1="24" y1="24" x2="76" y2="76" stroke="#15803d" strokeWidth="0.6" opacity="0.4" />
        <line x1="24" y1="76" x2="76" y2="24" stroke="#15803d" strokeWidth="0.6" opacity="0.4" />

        {/* 6. Active Sweeping Radar Wedge Beam */}
        <path
          d="M50 50 L84 20 A46 46 0 0 0 66 8 Z"
          fill="url(#radarSweep)"
        />

        {/* 7. Radar Beam Pointer Line */}
        <line
          x1="50"
          y1="50"
          x2="85"
          y2="19"
          stroke="#a3e635"
          strokeWidth="2"
          strokeLinecap="round"
          filter="drop-shadow(0 0 4px #a3e635)"
        />

        {/* 8. Target Contact Blips */}
        <circle cx="72" cy="34" r="2" fill="#a3e635" className="animate-ping" />
        <circle cx="72" cy="34" r="1.5" fill="#ffffff" />
        <circle cx="36" cy="62" r="1.5" fill="#4ade80" opacity="0.8" />
        <circle cx="64" cy="68" r="1.2" fill="#22c55e" opacity="0.7" />

        {/* 9. Glowing Center Origin Point */}
        <circle cx="50" cy="50" r="4" fill="url(#coreGlow)" />
        <circle cx="50" cy="50" r="1.5" fill="#ffffff" />
      </svg>
    </div>
  );
}
