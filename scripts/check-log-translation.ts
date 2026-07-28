import assert from 'node:assert/strict';
import { localizeLogEntry } from '../src/utils/logTranslations';

const purchase = 'Yoshikuni compra Hotei por 2 monedas (Ryujin)';
assert.equal(localizeLogEntry(purchase, 'es'), purchase, 'Spanish logs must remain canonical');
assert.equal(
  localizeLogEntry(purchase, 'en'),
  'Yoshikuni buys Hotei for 2 Coins (Ryujin)',
  'Season Card purchases must render completely in English',
);

assert.equal(
  localizeLogEntry(
    'Mandato de Reclutar emitido por Yoshikuni - todos los jugadores pueden invocar figuras en sus fortalezas. Emisor y aliado obtienen +1 colocación extra.',
    'en',
  ),
  'Recruit Mandate issued for Yoshikuni - all players may Summon figures at their Strongholds. The Mandate player and their Ally gain +1 extra placement.',
  'Recruit flow entries must render completely in English',
);

assert.equal(localizeLogEntry('--- Turno Kami ---', 'en'), '--- Kami Turn ---');
assert.equal(
  localizeLogEntry('Yoshikuni coloca 1 Bushi extra en Edo (Camino del Kenin)', 'en'),
  'Yoshikuni places 1 extra Bushi in Edo (Path of the Kenin)',
);
assert.match(
  localizeLogEntry('Yoshikuni invoca un shinto en Kansai y lo envia a rezar a Fujin', 'en'),
  /Summons a shinto in Kansai and sends it to worship at Fujin/,
);
assert.match(
  localizeLogEntry('Yoshikuni toma 1 moneda de Rival A, Rival B y pierde Honor una vez (Camino del Mono)', 'en'),
  /takes 1 Coin from Rival A, Rival B and loses Honor once \(Path of the Monkey\)/,
);
assert.match(
  localizeLogEntry('Yoshikuni gana 2 Honor y 2 PV por tomar un rehen (2 copias de Sinceridad)', 'en'),
  /gains 2 Honor and 2 VP for taking a Hostage \(2 copies of Sincerity\)/,
);

console.log('Log translation checks passed.');
