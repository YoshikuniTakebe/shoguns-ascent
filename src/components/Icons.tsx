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

/** Japanese war fan (gunbai) - used for Honor */
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
    {/* Wide semicircular fan body */}
    <path d="M3 11 C3 5, 8 2, 12 2 C16 2, 21 5, 21 11 C21 13, 18 14, 12 14 C6 14, 3 13, 3 11 Z" />
    {/* Radiating ribs from handle pivot */}
    <line x1="12" y1="14" x2="5" y2="5" />
    <line x1="12" y1="14" x2="8" y2="3.5" />
    <line x1="12" y1="14" x2="12" y2="2" />
    <line x1="12" y1="14" x2="16" y2="3.5" />
    <line x1="12" y1="14" x2="19" y2="5" />
    {/* Sun circle in upper-center of fan */}
    <circle cx="12" cy="7.5" r="2" fill={color} stroke="none" />
    {/* Handle extending down */}
    <line x1="12" y1="14" x2="12" y2="22" strokeWidth="2" />
  </svg>
);

/** Rising sun war flag (kyokujitsu-ki) - used for Victory Points */
export const VPIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Triangular rays radiating from center in all directions */}
    <polygon points="12,12 10,0 14,0" />
    <polygon points="12,12 14,24 10,24" />
    <polygon points="12,12 0,10 0,14" />
    <polygon points="12,12 24,14 24,10" />
    <polygon points="12,12 2.5,2.5 5.3,1.5 1.5,5.3" />
    <polygon points="12,12 21.5,2.5 22.5,5.3 18.7,1.5" />
    <polygon points="12,12 2.5,21.5 5.3,22.5 1.5,18.7" />
    <polygon points="12,12 21.5,21.5 18.7,22.5 22.5,18.7" />
    {/* Central sun circle */}
    <circle cx="12" cy="12" r="4" />
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

/** Samurai kabuto helmet with crescent crest - used for Daimyo on map */
export const DaimyoIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Crescent maedate crest on top */}
    <path d="M4 8 C4 8, 7 4, 12 3 C17 4, 20 8, 20 8 C19 7, 16 5.5, 12 5 C8 5.5, 5 7, 4 8 Z" />
    {/* Helmet bowl (hachi) */}
    <path d="M5 12 C5 9, 8 7, 12 7 C16 7, 19 9, 19 12 L19 14 L5 14 Z" />
    {/* Shikoro (neck guard flaps) */}
    <path d="M4 14 L20 14 L21 16 L3 16 Z" />
    <path d="M3 16 L21 16 L22 18 L2 18 Z" />
    {/* Face opening */}
    <rect x="9" y="18" width="6" height="4" rx="1" opacity="0.4" />
  </svg>
);

/** Small warrior with sword raised overhead - used for Ronin */
export const RoninIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Head */}
    <circle cx="12" cy="7" r="2.5" fill={color} stroke="none" />
    {/* Body */}
    <line x1="12" y1="9.5" x2="12" y2="17" />
    {/* Left arm raised holding sword */}
    <line x1="12" y1="11" x2="8" y2="8" />
    {/* Right arm raised holding sword */}
    <line x1="12" y1="11" x2="16" y2="8" />
    {/* Sword blade held overhead */}
    <line x1="7" y1="3" x2="17" y2="3" strokeWidth="2" />
    {/* Sword handle */}
    <line x1="10" y1="5" x2="14" y2="5" strokeWidth="1" />
    {/* Left leg */}
    <line x1="12" y1="17" x2="9" y2="22" />
    {/* Right leg */}
    <line x1="12" y1="17" x2="15" y2="22" />
  </svg>
);
