import type { Figure } from '../types/game';

/** Default diorama scales. Admin overrides are layered on top of these values. */
export const DEFAULT_FIGURE_SIZE_OVERRIDES: Record<string, number> = {
  'sp-jorogumo': 0.85,
  'daimyo-tortuga': 1.22,
  'bushi-tortuga': 1.0605,
  'bushi-loto': 0.7275,
  'daimyo-loto': 0.77568,
  'sp-oni-of-skulls': 1.404,
  'daimyo-koi': 1,
  'sp-earth-dragon': 1.3,
  'daimyo-luna': 1.25,
  'bushi-luna': 0.8526,
  'daimyo-libelula': 1.1,
  'daimyo-sol': 1.01,
  'sp-daikokuten': 0.7831296,
  'sp-oni-of-souls': 1.25,
  'sp-phoenix': 1.27,
  'sp-komainu': 0.83,
  'sp-jinmenju': 1.23,
  'daimyo-bonsai': 0.97,
  'bushi-zorro': 0.8316,
  'daimyo-zorro': 0.94,
  'bushi-koi': 0.931,
  'bushi-libelula': 0.869652,
  'bushi-sol': 0.91,
  'bushi-bonsai': 0.833,
  'su-hotei': 1.1385,
  'su-yurei': 1.4076,
  'su-oni-of-souls': 1.25,
  'su-oni-of-blood': 1.2,
  'sp-fukurokuju': 1.04,
  'shinto-koi': 0.97,
  'shinto-zorro': 0.7938,
  'shinto-bonsai': 0.9504,
  'shinto-tortuga': 0.95172,
  'shinto-loto': 0.912,
  'shinto-sol': 0.97,
  'su-sunakake-baba': 0.94,
  'au-benten': 0.9021,
  'au-daikaiju': 1.5625,
  'au-ebisu': 1.0815,
  'su-fire-dragon': 1.25,
  'au-kitsune': 0.9024,
  'sp-kotahi': 0.9215,
  'su-nure-onna': 1.01,
  'su-koneko': 1.0914,
  'au-oni-of-plagues': 1.265,
  'au-oni-of-spite': 1.364475,
  'au-river-dragon': 1.625,
  'su-jikininki': 0.9,
  'au-oni-of-hate': 1.41264,
  'su-bishamon': 1.23,
  'sp-jurojin': 0.95,
};

export function getFigureSizeKey(figure: Figure, ownerClanId: string): string {
  if (figure.type === 'monster' && figure.monsterCardId) return figure.monsterCardId;
  return `${figure.type}-${ownerClanId}`;
}

export function getFigureSizeOverride(
  figure: Figure,
  ownerClanId: string,
  customOverrides: Record<string, number> = {},
): number {
  const key = getFigureSizeKey(figure, ownerClanId);
  return customOverrides[key] ?? DEFAULT_FIGURE_SIZE_OVERRIDES[key] ?? 1;
}

export function formatFigureScale(value: number): string {
  return Number(value.toFixed(6)).toString();
}
