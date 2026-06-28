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

/** Classic Japanese folding fan (sensu) - widely open, used for Honor */
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
    {/* Fan body - wide semicircle opening from bottom pivot, nearly 180 degrees */}
    <path d="M1 12 A11 11 0 0 1 23 12 L12 20 Z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" />
    {/* Curved top arc - wide semicircle */}
    <path d="M1 12 A11 11 0 0 1 23 12" fill="none" stroke={color} strokeWidth="1.5" />
    {/* Fold/rib lines radiating widely from pivot to top arc */}
    <line x1="12" y1="20" x2="1.5" y2="12" />
    <line x1="12" y1="20" x2="2.5" y2="8.5" />
    <line x1="12" y1="20" x2="5" y2="5.5" />
    <line x1="12" y1="20" x2="8.5" y2="3.5" />
    <line x1="12" y1="20" x2="12" y2="2.8" />
    <line x1="12" y1="20" x2="15.5" y2="3.5" />
    <line x1="12" y1="20" x2="19" y2="5.5" />
    <line x1="12" y1="20" x2="21.5" y2="8.5" />
    <line x1="12" y1="20" x2="22.5" y2="12" />
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

/** Kanji character for 'war/battle' (戦) - used for War Province Tokens */
export const WarTokenIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <text
      x="12"
      y="18"
      textAnchor="middle"
      fontSize="18"
      fontWeight="bold"
      fill={color}
      fontFamily="serif"
    >
      戦
    </text>
  </svg>
);

/** Prison bars icon - used for Hostages */
export const HostageIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
  >
    {/* Vertical bars */}
    <line x1="6" y1="3" x2="6" y2="21" />
    <line x1="10" y1="3" x2="10" y2="21" />
    <line x1="14" y1="3" x2="14" y2="21" />
    <line x1="18" y1="3" x2="18" y2="21" />
    {/* Horizontal bars */}
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

/** Oni demon head with horns, fierce eyes, and fangs - used for Monster units */
export const MonsterIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
  >
    {/* Left horn */}
    <path d="M9 13 C8 10, 6 7, 5 4 C6 6, 8 8, 10 11" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Right horn */}
    <path d="M23 13 C24 10, 26 7, 27 4 C26 6, 24 8, 22 11" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Wild spiky hair */}
    <path d="M10 12 C11 9, 13 8, 16 8 C19 8, 21 9, 22 12" fill={color} stroke={color} strokeWidth="0.5" />
    <path d="M12 10 L13 7.5 L14.5 10" fill={color} stroke={color} strokeWidth="0.5" />
    <path d="M15 9.5 L16 6.5 L17 9.5" fill={color} stroke={color} strokeWidth="0.5" />
    <path d="M18 10 L19 7.5 L20 10" fill={color} stroke={color} strokeWidth="0.5" />
    {/* Face shape */}
    <path
      d="M8 15 C8 12, 11 10, 16 10 C21 10, 24 12, 24 15 L24 21 C24 25, 21 27, 16 27 C11 27, 8 25, 8 21 Z"
      fill={color}
    />
    {/* Left angry eye */}
    <path d="M10.5 16 L13 14.5 L14.5 16.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12.5" cy="16.5" r="1.5" fill="white" />
    <circle cx="12.5" cy="16.5" r="0.8" fill="#1a1a2e" />
    {/* Right angry eye */}
    <path d="M21.5 16 L19 14.5 L17.5 16.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="19.5" cy="16.5" r="1.5" fill="white" />
    <circle cx="19.5" cy="16.5" r="0.8" fill="#1a1a2e" />
    {/* Nose */}
    <circle cx="15" cy="20" r="1" fill="#1a1a2e" opacity="0.6" />
    <circle cx="17" cy="20" r="1" fill="#1a1a2e" opacity="0.6" />
    {/* Mouth with fangs */}
    <path d="M11 23 C13 25, 19 25, 21 23" fill="none" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />
    {/* Left fang/tusk */}
    <path d="M12 23 L11.5 26 L13 24" fill="white" stroke="white" strokeWidth="0.5" />
    {/* Right fang/tusk */}
    <path d="M20 23 L20.5 26 L19 24" fill="white" stroke="white" strokeWidth="0.5" />
  </svg>
);

/** Cherry blossom / sakura flower - used for Spring season */
export const SpringIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="0.5"
  >
    {/* Five sakura petals with notched tips arranged radially around center */}
    {/* Top petal */}
    <path d="M12 11 C11 9, 10.2 6.5, 10.5 4.5 C10.7 3.2, 11.3 2.5, 12 3.5 C12.7 2.5, 13.3 3.2, 13.5 4.5 C13.8 6.5, 13 9, 12 11 Z" fill={color} />
    {/* Top-right petal */}
    <path d="M12.5 11.5 C14 10, 16 8.5, 17.8 8 C19 7.7, 19.7 8.2, 19 9.1 C19.9 9.6, 19.4 10.3, 18.3 10.8 C16.5 11.6, 14.2 11.5, 12.5 11.5 Z" fill={color} />
    {/* Bottom-right petal */}
    <path d="M12.3 12.5 C13.5 13.8, 14.8 16, 15 17.8 C15.1 19, 14.6 19.7, 13.8 19 C13.5 19.9, 12.7 19.5, 12.3 18.4 C11.7 16.6, 12 14.3, 12.3 12.5 Z" fill={color} />
    {/* Bottom-left petal */}
    <path d="M11.7 12.5 C10.5 13.8, 9.2 16, 9 17.8 C8.9 19, 9.4 19.7, 10.2 19 C10.5 19.9, 11.3 19.5, 11.7 18.4 C12.3 16.6, 12 14.3, 11.7 12.5 Z" fill={color} />
    {/* Top-left petal */}
    <path d="M11.5 11.5 C10 10, 8 8.5, 6.2 8 C5 7.7, 4.3 8.2, 5 9.1 C4.1 9.6, 4.6 10.3, 5.7 10.8 C7.5 11.6, 9.8 11.5, 11.5 11.5 Z" fill={color} />
    {/* Center circle */}
    <circle cx="12" cy="12" r="1.5" fill={color} opacity="0.8" />
  </svg>
);

/** Bright sun with rays - used for Summer season */
export const SummerIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Central sun circle */}
    <circle cx="12" cy="12" r="5" />
    {/* Rays */}
    <rect x="11" y="1" width="2" height="4" rx="1" />
    <rect x="11" y="19" width="2" height="4" rx="1" />
    <rect x="1" y="11" width="4" height="2" rx="1" />
    <rect x="19" y="11" width="4" height="2" rx="1" />
    <rect x="4.2" y="4.2" width="2" height="4" rx="1" transform="rotate(-45 5.2 6.2)" />
    <rect x="17.8" y="4.2" width="2" height="4" rx="1" transform="rotate(45 18.8 6.2)" />
    <rect x="4.2" y="15.8" width="2" height="4" rx="1" transform="rotate(45 5.2 17.8)" />
    <rect x="17.8" y="15.8" width="2" height="4" rx="1" transform="rotate(-45 18.8 17.8)" />
  </svg>
);

/** Maple leaf - used for Autumn season */
export const AutumnIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    {/* Palmate maple leaf with 5 pointed lobes */}
    <path d="M12 2 L13 5 L15.5 3.5 L14.5 6.5 L17.5 5.5 L15.5 8 L19 7.5 L16 10 L20 11 L16.5 12 L19 14.5 L15 13.5 L15.5 16 L13 14 L12 17 L11 14 L8.5 16 L9 13.5 L5 14.5 L7.5 12 L4 11 L8 10 L5 7.5 L8.5 8 L6.5 5.5 L9.5 6.5 L8.5 3.5 L11 5 Z" />
    {/* Stem */}
    <path d="M12 17 L12 22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** Snowflake - used for Winter season */
export const WinterIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
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
    {/* Main axes */}
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
    <line x1="19.1" y1="4.9" x2="4.9" y2="19.1" />
    {/* Branch tips */}
    <line x1="12" y1="2" x2="10" y2="4" />
    <line x1="12" y1="2" x2="14" y2="4" />
    <line x1="12" y1="22" x2="10" y2="20" />
    <line x1="12" y1="22" x2="14" y2="20" />
    <line x1="2" y1="12" x2="4" y2="10" />
    <line x1="2" y1="12" x2="4" y2="14" />
    <line x1="22" y1="12" x2="20" y2="10" />
    <line x1="22" y1="12" x2="20" y2="14" />
  </svg>
);

/** Ronin warrior in attack pose framed in hexagon border */
export const RoninIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="none"
  >
    {/* Hexagon border */}
    <polygon
      points="12,1 21.5,6.5 21.5,17.5 12,23 2.5,17.5 2.5,6.5"
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Head */}
    <circle cx="12" cy="8" r="1.8" fill={color} />
    {/* Torso - wedge shape */}
    <path d="M10.5 10 L9.5 16 L14.5 16 L13.5 10 Z" fill={color} />
    {/* Right arm extending up from shoulder to sword handle */}
    <path d="M13.5 10.5 L15 9 L16.5 7.5 L17 8.5 L15.5 10 L14 11.5 Z" fill={color} />
    {/* Left arm extending up to sword for two-handed grip */}
    <path d="M11 10.5 L12.5 9 L14.5 7 L15 8 L13 9.5 L11.5 11.5 Z" fill={color} />
    {/* Katana blade - clear thick diagonal line above the head */}
    <line
      x1="8"
      y1="9"
      x2="18"
      y2="4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Sword guard (tsuba) - small perpendicular mark */}
    <line
      x1="14.5"
      y1="6"
      x2="15.5"
      y2="8"
      stroke={color}
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* Left leg - wide stance */}
    <path d="M11 16 L8 21 L9.5 21.5 L12 16.5 Z" fill={color} />
    {/* Right leg - wide stance */}
    <path d="M13 16 L15.5 21 L17 20.5 L14 16 Z" fill={color} />
  </svg>
);
