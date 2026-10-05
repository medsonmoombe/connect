'use client';

import { useId } from 'react';

interface ElectricLoaderProps {
  size?: number;
  className?: string;
  dark?: boolean;
  label?: string;
}

export default function ElectricLoader({ size = 280, className = '', dark = false, label }: ElectricLoaderProps) {
  const uid = useId().replace(/:/g, '');
  const id = `elx${uid}`;

  const tilePx = Math.round(size * 0.362);

  // Center of the 200x200 viewBox
  const cx = 100;
  const cy = 100;

  // Color palette
  const p = dark
    ? {
        track1: 'rgba(148,163,184,0.24)',
        track2: 'rgba(148,163,184,0.15)',
        dotted: 'rgba(110,231,183,0.16)',
        arc: '#34D399',
        tail: '#6EE7B7',
        dot: '#ECFDF5',
        tileShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 0 22px rgba(16,185,129,0.25), 0 14px 34px -10px rgba(6,95,70,0.7), inset 0 1px 1px rgba(255,255,255,0.22)',
        tileShadowHi: '0 0 0 1px rgba(255,255,255,0.06), 0 0 34px rgba(16,185,129,0.4), 0 18px 46px -8px rgba(6,95,70,0.85), inset 0 1px 1px rgba(255,255,255,0.22)',
        labelColor: '#93A8A0',
      }
    : {
        track1: '#E3EBE6',
        track2: '#EAF0EC',
        dotted: 'rgba(6,95,70,0.16)',
        arc: '#10B981',
        tail: '#34D399',
        dot: '#FFFFFF',
        tileShadow: '0 2px 5px rgba(6,95,70,0.16), 0 12px 30px -10px rgba(16,185,129,0.38), inset 0 1px 1px rgba(255,255,255,0.45)',
        tileShadowHi: '0 2px 5px rgba(6,95,70,0.16), 0 18px 44px -10px rgba(16,185,129,0.55), inset 0 1px 1px rgba(255,255,255,0.45)',
        labelColor: '#6B8177',
      };

  return (
    <div className={`inline-flex flex-col items-center ${className}`} role="status" aria-label="Loading">
      <style>{`
        @keyframes ${id}-cw  { to { transform: rotate(360deg); } }
        @keyframes ${id}-ccw { to { transform: rotate(-360deg); } }
        @keyframes ${id}-grow {
          from { stroke-dasharray: 16 84; }
          to   { stroke-dasharray: 46 54; }
        }
        @keyframes ${id}-tile {
          0%, 100% { transform: translate(-50%, -50%) scale(1);     box-shadow: ${p.tileShadow}; }
          50%      { transform: translate(-50%, -50%) scale(0.972);  box-shadow: ${p.tileShadowHi}; }
        }
        .${id}-o1 { transform-origin: ${cx}px ${cy}px; animation: ${id}-cw 1.8s linear infinite; }
        .${id}-o2 { transform-origin: ${cx}px ${cy}px; animation: ${id}-ccw 2.7s linear infinite; }
        .${id}-o3 { transform-origin: ${cx}px ${cy}px; animation: ${id}-cw 46s linear infinite; }
        .${id}-arc1 {
          stroke-dasharray: 16 84;
          animation: ${id}-grow 3.6s cubic-bezier(0.37, 0, 0.63, 1) infinite alternate;
        }
        .${id}-tile { animation: ${id}-tile 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .${id}-o1, .${id}-o2, .${id}-o3, .${id}-arc1, .${id}-tile { animation: none; }
        }
      `}</style>

      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0"
        >
          <defs>
            <linearGradient id={`${id}-tail`} gradientUnits="userSpaceOnUse" x1="170" y1="100" x2="147.9" y2="151">
              <stop offset="0%" stopColor={p.tail} stopOpacity={1} />
              <stop offset="55%" stopColor={p.tail} stopOpacity={0.55} />
              <stop offset="100%" stopColor={p.tail} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Outer track ring */}
          <circle cx={cx} cy={cy} r="88" fill="none" stroke={p.track1} strokeWidth="2" />
          {/* Middle track ring */}
          <circle cx={cx} cy={cy} r="70" fill="none" stroke={p.track2} strokeWidth="1.5" />

          {/* Innermost dotted ring (slow spin) */}
          <g className={`${id}-o3`}>
            <circle cx={cx} cy={cy} r="52" fill="none" stroke={p.dotted} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 8.976" />
          </g>

          {/* Outer arc + comet dot */}
          <g className={`${id}-o1`}>
            <circle cx={cx} cy={cy} r="88" fill="none" stroke={p.arc} strokeWidth="3.2" strokeLinecap="round" pathLength={100} strokeDasharray="16 84" className={`${id}-arc1`} />
            <circle cx="188" cy={cy} r="2.7" fill={p.dot} style={{ filter: `drop-shadow(0 0 3px ${dark ? 'rgba(52,211,153,0.9)' : 'rgba(16,185,129,0.85)'})` }} />
          </g>

          {/* Middle arc + comet dot */}
          <g className={`${id}-o2`}>
            <circle cx={cx} cy={cy} r="70" fill="none" stroke={`url(#${id}-tail)`} strokeWidth="2.4" strokeLinecap="round" pathLength={100} strokeDasharray="13 87" />
            <circle cx="170" cy={cy} r="2.2" fill={p.dot} style={{ filter: `drop-shadow(0 0 3px ${dark ? 'rgba(52,211,153,0.9)' : 'rgba(16,185,129,0.85)'})` }} />
          </g>
        </svg>

        {/* Center logo (no card) */}
        <div
          className={`${id}-tile absolute top-1/2 left-1/2 flex items-center justify-center`}
          style={{
            width: tilePx,
            height: tilePx,
          }}
        >
          <img
            src="/Afri%20Connect%20Logo.png"
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      </div>

      {label && (
        <div
          className="mt-2.5 text-center uppercase tracking-[0.16em] leading-relaxed"
          style={{ fontSize: 10, fontWeight: 600, color: p.labelColor }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
