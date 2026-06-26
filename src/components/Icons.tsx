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

/** Classic Japanese folding fan (sensu) - used for Honor */
export const HonorIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Fan body - quarter circle opening upward from bottom pivot */}
    <path d="M3 5 A14 14 0 0 1 21 5 L12 20 Z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" />
    {/* Curved top arc */}
    <path d="M3 5 A14 14 0 0 1 21 5" fill="none" stroke={color} strokeWidth="1.5" />
    {/* Fold/rib lines radiating from pivot to top arc */}
    <line x1="12" y1="20" x2="3.5" y2="5.5" />
    <line x1="12" y1="20" x2="5.8" y2="3.5" />
    <line x1="12" y1="20" x2="8.5" y2="2.3" />
    <line x1="12" y1="20" x2="12" y2="1.8" />
    <line x1="12" y1="20" x2="15.5" y2="2.3" />
    <line x1="12" y1="20" x2="18.2" y2="3.5" />
    <line x1="12" y1="20" x2="20.5" y2="5.5" />
    {/* Pivot knob at the bottom */}
    <circle cx="12" cy="21" r="1.3" fill={color} stroke="none" />
  </svg>
);

/** Rising sun (top half only) - used for Victory Points */
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
    <rect x="1" y="16" width="22" height="1.5" rx="0.5" />
    {/* Semicircle sitting on horizon */}
    <path d="M7 16.5 A5 5 0 0 1 17 16.5 Z" />
    {/* Thick wedge/triangle rays emanating upward only */}
    <polygon points="11,11 13,11 12,3" />
    <polygon points="9.2,12 11,11.2 7.5,4.5" />
    <polygon points="13,11.2 14.8,12 16.5,4.5" />
    <polygon points="7.5,13.5 9,12.2 4,7" />
    <polygon points="15,12.2 16.5,13.5 20,7" />
    <polygon points="5.5,15.5 7,13.8 2,10.5" />
    <polygon points="17,13.8 18.5,15.5 22,10.5" />
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

/** Samurai warrior in attacking stance - used for Ronin */
export const RoninIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Head */}
    <circle cx="14" cy="4.5" r="2.2" />
    {/* Sword raised behind/above head - diagonal slash pose */}
    <rect x="5" y="0.5" width="1.4" height="10" rx="0.5" transform="rotate(30 5 0.5)" />
    {/* Sword handle/grip */}
    <rect x="9.5" y="8" width="1" height="3.5" rx="0.3" transform="rotate(30 9.5 8)" />
    {/* Torso leaning forward aggressively */}
    <path d="M13 7 L10 15 L14 15 L16 7 Z" />
    {/* Back arm reaching up to sword */}
    <path d="M14 8 L11 5 L9.5 6.5 L12 9 Z" />
    {/* Front arm extended forward */}
    <path d="M12 9 L7 12 L7.5 13.5 L13 10.5 Z" />
    {/* Back leg extended behind - wide stance */}
    <path d="M13 15 L17 22 L19 21.5 L15 15 Z" />
    {/* Front leg forward in lunge */}
    <path d="M11 15 L7 22 L9 22.5 L12 15 Z" />
  </svg>
);
