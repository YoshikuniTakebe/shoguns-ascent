import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, DECK_GROUPS, CLAN_INCOME } from '../types/game';
import type { DeckConfig, DeckName } from '../types/game';
import type { TranslationKey } from '../i18n';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';
import { shuffle } from '../utils/gameLogic';

const CLAN_POWERS: Record<string, string> = {
  koi: 'Monedas como Ronin. Al inicio de Guerra cambia Ronin por Monedas. En Contratar Ronin, sus Monedas suman Fuerza.',
  sol: 'Al ganar empate por Honor, gana 1 Moneda + 1 PV. El perdedor pierde 1 Moneda + 1 PV.',
  loto: 'Elige cualquier Orden Politica, sin importar las fichas que robe.',
  tortuga: 'Fortalezas se mueven como figuras y cuentan como 1 de Fuerza.',
  libelula: 'Invoca figuras en cualquier Provincia. Mueve figuras a cualquier Provincia.',
  zorro: 'Al inicio de Guerra, coloca 1 Bushi gratis en cada provincia sin unidades propias.',
  bonsai: 'El coste maximo de cualquier compra es 1 Moneda.',
  luna: 'Todas sus figuras tienen Fuerza 2. Max 2 figuras por provincia y max 2 en Santuarios.',
};

export const MainMenu = () => {
  const { createGame, connectWebSocket, setLobbyId, setScreen, language, setLanguage } = useGameStore();
  const t = useT();
  const [mode, setMode] = useState<'select' | 'hotseat' | 'online'>('select');
  const [pc, setPc] = useState(3);
  const [names, setNames] = useState(
    Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`)
  );
  const [clans, setClans] = useState(CLANS.map(c => c.id));
  const [chosenDeck, setChosenDeck] = useState<DeckName | 'random'>('random');
  const [extraMonsters, setExtraMonsters] = useState<0 | 1 | 2>(0);
  const [url, setUrl] = useState('ws://localhost:3001');
  const [oName, setOName] = useState('');
  const [oClan, setOClan] = useState('koi');
  const [lid, setLid] = useState('');

  const hasSolOrLuna = clans.slice(0, pc).some(id => id === 'sol' || id === 'luna');

  const DECK_NAME_KEYS: Record<DeckName, TranslationKey> = {
    Archway: 'deck.archway',
    Tower: 'deck.tower',
    Teapot: 'deck.teapot',
    Horseman: 'deck.horseman',
    Ship: 'deck.ship',
    Mountain: 'deck.mountain',
  };

  const getDeckConfig = (): DeckConfig => ({
    chosenDeck,
    extraMonsters,
  });

  return (
    <div className="main-menu">
      <div className="language-selector">
        <button
          className={`lang-btn${language === 'en' ? ' active' : ''}`}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          className={`lang-btn${language === 'es' ? ' active' : ''}`}
          onClick={() => setLanguage('es')}
        >
          ES
        </button>
      </div>

      <div className="menu-header">
        <h1 className="game-title">{t('menu.title')}</h1>
        <p className="game-subtitle">{t('menu.subtitle')}</p>
      </div>

      {mode === 'select' && (
        <div className="menu-options">
          <button className="menu-btn" onClick={() => setMode('hotseat')}>
            <span className="btn-icon">&#9876;</span>
            <span className="btn-text">{t('menu.hotseatMode')}</span>
            <span className="btn-desc">{t('menu.hotseatDesc')}</span>
          </button>
          <button className="menu-btn" onClick={() => setMode('online')}>
            <span className="btn-icon">&#9733;</span>
            <span className="btn-text">{t('menu.onlineMode')}</span>
            <span className="btn-desc">{t('menu.onlineDesc')}</span>
          </button>
        </div>
      )}

      {mode === 'hotseat' && (
        <div className="setup-panel">
          <h2>{t('menu.hotseatSetup')}</h2>
          <div className="player-count-select">
            <label>{t('menu.players')}</label>
            <select value={pc} onChange={e => setPc(+e.target.value)}>
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="player-setup-list">
            {Array.from({ length: pc }, (_, i) => {
              const usedClans = clans.slice(0, pc).filter((_, idx) => idx !== i);
              return (
                <div key={i} className="player-setup-row">
                  <div className="player-setup-clan-icon">
                    <ClanShield clanId={clans[i]} size={48} />
                  </div>
                  <input
                    value={names[i]}
                    onChange={e => {
                      const n = [...names];
                      n[i] = e.target.value;
                      setNames(n);
                    }}
                    placeholder={`Player ${i + 1}`}
                  />
                  <select
                    value={clans[i]}
                    onChange={e => {
                      const c = [...clans];
                      c[i] = e.target.value;
                      setClans(c);
                    }}
                  >
                    {CLANS.filter(c => !usedClans.includes(c.id) || c.id === clans[i]).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="setup-actions" style={{ justifyContent: 'flex-start', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                const shuffled = shuffle(CLANS.map(c => c.id));
                setClans(shuffled);
              }}
            >
              &#127922; {t('menu.randomize')}
            </button>
          </div>
          <div className="deck-config-section">
            <h3>{t('deck.config')}</h3>
            <div className="deck-group-selector">
              <label className="deck-config-label">{t('deck.group')}</label>
              <div className="deck-group-options">
                <button
                  className={`deck-group-btn${chosenDeck === 'random' ? ' active' : ''}`}
                  onClick={() => setChosenDeck('random')}
                >
                  &#127922; {t('deck.random')}
                </button>
                {DECK_GROUPS.map(g => (
                  <button
                    key={g}
                    className={`deck-group-btn${chosenDeck === g ? ' active' : ''}`}
                    onClick={() => setChosenDeck(g)}
                  >
                    {t(DECK_NAME_KEYS[g])}
                  </button>
                ))}
              </div>
            </div>
            <div className="deck-monsters-selector">
              <label className="deck-config-label">{t('deck.extraMonsters')}</label>
              <div className="deck-monster-options">
                {([0, 1, 2] as const).map(n => (
                  <button
                    key={n}
                    className={`deck-monster-btn${extraMonsters === n ? ' active' : ''}`}
                    onClick={() => setExtraMonsters(n)}
                  >
                    {n === 0 ? t('deck.none') : n}
                  </button>
                ))}
              </div>
              <span className="deck-config-hint">{t('deck.kickstarterHint')}</span>
            </div>
            {hasSolOrLuna && (
              <div className="deck-config-info">
                &#9962; {t('deck.dynastyNote')}
              </div>
            )}
          </div>
          <div className="setup-actions">
            <button
              className="btn-primary"
              onClick={() =>
                createGame(
                  Array.from({ length: pc }, (_, i) => ({ name: names[i], clanId: clans[i] })),
                  'hotseat',
                  getDeckConfig()
                )
              }
            >
              {t('menu.start')}
            </button>
            <button className="btn-secondary" onClick={() => setMode('select')}>{t('menu.back')}</button>
          </div>
        </div>
      )}

      {mode === 'online' && (
        <div className="setup-panel">
          <h2>{t('menu.onlineSetup')}</h2>
          <div className="online-form">
            <label>{t('menu.server')}</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
            <label>{t('menu.name')}</label>
            <input value={oName} onChange={e => setOName(e.target.value)} placeholder="Your name" />
            <label>{t('menu.clan')}</label>
            <select value={oClan} onChange={e => setOClan(e.target.value)}>
              {CLANS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label>{t('menu.lobbyId')}</label>
            <input value={lid} onChange={e => setLid(e.target.value)} placeholder="Lobby ID" />
          </div>
          <div className="setup-actions">
            <button
              className="btn-primary"
              onClick={() => {
                connectWebSocket(url);
                setTimeout(() => {
                  const { ws } = useGameStore.getState();
                  if (ws) {
                    ws.send(JSON.stringify({ type: 'JOIN_LOBBY', lobbyId: lid, playerName: oName || 'Player', clanId: oClan }));
                    setLobbyId(lid);
                    setScreen('lobby');
                  }
                }, 1000);
              }}
            >
              {t('menu.join')}
            </button>
            <button className="btn-secondary" onClick={() => setMode('select')}>{t('menu.back')}</button>
          </div>
        </div>
      )}

      <div className="menu-footer">
        <p className="clans-title">{t('menu.clans')}</p>
        <div className="clan-preview-list">
          {CLANS.map(c => (
            <div key={c.id} className="clan-preview-seal-wrapper">
              <ClanShield clanId={c.id} size={150} />
              <div className="clan-tooltip" style={{ borderColor: c.color }}>
                <span className="clan-tooltip-name" style={{ color: c.color }}>{c.name}</span>
                <span className="clan-tooltip-stat">Honor inicial: {c.initialHonor}</span>
                <span className="clan-tooltip-stat">Ingresos: {CLAN_INCOME[c.id] ?? 0}</span>
                <span className="clan-tooltip-power">Poder: {CLAN_POWERS[c.id] ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
