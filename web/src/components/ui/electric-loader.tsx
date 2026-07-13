'use client';

export default function ElectricLoader({ size = 280, className = '' }) {
  const bolt = size * 0.38;

  return (
    <div className={className} style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}>
      <style>{`
        @keyframes el-pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(0.92); }
        }
        @keyframes el-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0),     0 8px 40px -8px rgba(22,101,52,0.6); }
          50%       { box-shadow: 0 0 0 14px rgba(34,197,94,0.08), 0 8px 56px -4px rgba(22,101,52,0.9); }
        }

        /* Ring base rotations */
        @keyframes el-r1 { to { transform: rotate(360deg);  } }
        @keyframes el-r2 { to { transform: rotate(-360deg); } }
        @keyframes el-r3 { to { transform: rotate(360deg);  } }
        .el-r1 { animation: el-r1 3s   linear infinite; transform-origin: 100px 100px; }
        .el-r2 { animation: el-r2 4.5s linear infinite; transform-origin: 100px 100px; }
        .el-r3 { animation: el-r3 6.5s linear infinite; transform-origin: 100px 100px; }

        /* Comets — strokeDashoffset races around each ring circumference */
        /* r=90 → C≈565 */
        @keyframes el-c1 { to { stroke-dashoffset: -565; } }
        .el-c1 { stroke-dasharray: 40 525; stroke-dashoffset: 0; animation: el-c1 1.4s linear infinite; }

        /* r=76 → C≈478 */
        @keyframes el-c2 { to { stroke-dashoffset: 478; } }
        .el-c2 { stroke-dasharray: 30 448; stroke-dashoffset: 0; animation: el-c2 2s linear infinite; }

        /* r=60 → C≈377 */
        @keyframes el-c3 { to { stroke-dashoffset: -377; } }
        .el-c3 { stroke-dasharray: 20 357; stroke-dashoffset: 0; animation: el-c3 2.6s linear infinite; }

        /* Arc flicker */
        @keyframes el-arc {
          0%,100%      { opacity: 0; }
          8%, 10%      { opacity: 1; }
          9%           { opacity: 0.3; }
          48%, 50%     { opacity: 0.85; }
          49%          { opacity: 0.1; }
        }
        .el-a1 { animation: el-arc 1.1s ease-in-out infinite; }
        .el-a2 { animation: el-arc 1.7s ease-in-out infinite 0.35s; }
        .el-a3 { animation: el-arc 0.95s ease-in-out infinite 0.7s; }
        .el-a4 { animation: el-arc 1.45s ease-in-out infinite 0.15s; }

        .el-container { animation: el-glow 2s ease-in-out infinite; }
        .el-icon      { animation: el-pulse 2s ease-in-out infinite; }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <filter id="el-gf" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="el-bf" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
        </defs>

        {/* ── Ring 1 (r=90) — bare dark track ── */}
        <circle cx="100" cy="100" r="90"
          fill="none" stroke="#1e293b" strokeWidth="1.5" opacity="0.7" />

        {/* Comet 1 — electric white/cyan */}
        <circle cx="100" cy="100" r="90"
          fill="none" stroke="url(#el-comet1)" strokeWidth="3"
          strokeLinecap="round"
          className="el-r1 el-c1"
          filter="url(#el-gf)" />
        {/* Soft bloom behind comet 1 */}
        <circle cx="100" cy="100" r="90"
          fill="none" stroke="#e0ffe8" strokeWidth="8"
          strokeLinecap="round" opacity="0.12"
          className="el-r1 el-c1"
          filter="url(#el-bf)" />

        {/* ── Ring 2 (r=76) — bare dark track ── */}
        <circle cx="100" cy="100" r="76"
          fill="none" stroke="#1e293b" strokeWidth="1.5" opacity="0.7" />

        {/* Comet 2 */}
        <circle cx="100" cy="100" r="76"
          fill="none" stroke="url(#el-comet2)" strokeWidth="2.5"
          strokeLinecap="round"
          className="el-r2 el-c2"
          filter="url(#el-gf)" />
        <circle cx="100" cy="100" r="76"
          fill="none" stroke="#e0ffe8" strokeWidth="6"
          strokeLinecap="round" opacity="0.1"
          className="el-r2 el-c2"
          filter="url(#el-bf)" />

        {/* ── Ring 3 (r=60) — bare dark track ── */}
        <circle cx="100" cy="100" r="60"
          fill="none" stroke="#1e293b" strokeWidth="1" opacity="0.6" />

        {/* Comet 3 */}
        <circle cx="100" cy="100" r="60"
          fill="none" stroke="url(#el-comet3)" strokeWidth="2"
          strokeLinecap="round"
          className="el-r3 el-c3"
          filter="url(#el-gf)" />

        {/* ── Arc sparks — jagged electric bolts between rings ── */}
        <polyline points="158,47 164,40 167,47 172,40 176,46"
          fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" className="el-a1" filter="url(#el-gf)" />
        <polyline points="38,150 32,157 29,150 24,157 21,151"
          fill="none" stroke="#e0ffe8" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" className="el-a2" filter="url(#el-gf)" />
        <polyline points="44,50 38,43 35,50 30,43 27,50"
          fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"
          opacity="0" className="el-a3" filter="url(#el-gf)" />
        <polyline points="160,152 166,159 169,152 173,158 177,152"
          fill="none" stroke="#e0ffe8" strokeWidth="1.2" strokeLinecap="round"
          opacity="0" className="el-a4" filter="url(#el-gf)" />

        {/* Comet gradient defs — white head → transparent tail */}
        <defs>
          <linearGradient id="el-comet1" gradientUnits="userSpaceOnUse" x1="100" y1="10" x2="180" y2="100">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <stop offset="40%"  stopColor="#86efac" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#166534" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="el-comet2" gradientUnits="userSpaceOnUse" x1="100" y1="24" x2="170" y2="100">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <stop offset="40%"  stopColor="#86efac" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#166534" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="el-comet3" gradientUnits="userSpaceOnUse" x1="100" y1="40" x2="155" y2="100">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <stop offset="50%"  stopColor="#86efac" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#166534" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Center logo tile ── */}
      <div
        className="el-container"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: bolt,
          height: bolt,
          borderRadius: '22%',
          background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          className="el-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: bolt * 0.52, height: bolt * 0.52 }}
        >
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      </div>
    </div>
  );
}
