import type { CSSProperties } from 'react';

interface ChainProofLogoProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

/** Geometric logo: a document with a chain-link checkmark overlaid. */
export function ChainProofLogo({ size = 32, color = '#147D83', style, className }: ChainProofLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ChainProof logo"
      role="img"
      className={className}
      style={style}
    >
      {/* Document body */}
      <rect x="12" y="6" width="34" height="46" rx="3" fill={color} opacity="0.15" />
      <rect x="12" y="6" width="34" height="46" rx="3" stroke={color} strokeWidth="2.5" fill="none" />
      {/* Text lines */}
      <line x1="20" y1="18" x2="38" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="25" x2="34" y2="25" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="32" x2="30" y2="32" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Verification checkmark circle */}
      <circle cx="44" cy="44" r="14" fill="white" stroke={color} strokeWidth="2.5" />
      <circle cx="44" cy="44" r="14" fill={color} opacity="0.12" />
      {/* Chain links (two interlocking ovals) */}
      <ellipse cx="40" cy="44" rx="5" ry="3.5" stroke={color} strokeWidth="2" fill="none" />
      <ellipse cx="48" cy="44" rx="5" ry="3.5" stroke={color} strokeWidth="2" fill="none" />
      {/* Checkmark */}
      <polyline points="38,48 42,52 52,40" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
