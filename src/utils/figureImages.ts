// Monster card image imports
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

/** Get castle image by clan ID, or null if not found */
export function getCastleImage(clanId: string): string | null {
  return CASTLE_IMAGE_MAP[clanId] || null;
}
