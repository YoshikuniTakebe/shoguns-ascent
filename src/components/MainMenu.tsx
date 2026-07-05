import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, DECK_GROUPS, CLAN_INCOME, KAMI_DATA } from '../types/game';
import type { DeckConfig, DeckName, KamiType } from '../types/game';
import type { TranslationKey } from '../i18n';
import { ClanShield } from './ClanShields';
import { HonorIcon, CoinIcon } from './Icons';
import { useT } from '../i18n';
import { shuffle } from '../utils/gameLogic';
import { WS_BASE } from '../config';
import titleImg from '../img/NoboruTaiyo.png';
import typeGameBgImg from '../img/type_game_bg.png';

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
  const { createGame, connectWebSocket, setLobbyId, setScreen, language, setLanguage, setUsername, isAuthenticated } = useGameStore();
  const t = useT();
  const [mode, setMode] = useState<'select' | 'hotseat' | 'online' | 'online-create' | 'online-join'>('select');
  const [pc, setPc] = useState(3);
  const [names, setNames] = useState(
    Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`)
  );
  const [clans, setClans] = useState(CLANS.map(c => c.id));
  const [chosenDeck, setChosenDeck] = useState<DeckName | 'random'>('random');
  const [extraMonsters, setExtraMonsters] = useState<0 | 1 | 2>(0);
  const [kamiMode, setKamiMode] = useState<'random' | 'manual'>('random');
  const [selectedKami, setSelectedKami] = useState<KamiType[]>([]);
  const [url, setUrl] = useState(WS_BASE);
  const [oName, setOName] = useState('');
  const [lid, setLid] = useState('');

  // Create game specific state
  const [createPc, setCreatePc] = useState(3);
  const [createClans, setCreateClans] = useState(CLANS.map(c => c.id));
  const [createDeck, setCreateDeck] = useState<DeckName | 'random'>('random');
  const [createExtraMonsters, setCreateExtraMonsters] = useState<0 | 1 | 2>(0);
  const [createKamiMode, setCreateKamiMode] = useState<'random' | 'manual'>('random');
  const [createSelectedKami, setCreateSelectedKami] = useState<KamiType[]>([]);
  const [createName, setCreateName] = useState('');
  const [createHostClan, setCreateHostClan] = useState('koi');
  const [createUrl, setCreateUrl] = useState(WS_BASE);
  const [createMode, setCreateMode] = useState<'manual' | 'random'>('manual');
  const [randomClans, setRandomClans] = useState<string[]>(() => shuffle(CLANS.map(c => c.id)).slice(0, createPc));

  // Reset host clan selection when available clans change (issue: stale default)
  const effectiveActiveClans = createMode === 'manual' ? createClans.slice(0, createPc) : randomClans;
  useEffect(() => {
    if (effectiveActiveClans.length > 0 && !effectiveActiveClans.includes(createHostClan)) {
      setCreateHostClan(effectiveActiveClans[0]);
    }
  }, [effectiveActiveClans.join(','), createHostClan]);

  const hasSolOrLuna = clans.slice(0, pc).some(id => id === 'sol' || id === 'luna');

  const toggleKami = (type: KamiType) => {
    setSelectedKami(prev => {
      if (prev.includes(type)) {
        return prev.filter(k => k !== type);
      }
      if (prev.length >= 4) return prev;
      return [...prev, type];
    });
  };

  const DECK_NAME_KEYS: Record<DeckName, TranslationKey> = {
    Archway: 'deck.archway',
    Tower: 'deck.tower',
    Teapot: 'deck.teapot',
    Horseman: 'deck.horseman',
    Ship: 'deck.ship',
    Mountain: 'deck.mountain',
  };

  const DECK_ICONS: Record<DeckName, string> = {
    Archway: '⛩️',
    Tower: '🏯',
    Teapot: '🍵',
    Horseman: '🐴',
    Ship: '⛵',
    Mountain: '⛰️',
  };

  const getDeckConfig = (): DeckConfig => ({
    chosenDeck,
    extraMonsters,
    selectedKami: kamiMode === 'manual' && selectedKami.length === 4 ? selectedKami : undefined,
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
        <img src={titleImg} alt="Noboru Taiyo" style={{ maxWidth: '600px', width: '100%', height: 'auto', objectFit: 'contain' }} />
        <p className="game-subtitle">{t('menu.subtitle')}</p>
      </div>

      {mode === 'select' && (
        <div className="menu-options">
          <button className="menu-btn" onClick={() => setMode('hotseat')} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="7" r="3.5" />
                <circle cx="16" cy="7" r="3.5" />
                <path d="M1 20c0-3.5 3-6 7-6s7 2.5 7 6" opacity="0.7" />
                <path d="M10 20c0-3.5 3-6 7-6s7 2.5 7 6" opacity="0.7" />
              </svg>
            </span>
            <span className="btn-text">{t('menu.hotseatMode')}</span>
            <span className="btn-desc">{t('menu.hotseatDesc')}</span>
          </button>
          <button className="menu-btn" onClick={() => { if (!isAuthenticated) { setScreen('auth'); } else { setMode('online'); } }} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" />
                <ellipse cx="12" cy="12" rx="4.5" ry="10" />
                <path d="M2 12h20" />
                <path d="M4 7h16" />
                <path d="M4 17h16" />
              </svg>
            </span>
            <span className="btn-text">{t('menu.onlineMode')}</span>
            <span className="btn-desc">{t('menu.onlineDesc')}</span>
          </button>
          <button className="menu-btn" onClick={() => { if (!isAuthenticated) { setScreen('auth'); } else { setScreen('games-lobby'); } }} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <span className="btn-text">{t('lobby.gamesLobby')}</span>
            <span className="btn-desc"></span>
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
            <button
              className="btn-randomize"
              onClick={() => {
                const shuffled = shuffle(CLANS.map(c => c.id));
                setClans(shuffled);
              }}
            >
              &#127922; {t('menu.randomize')}
            </button>
          </div>
          <div className="player-setup-list">
            {Array.from({ length: pc }, (_, i) => {
              const usedClans = clans.slice(0, pc).filter((_, idx) => idx !== i);
              const selectedClanColor = CLANS.find(c => c.id === clans[i])?.color || '#fff';
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
                    style={{ color: selectedClanColor }}
                  />
                  <select
                    value={clans[i]}
                    onChange={e => {
                      const c = [...clans];
                      c[i] = e.target.value;
                      setClans(c);
                    }}
                    style={{ color: selectedClanColor }}
                  >
                    {CLANS.filter(c => !usedClans.includes(c.id) || c.id === clans[i]).map(c => (
                      <option key={c.id} value={c.id} style={{ color: c.color }}>{c.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
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
                    {DECK_ICONS[g]} {t(DECK_NAME_KEYS[g])}
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

          <div className="kami-config-section">
            <h3>{t('kami.config')}</h3>
            <div className="kami-mode-selector">
              <button
                className={`deck-group-btn${kamiMode === 'random' ? ' active' : ''}`}
                onClick={() => setKamiMode('random')}
              >
                &#127922; {t('kami.random')}
              </button>
              <button
                className={`deck-group-btn${kamiMode === 'manual' ? ' active' : ''}`}
                onClick={() => setKamiMode('manual')}
              >
                &#9998; {t('kami.manual')}
              </button>
            </div>
            {kamiMode === 'manual' && (
              <div className="kami-selection-panel">
                <span className="kami-selection-counter">
                  {selectedKami.length}/4 {t('kami.selected')}
                </span>
                <div className="kami-selection-grid">
                  {KAMI_DATA.map(kami => {
                    const isSelected = selectedKami.includes(kami.type);
                    return (
                      <button
                        key={kami.type}
                        className={`kami-select-btn${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleKami(kami.type)}
                        title={kami.effect}
                      >
                        {isSelected && (
                          <span className="kami-select-order">{selectedKami.indexOf(kami.type) + 1}</span>
                        )}
                        <span className="kami-select-name">{kami.name}</span>
                        <span className="kami-select-effect">{kami.effect}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="setup-actions">
            <button
              className="btn-primary"
              disabled={kamiMode === 'manual' && selectedKami.length !== 4}
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
          <div className="menu-options" style={{ marginBottom: 0 }}>
            <button className="menu-btn" onClick={() => setMode('online-create')} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </span>
              <span className="btn-text">{t('lobby.createGame')}</span>
              <span className="btn-desc">{t('lobby.createDesc')}</span>
            </button>
            <button className="menu-btn" onClick={() => setMode('online-join')} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
              </span>
              <span className="btn-text">{t('lobby.joinGame')}</span>
              <span className="btn-desc">{t('lobby.joinDesc')}</span>
            </button>
          </div>
          <div className="setup-actions">
            <button className="btn-secondary" onClick={() => setMode('select')}>{t('menu.back')}</button>
          </div>
        </div>
      )}

      {mode === 'online-create' && (
        <div className="setup-panel">
          <h2>{t('lobby.createGame')}</h2>
          <div className="online-form">
            <label>{t('menu.server')}</label>
            <input value={createUrl} onChange={e => setCreateUrl(e.target.value)} />
            <label>{t('menu.name')}</label>
            <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Your name" />
          </div>

          {/* Game Type selector - Manual / Aleatorio */}
          <div className="deck-config-section">
            <h3>{t('lobby.gameType')}</h3>
            <div className="kami-mode-selector">
              <button
                className={`deck-group-btn${createMode === 'manual' ? ' active' : ''}`}
                onClick={() => setCreateMode('manual')}
              >
                &#9998; {t('lobby.manual')}
              </button>
              <button
                className={`deck-group-btn${createMode === 'random' ? ' active' : ''}`}
                onClick={() => {
                  setCreateMode('random');
                  // Only re-roll if randomClans length doesn't match createPc (e.g., player count changed)
                  if (randomClans.length !== createPc) {
                    setRandomClans(shuffle(CLANS.map(c => c.id)).slice(0, createPc));
                  }
                }}
              >
                &#127922; {t('lobby.random')}
              </button>
            </div>
          </div>

          {/* Player count selector - only in random mode */}
          {createMode === 'random' && (
            <div className="player-count-select" style={{ marginTop: '1rem' }}>
              <label>{t('menu.players')}</label>
              <select value={createPc} onChange={e => {
                const newPc = +e.target.value;
                setCreatePc(newPc);
                setRandomClans(shuffle(CLANS.map(c => c.id)).slice(0, newPc));
              }}>
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clan configuration */}
          <div className="player-setup-list">
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('lobby.availableClans')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {createMode === 'manual' ? (
                // Manual mode: interactive clan toggles
                CLANS.map(c => {
                  const isSelected = createClans.slice(0, createPc).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className={`deck-group-btn${isSelected ? ' active' : ''}`}
                      style={{ borderColor: isSelected ? c.color : undefined, color: isSelected ? c.color : undefined }}
                      onClick={() => {
                        const current = createClans.slice(0, createPc);
                        if (current.includes(c.id)) {
                          if (current.length <= 2) return;
                          const filtered = current.filter(id => id !== c.id);
                          const rest = CLANS.map(cl => cl.id).filter(id => !filtered.includes(id));
                          setCreateClans([...filtered, ...rest]);
                          setCreatePc(filtered.length);
                        } else {
                          const newActive = [...current, c.id];
                          const rest = CLANS.map(cl => cl.id).filter(id => !newActive.includes(id));
                          setCreateClans([...newActive, ...rest]);
                          setCreatePc(newActive.length);
                        }
                      }}
                    >
                      <ClanShield clanId={c.id} size={16} /> {c.name}
                    </button>
                  );
                })
              ) : (
                // Random mode: non-interactive badges
                randomClans.map(clanId => {
                  const clan = CLANS.find(c => c.id === clanId);
                  if (!clan) return null;
                  return (
                    <span
                      key={clan.id}
                      className="deck-group-btn active"
                      style={{ borderColor: clan.color, color: clan.color, cursor: 'default', pointerEvents: 'none' }}
                    >
                      <ClanShield clanId={clan.id} size={16} /> {clan.name}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Host clan selector - only in manual mode */}
          {createMode === 'manual' && (
            <div className="online-form">
              <label>{t('menu.clan')} (Host)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClanShield clanId={createHostClan} size={24} />
                <span style={{ fontWeight: 'bold', color: CLANS.find(c => c.id === createHostClan)?.color || '#fff' }}>
                  {CLANS.find(c => c.id === createHostClan)?.name || ''}
                </span>
              </div>
              <select value={createHostClan} onChange={e => setCreateHostClan(e.target.value)}>
                {CLANS.filter(c => effectiveActiveClans.includes(c.id)).map(c => (
                  <option key={c.id} value={c.id} style={{ color: c.color }}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="deck-config-section">
            <h3>{t('deck.config')}</h3>
            <div className="deck-group-selector">
              <label className="deck-config-label">{t('deck.group')}</label>
              <div className="deck-group-options">
                <button
                  className={`deck-group-btn${createDeck === 'random' ? ' active' : ''}`}
                  onClick={() => setCreateDeck('random')}
                >
                  &#127922; {t('deck.random')}
                </button>
                {DECK_GROUPS.map(g => (
                  <button
                    key={g}
                    className={`deck-group-btn${createDeck === g ? ' active' : ''}`}
                    onClick={() => setCreateDeck(g)}
                  >
                    {DECK_ICONS[g]} {t(DECK_NAME_KEYS[g])}
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
                    className={`deck-monster-btn${createExtraMonsters === n ? ' active' : ''}`}
                    onClick={() => setCreateExtraMonsters(n)}
                  >
                    {n === 0 ? t('deck.none') : n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="kami-config-section">
            <h3>{t('kami.config')}</h3>
            <div className="kami-mode-selector">
              <button
                className={`deck-group-btn${createKamiMode === 'random' ? ' active' : ''}`}
                onClick={() => setCreateKamiMode('random')}
              >
                &#127922; {t('kami.random')}
              </button>
              <button
                className={`deck-group-btn${createKamiMode === 'manual' ? ' active' : ''}`}
                onClick={() => setCreateKamiMode('manual')}
              >
                &#9998; {t('kami.manual')}
              </button>
            </div>
            {createKamiMode === 'manual' && (
              <div className="kami-selection-panel">
                <span className="kami-selection-counter">
                  {createSelectedKami.length}/4 {t('kami.selected')}
                </span>
                <div className="kami-selection-grid">
                  {KAMI_DATA.map(kami => {
                    const isSelected = createSelectedKami.includes(kami.type);
                    return (
                      <button
                        key={kami.type}
                        className={`kami-select-btn${isSelected ? ' selected' : ''}`}
                        onClick={() => {
                          setCreateSelectedKami(prev => {
                            if (prev.includes(kami.type)) return prev.filter(k => k !== kami.type);
                            if (prev.length >= 4) return prev;
                            return [...prev, kami.type];
                          });
                        }}
                        title={kami.effect}
                      >
                        {isSelected && (
                          <span className="kami-select-order">{createSelectedKami.indexOf(kami.type) + 1}</span>
                        )}
                        <span className="kami-select-name">{kami.name}</span>
                        <span className="kami-select-effect">{kami.effect}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="setup-actions">
            <button
              className="btn-primary"
              disabled={createKamiMode === 'manual' && createSelectedKami.length !== 4}
              onClick={() => {
                const playerName = createName || 'Host';
                setUsername(playerName);
                const deckConfig = {
                  chosenDeck: createDeck,
                  extraMonsters: createExtraMonsters,
                  selectedKami: createKamiMode === 'manual' && createSelectedKami.length === 4 ? createSelectedKami : undefined,
                };

                if (createMode === 'manual') {
                  const availableClans = createClans.slice(0, createPc);
                  connectWebSocket(createUrl, (ws) => {
                    ws.send(JSON.stringify({
                      type: 'CREATE_LOBBY',
                      playerName,
                      clanId: createHostClan,
                      maxPlayers: createPc,
                      availableClans,
                      deckConfig,
                      kamiMode: createKamiMode,
                      selectedKami: createKamiMode === 'manual' && createSelectedKami.length === 4 ? createSelectedKami : undefined,
                      autoAssignClan: false,
                    }));
                  });
                } else {
                  // Random mode: pick a random host clan from the random list
                  const randomHostClan = randomClans[Math.floor(Math.random() * randomClans.length)];
                  connectWebSocket(createUrl, (ws) => {
                    ws.send(JSON.stringify({
                      type: 'CREATE_LOBBY',
                      playerName,
                      clanId: randomHostClan,
                      maxPlayers: createPc,
                      availableClans: randomClans,
                      deckConfig,
                      kamiMode: createKamiMode,
                      selectedKami: createKamiMode === 'manual' && createSelectedKami.length === 4 ? createSelectedKami : undefined,
                      autoAssignClan: true,
                    }));
                  });
                }
              }}
            >
              {t('lobby.createGame')}
            </button>
            <button className="btn-secondary" onClick={() => setMode('online')}>{t('menu.back')}</button>
          </div>
        </div>
      )}

      {mode === 'online-join' && (
        <div className="setup-panel">
          <h2>{t('lobby.joinGame')}</h2>
          <div className="online-form">
            <label>{t('menu.server')}</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
            <label>{t('menu.name')}</label>
            <input value={oName} onChange={e => setOName(e.target.value)} placeholder="Your name" />
            <label>{t('lobby.gameId')}</label>
            <input value={lid} onChange={e => setLid(e.target.value)} placeholder="Game ID" />
          </div>
          <div className="setup-actions">
            <button
              className="btn-primary"
              onClick={() => {
                const playerName = oName || 'Player';
                setUsername(playerName);
                connectWebSocket(url, (ws) => {
                  ws.send(JSON.stringify({ type: 'JOIN_LOBBY', lobbyId: lid, playerName }));
                  setLobbyId(lid);
                });
              }}
            >
              {t('menu.join')}
            </button>
            <button className="btn-secondary" onClick={() => setMode('online')}>{t('menu.back')}</button>
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
                <span className="clan-tooltip-stat" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HonorIcon size={14} color={c.color} /> Honor inicial: {c.initialHonor}</span>
                <span className="clan-tooltip-stat" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CoinIcon size={14} color={c.color} /> Ingresos: {CLAN_INCOME[c.id] ?? 0}</span>
                <span className="clan-tooltip-power">Poder: {CLAN_POWERS[c.id] ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
