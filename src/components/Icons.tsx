/**
 * Shared SVG icon components for consistent iconography across the app.
 * Each icon accepts size (px) and color props.
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Two crossed katanas - used for Bushi forces */
export const BushiIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Left katana (blade + guard + handle) */}
    <line x1="4" y1="20" x2="17" y2="3" />
    <circle cx="15.5" cy="5.5" r="1.2" fill={color} stroke="none" />
    <line x1="17" y1="3" x2="19" y2="1" />
    {/* Right katana (blade + guard + handle) */}
    <line x1="20" y1="20" x2="7" y2="3" />
    <circle cx="8.5" cy="5.5" r="1.2" fill={color} stroke="none" />
    <line x1="7" y1="3" x2="5" y2="1" />
  </svg>
);

/** Round coin with square hole in center - traditional Japanese mon */
export const CoinIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <circle cx="12" cy="12" r="9" />
    <rect x="9.5" y="9.5" width="5" height="5" />
  </svg>
);

/** Traditional Japanese folding fan (sensu) - used for Honor */
export const HonorIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Fan wedge shape */}
    <path d="M12 20 C12 20, 3 8, 5 5 C7 2, 17 2, 19 5 C21 8, 12 20, 12 20 Z" />
    {/* Fan ribs */}
    <line x1="12" y1="20" x2="7" y2="5" />
    <line x1="12" y1="20" x2="12" y2="3" />
    <line x1="12" y1="20" x2="17" y2="5" />
  </svg>
);

/** Rising sun with rays - used for Victory Points */
export const VPIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Horizon line */}
    <rect x="2" y="15" width="20" height="1.5" rx="0.5" />
    {/* Half circle (sun body) */}
    <path d="M6 15 A6 6 0 0 1 18 15 Z" />
    {/* Rays extending upward */}
    <rect x="11.25" y="2" width="1.5" height="5" rx="0.5" />
    <rect x="11.25" y="2" width="1.5" height="5" rx="0.5" transform="rotate(-30 12 15)" />
    <rect x="11.25" y="2" width="1.5" height="5" rx="0.5" transform="rotate(30 12 15)" />
    <rect x="11.25" y="2" width="1.5" height="5" rx="0.5" transform="rotate(-60 12 15)" />
    <rect x="11.25" y="2" width="1.5" height="5" rx="0.5" transform="rotate(60 12 15)" />
  </svg>
);

/** Torii gate - used for Shinto (kept from existing design) */
export const ShintoIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <rect x="4" y="6" width="16" height="2" rx="1" />
    <rect x="6" y="4" width="12" height="2" rx="0.5" opacity="0.7" />
    <rect x="7" y="8" width="2" height="14" />
    <rect x="15" y="8" width="2" height="14" />
    <rect x="9" y="12" width="6" height="1.5" opacity="0.5" />
  </svg>
);

/** Castle/fortress - used for Fortress (kept from existing design) */
export const FortressIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <rect x="3" y="18" width="18" height="3" />
    <rect x="5" y="12" width="14" height="6" />
    <rect x="4" y="11" width="16" height="2" opacity="0.7" />
    <rect x="7" y="6" width="10" height="6" />
    <rect x="6" y="5" width="12" height="2" opacity="0.7" />
    <rect x="10" y="2" width="4" height="4" />
    <rect x="9" y="1" width="6" height="2" opacity="0.7" />
    <rect x="10" y="14" width="4" height="4" fill="rgba(0,0,0,0.3)" />
  </svg>
);
