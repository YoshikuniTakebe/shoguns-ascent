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
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Left katana (curved blade + guard + handle) */}
    <path d="M4 20 Q9 13 17 3" />
    <circle cx="15.5" cy="5.5" r="1.3" fill={color} stroke="none" />
    <line x1="17" y1="3" x2="19" y2="1" />
    {/* Right katana (curved blade + guard + handle) */}
    <path d="M20 20 Q15 13 7 3" />
    <circle cx="8.5" cy="5.5" r="1.3" fill={color} stroke="none" />
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

/** Oni mask - used for Monster units */
export const MonsterIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    stroke="none"
  >
    {/* Oni mask silhouette in clan color */}
    <path fill={color} d="M256 486 C235 486 221 470 206 454 C178 447 164 425 160 396 C138 384 124 363 122 338 C100 336 86 315 86 292 C86 270 95 249 108 232 C84 204 73 167 82 130 C89 101 111 77 123 51 C132 31 134 18 134 18 C156 43 174 79 172 116 C171 146 158 172 146 196 C171 178 195 166 222 161 C229 151 241 146 256 146 C271 146 283 151 290 161 C317 166 341 178 366 196 C354 172 341 146 340 116 C338 79 356 43 378 18 C378 18 380 31 389 51 C401 77 423 101 430 130 C439 167 428 204 404 232 C417 249 426 270 426 292 C426 315 412 336 390 338 C388 363 374 384 352 396 C348 425 334 447 306 454 C291 470 277 486 256 486 Z M256 197 C238 219 226 246 222 278 C237 267 249 258 256 235 C263 258 275 267 290 278 C286 246 274 219 256 197 Z"/>
    {/* White eyes */}
    <path fill="#ffffff" d="M147 292 C169 270 210 268 234 287 C213 306 174 313 145 304 C139 302 140 297 147 292 Z"/>
    <path fill="#ffffff" d="M365 292 C343 270 302 268 278 287 C299 306 338 313 367 304 C373 302 372 297 365 292 Z"/>
    {/* White fangs */}
    <path fill="#ffffff" d="M160 353 C134 379 122 398 116 421 C151 411 170 390 179 362 Z"/>
    <path fill="#ffffff" d="M352 353 C378 379 390 398 396 421 C361 411 342 390 333 362 Z"/>
    {/* White upper teeth */}
    <path fill="#ffffff" d="M190 385 L205 425 L219 383 Z"/>
    <path fill="#ffffff" d="M222 381 L237 432 L251 379 Z"/>
    <path fill="#ffffff" d="M261 379 L275 432 L290 381 Z"/>
    <path fill="#ffffff" d="M293 383 L307 425 L322 385 Z"/>
    {/* White lower teeth */}
    <path fill="#ffffff" d="M197 443 L210 405 L223 444 Z"/>
    <path fill="#ffffff" d="M228 450 L241 400 L254 452 Z"/>
    <path fill="#ffffff" d="M258 452 L271 400 L284 450 Z"/>
    <path fill="#ffffff" d="M289 444 L302 405 L315 443 Z"/>
  </svg>
);

/** Oni demon head with horns, fierce eyes, and fangs - used for Monster units (legacy) */
export const MonsterIconOld = ({ size = 24, color = 'currentColor', className }: IconProps) => (
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
    stroke="none"
  >
    {/* Five sakura petals with notched tips, rotated 72 degrees apart */}
    {/* Each petal: rounded bulbous shape tapering at base with V-notch at tip */}
    <path d="M12 12 C10 9.5 9 7 9.5 5 C9.8 4 10.8 3.5 11.3 4 L12 3 L12.7 4 C13.2 3.5 14.2 4 14.5 5 C15 7 14 9.5 12 12 Z" fill={color} transform="rotate(0 12 12)" />
    <path d="M12 12 C10 9.5 9 7 9.5 5 C9.8 4 10.8 3.5 11.3 4 L12 3 L12.7 4 C13.2 3.5 14.2 4 14.5 5 C15 7 14 9.5 12 12 Z" fill={color} transform="rotate(72 12 12)" />
    <path d="M12 12 C10 9.5 9 7 9.5 5 C9.8 4 10.8 3.5 11.3 4 L12 3 L12.7 4 C13.2 3.5 14.2 4 14.5 5 C15 7 14 9.5 12 12 Z" fill={color} transform="rotate(144 12 12)" />
    <path d="M12 12 C10 9.5 9 7 9.5 5 C9.8 4 10.8 3.5 11.3 4 L12 3 L12.7 4 C13.2 3.5 14.2 4 14.5 5 C15 7 14 9.5 12 12 Z" fill={color} transform="rotate(216 12 12)" />
    <path d="M12 12 C10 9.5 9 7 9.5 5 C9.8 4 10.8 3.5 11.3 4 L12 3 L12.7 4 C13.2 3.5 14.2 4 14.5 5 C15 7 14 9.5 12 12 Z" fill={color} transform="rotate(288 12 12)" />
    {/* Center stamen circle */}
    <circle cx="12" cy="12" r="2" fill={color} opacity="0.85" />
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
    viewBox="780 380 680 680"
    fill={color}
    stroke="none"
  >
    <path d="M1367.68,811.312s-96.201,9.114-94.177,53.67c2.01,44.212,36.918,73.463,37.462,73.921-.812-.296-68.426-3.017-108.347,28.019,0,0-36.822,2.74-93.418-43.792,4.044,36.416,2.01,73.988-5.953,108.762-1.585,6.932-8.665,11.152-15.501,9.195-.921-.263-1.838-.563-2.74-.898-6.454-2.397-9.687-9.581-7.3-16.036,11.916-32.22,16.552-67.113,13.463-101.324-56.801,46.848-93.786,44.093-93.786,44.093-39.92-31.036-107.535-28.315-108.346-28.019.544-.458,35.452-29.709,37.462-73.921,2.024-44.556-94.177-53.67-94.177-53.67,11.138-52.658-40.847-101.945-40.847-101.945,61.256,8.106,94.268-34.087,94.268-34.087,0,0,89.68,60.917,113.369,36.803,16.189-16.475-21.306-128.598-21.306-128.598,40.508,19.239,57.05-69.538,57.05-69.538,24.3,8.106,55.207-39.176,65.146-89.513,9.095,50.337,40.847,97.619,65.146,89.513,0,0,16.542,88.778,57.05,69.538,0,0-37.495,112.123-21.306,128.598,23.689,24.114,113.369-36.803,113.369-36.803,0,0,33.012,42.193,94.268,34.087,0,0-51.984,49.287-40.847,101.945Z" />
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

/** Circular counterclockwise arrow - used for Undo action */
export const UndoIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Circular arrow (counterclockwise) */}
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    {/* Arrowhead */}
    <polyline points="3 2 3 8 9 8" fill="none" />
  </svg>
);

/** Shield with star - used to represent Force/Strength */
export const FistIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 2L3 7v5c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" opacity="0.9"/>
    <path d="M12 6l1.5 3.5H17l-3 2.5 1 3.5-3-2-3 2 1-3.5-3-2.5h3.5z" fill="#1a1a2e"/>
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

/** Sun icon - used for light mode toggle */
export const SunIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="20" x2="12" y2="23" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="1" y1="12" x2="4" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="20" y1="12" x2="23" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Moon icon - used for dark mode toggle */
export const MoonIcon = ({ size = 24, color = 'currentColor', className }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
