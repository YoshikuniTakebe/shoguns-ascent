export type CardSetName =
  | 'Core'
  | 'Archway'
  | 'Tower'
  | 'Teapot'
  | 'Horseman'
  | 'Ship'
  | 'Mountain'
  | 'Dynasty Invasion'
  | 'Monster Pack'
  | 'Kickstarter Exclusive';

export const CardStackIcon = ({ size = 16 }: { size?: number }) => (
  <svg className="admin-card-set-stack-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="2" width="13" height="17" rx="1.5" fill="currentColor" opacity=".35" />
    <rect x="5.5" y="4.5" width="13" height="17" rx="1.5" fill="currentColor" opacity=".65" />
    <rect x="8" y="7" width="13" height="15" rx="1.5" fill="currentColor" />
  </svg>
);

export const DeckSetIcon = ({ setName, size = 17 }: { setName: CardSetName; size?: number }) => {
  const common = {
    className: 'admin-card-set-symbol',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  } as const;

  switch (setName) {
    case 'Core':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3.2" fill="currentColor" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M19 5l-2.8 2.8M7.8 16.2 5 19" />
        </svg>
      );
    case 'Archway':
      return (
        <svg {...common} fill="currentColor">
          <path d="M2 4h20l-2 3H4L2 4Zm3 4h14v2H5V8Zm2 2h3v12H7V10Zm7 0h3v12h-3V10Z" />
        </svg>
      );
    case 'Tower':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2 8 4-2 2H6L4 6l8-4Zm-5 7h10l2 3H5l2-3Zm1 4h8l2 3H6l2-3Zm1 4h6v5H9v-5Z" />
        </svg>
      );
    case 'Teapot':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M7 8h9v8a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4V8Zm2-3h5M8 5l-2 3h11l-3-3" />
          <path d="M16 10c4 0 5 2 5 4s-2 3-4 3M7 10 3 8v4l4 1" />
        </svg>
      );
    case 'Horseman':
      return (
        <svg {...common} fill="currentColor">
          <path d="M6 21v-2h13v2H6Zm1.2-4c.3-2.8 1.5-5 3.8-6.6L8.2 8.2 9.8 6l.7-3.8 5.4 2.7 1.5 4.2-3.1 2.6c2.4 1.2 3.8 3 4.1 5.3H7.2Z" />
          <path d="m11.1 7.6 2.1-1.4 1.9 1-2.6.4-1.4 1.2Z" fill="var(--bg-dark)" />
          <circle cx="13.3" cy="5.7" r=".8" fill="var(--bg-dark)" />
        </svg>
      );
    case 'Ship':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17h16l-3 4H7l-3-4Zm8-14v14M12 4l6 9h-6M11 6 6 14h5M3 22c2-1 3-1 5 0 2-1 3-1 5 0 2-1 3-1 5 0" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="m2 21 7-13 3 5 3-9 7 17H2Z" />
          <path d="m7 12 2-4 2.2 3.6M13.5 8l1.5-4 2.2 5.3" />
        </svg>
      );
    case 'Dynasty Invasion':
      return (
        <svg {...common} fill="currentColor">
          <path d="M5 2h2v20H5V2Zm12 0h2v20h-2V2ZM7 4h7l-2 4 2 4H7V4Zm3 8h7v8h-7l2-4-2-4Z" />
        </svg>
      );
    case 'Monster Pack':
      return (
        <svg {...common} fill="currentColor">
          <path d="M4 3c2 1 3 3 3 5 3-2 7-2 10 0 0-2 1-4 3-5 0 4-1 6-3 7l2 4-3 7H8l-3-7 2-4C5 9 4 7 4 3Zm5 9 2 2-3 1 1-3Zm6 0 1 3-3-1 2-2Zm-5 6h4l-2-2-2 2Z" />
        </svg>
      );
    case 'Kickstarter Exclusive':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2 2.6 6.2L21 9l-4.8 4.3 1.4 6.4-5.6-3.3-5.6 3.3 1.4-6.4L3 9l6.4-.8L12 2Z" />
        </svg>
      );
  }
};
