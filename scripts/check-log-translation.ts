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

console.log('Log translation checks passed.');
