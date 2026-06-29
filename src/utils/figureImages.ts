// Template figure image (used as placeholder for miniatures without final images)
import templateFigImg from '../img/template_fig.png';
export const TEMPLATE_FIGURE_IMG = templateFigImg;

// Monster card image imports (for season cards display)
import daikokutenImg from '../img/Daikokuten.png';
import earthDragonImg from '../img/Earth Dragon.png';
import fukurokujuImg from '../img/Fukurokuju.png';
import jinmenjuImg from '../img/Jinmenju.png';
import jorogumoImg from '../img/Jorogumo.png';
import jurojinImg from '../img/Jurojin.png';
import komainuImg from '../img/Komainu.png';
import kotahiImg from '../img/Kotahi.png';
import oniOfSkullsImg from '../img/Oni of Skulls.png';
import oniOfSoulsImg from '../img/Oni of Souls.png';
import phoenixImg from '../img/Phoenix.png';
import bishamonImg from '../img/Bishamon.png';
import fireDragonImg from '../img/Fire Dragon.png';
import hoteiImg from '../img/Hotei.png';
import jikininikiImg from '../img/Jikininki.png';
import konekoImg from '../img/Koneko.png';
import nureOnnaImg from '../img/Nure-Onna.png';
import oniOfBloodImg from '../img/Oni of Blood.png';

// Monster figure image imports (for region diorama miniatures)
import daikokutenFigImg from '../img/Daikokuten_fig.png';
import earthDragonFigImg from '../img/Earth Dragon_fig.png';
import fukurokujuFigImg from '../img/Fukurokuju_fig.png';
import jinmenjuFigImg from '../img/Jinmenju_fig.png';
import jorogumoFigImg from '../img/Jorogumo_fig.png';
import jurojinFigImg from '../img/Jurojin_fig.png';
import komainuFigImg from '../img/Komainu_fig.png';
import kotahiFigImg from '../img/Kotahi_fig.png';
import oniOfSkullsFigImg from '../img/Oni of Skulls_fig.png';
import oniOfSoulsFigImg from '../img/Oni of Souls_fig.png';
import phoenixFigImg from '../img/Phoenix_fig.png';
import bishamonFigImg from '../img/Bishamon_fig.png';
import fireDragonFigImg from '../img/Fire Dragon_fig.png';
import hoteiFigImg from '../img/Hotei_fig.png';
import jikinikiFigImg from '../img/Jikininki_fig.png';
import konekoFigImg from '../img/Koneko_fig.png';
import nureOnnaFigImg from '../img/Nure-Onna_fig.png';
import oniOfBloodFigImg from '../img/Oni of Blood_fig.png';

// Region background image imports
import edoBg from '../img/Edo.png';
import hokkaidoBg from '../img/Hokkaido.png';
import kansaiBg from '../img/Kansai.png';
import kantoBg from '../img/Kanto.png';
import nagatoBg from '../img/Nagato.png';
import oshuBg from '../img/Oshu.png';
import shikokuBg from '../img/Shikoku.png';
import kyushuBg from '../img/Kyshu.png';

// Castle image imports
import castleKoiImg from '../img/castle_koi.png';
import castleSunImg from '../img/castle_sun.png';
import castleLotusImg from '../img/castle_lotus.png';
import castleTurtleImg from '../img/castle_turtle.png';
import castleDragonflyImg from '../img/castle_dragonfly.png';
import castleFoxImg from '../img/castle_fox.png';
import castleBonsaiImg from '../img/castle_bonsai.png';
import castleMoonImg from '../img/castle_moon.png';

/** Maps monster card IDs to their image file */
export const MONSTER_IMAGE_MAP: Record<string, string> = {
  'sp-daikokuten': daikokutenImg,
  'sp-earth-dragon': earthDragonImg,
  'sp-fukurokuju': fukurokujuImg,
  'sp-jinmenju': jinmenjuImg,
  'sp-jorogumo': jorogumoImg,
  'sp-jurojin': jurojinImg,
  'sp-komainu': komainuImg,
  'sp-kotahi': kotahiImg,
  'sp-oni-of-skulls': oniOfSkullsImg,
  'sp-oni-of-souls': oniOfSoulsImg,
  'sp-phoenix': phoenixImg,
  'su-bishamon': bishamonImg,
  'su-fire-dragon': fireDragonImg,
  'su-hotei': hoteiImg,
  'su-jikininki': jikininikiImg,
  'su-koneko': konekoImg,
  'su-nure-onna': nureOnnaImg,
  'su-oni-of-blood': oniOfBloodImg,
  'su-oni-of-souls': oniOfSoulsImg,
};

/**
 * Maps monster card IDs to their figure/miniature images (_fig suffix).
 * These are used in the region diorama to display figure miniatures.
 * The _fig images have transparency and are meant to be displayed without frames.
 */
export const MONSTER_FIGURE_MAP: Record<string, string> = {
  'sp-daikokuten': daikokutenFigImg,
  'sp-earth-dragon': earthDragonFigImg,
  'sp-fukurokuju': fukurokujuFigImg,
  'sp-jinmenju': jinmenjuFigImg,
  'sp-jorogumo': jorogumoFigImg,
  'sp-jurojin': jurojinFigImg,
  'sp-komainu': komainuFigImg,
  'sp-kotahi': kotahiFigImg,
  'sp-oni-of-skulls': oniOfSkullsFigImg,
  'sp-oni-of-souls': oniOfSoulsFigImg,
  'sp-phoenix': phoenixFigImg,
  'su-bishamon': bishamonFigImg,
  'su-fire-dragon': fireDragonFigImg,
  'su-hotei': hoteiFigImg,
  'su-jikininki': jikinikiFigImg,
  'su-koneko': konekoFigImg,
  'su-nure-onna': nureOnnaFigImg,
  'su-oni-of-blood': oniOfBloodFigImg,
  'su-oni-of-souls': oniOfSoulsFigImg,
};

/** Maps clan IDs to their castle image file */
export const CASTLE_IMAGE_MAP: Record<string, string> = {
  koi: castleKoiImg,
  sol: castleSunImg,
  loto: castleLotusImg,
  tortuga: castleTurtleImg,
  libelula: castleDragonflyImg,
  zorro: castleFoxImg,
  bonsai: castleBonsaiImg,
  luna: castleMoonImg,
};

/**
 * Get monster image by card ID, or null if not found.
 *
 * Not all monsters have images yet. Currently covered: all spring monsters
 * and most summer monsters. Autumn monsters (au-benten, au-daikaiju, etc.)
 * and some summer monsters (su-sunakake-baba, su-yurei) do not have image
 * files in src/img/. When this function returns null, the caller should
 * fall back to the generic MonsterIcon SVG component.
 */
export function getMonsterImage(monsterCardId: string): string | null {
  return MONSTER_IMAGE_MAP[monsterCardId] || null;
}

/**
 * Get monster figure/miniature image (_fig suffix) by card ID, or null if not found.
 *
 * These images have transparency and are meant for the region diorama display.
 * They should be displayed without borders or backgrounds. When this function
 * returns null, the caller should fall back to the generic MonsterIcon SVG.
 */
export function getMonsterFigureImage(monsterCardId: string): string | null {
  return MONSTER_FIGURE_MAP[monsterCardId] || null;
}

/** Get castle image by clan ID, or null if not found */
export function getCastleImage(clanId: string): string | null {
  return CASTLE_IMAGE_MAP[clanId] || null;
}

/** Maps province IDs to their region background image */
export const REGION_BG_MAP: Record<string, string> = {
  hokkaido: hokkaidoBg,
  oshu: oshuBg,
  edo: edoBg,
  kanto: kantoBg,
  kansai: kansaiBg,
  nagato: nagatoBg,
  shikoku: shikokuBg,
  kyushu: kyushuBg,
};

/** Get region background image by province ID, or null if not found */
export function getRegionBackground(provinceId: string): string | null {
  return REGION_BG_MAP[provinceId] || null;
}
