import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, DECK_GROUPS, CLAN_INCOME, KAMI_DATA } from '../types/game';
import type { DeckConfig, DeckName, KamiType } from '../types/game';
import type { TranslationKey } from '../i18n';
import { ClanShield } from './ClanShields';
import { HonorIcon, CoinIcon } from './Icons';
import { useT } from '../i18n';
import { shuffle } from '../utils/gameLogic';
import { getServerWsUrl } from '../config';
import { ConfigModal } from './ConfigModal';
import { AddFriendModal, FriendsListModal, fetchFriends } from './FriendsModal';
import type { Friend } from './FriendsModal';
import { ClanPowerContent } from './ClanPowerTooltip';
import titleImg from '../img/NoboruTaiyo.png';
import typeGameBgImg from '../img/type_game_bg.png';

export const MainMenu = () => {
  const { createGame, connectWebSocket, setLobbyId, setScreen, setAuthInitialMode, language, setLanguage, isAuthenticated, authUser, authToken, logout } = useGameStore();
  const t = useT();
  const [mode, setMode] = useState<'select' | 'hotseat' | 'online' | 'online-create' | 'online-join'>(() => {
    const menuMode = useGameStore.getState().menuMode;
    if (menuMode) {
      useGameStore.setState({ menuMode: null });
      return menuMode;
    }
    return 'select';
  });
  const [pc, setPc] = useState(3);
  const [names, setNames] = useState(
    Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`)
  );
  const [clans, setClans] = useState(CLANS.map(c => c.id));
  const [chosenDeck, setChosenDeck] = useState<DeckName | 'random'>('random');
  const [extraMonsters, setExtraMonsters] = useState<0 | 1 | 2>(0);
  const [kamiMode, setKamiMode] = useState<'random' | 'manual'>('random');
  const [selectedKami, setSelectedKami] = useState<KamiType[]>([]);
  const [kamiUnbound, setKamiUnbound] = useState(false);
  const [hotseatPassword, setHotseatPassword] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);

  const [lid, setLid] = useState('');

  // Create game specific state
  const [createPc, setCreatePc] = useState(3);
  const [createDeck, setCreateDeck] = useState<DeckName | 'random'>('random');
  const [createExtraMonsters, setCreateExtraMonsters] = useState<0 | 1 | 2>(0);
  const [createKamiMode, setCreateKamiMode] = useState<'random' | 'manual'>('random');
  const [createSelectedKami, setCreateSelectedKami] = useState<KamiType[]>([]);
  const [createKamiUnbound, setCreateKamiUnbound] = useState(false);

  const [createMode, setCreateMode] = useState<'manual' | 'random'>('manual');
  const [randomClans, setRandomClans] = useState<string[]>(() => shuffle(CLANS.map(c => c.id)).slice(0, createPc));

  // Task 7: friends + per-slot assignments for online game creation
  const [friends, setFriends] = useState<Friend[]>([]);
  // Clan chosen per player slot (index 0 = you/host). Defaults to distinct clans.
  const [slotClans, setSlotClans] = useState<string[]>(() => CLANS.map(c => c.id));
  // Friend user id assigned per slot (index 0 unused = you). null = open slot.
  const [slotFriends, setSlotFriends] = useState<(string | null)[]>(() => Array(8).fill(null));
  // Friends invited in random mode.
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (authToken) fetchFriends(authToken).then(setFriends);
  }, [authToken]);

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
    kamiUnbound,
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
      <div className="auth-buttons">
        {!isAuthenticated ? (
          <>
            <button className="auth-btn" onClick={() => { setAuthInitialMode('login'); setScreen('auth'); }}>
              {t('auth.login')}
            </button>
            <button className="auth-btn auth-btn-register" onClick={() => { setAuthInitialMode('register'); setScreen('auth'); }}>
              {t('auth.registerButton')}
            </button>
          </>
        ) : (
          <span className="auth-user-info">
            <span className="auth-username">{authUser?.username}</span>
            <button className="friends-btn friends-btn-add" onClick={() => setShowAddFriend(true)} title={t('friends.add')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="7" r="3.5" />
                <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
                <path d="M18 8v6M15 11h6" />
              </svg>
            </button>
            <button className="friends-btn friends-btn-list" onClick={() => setShowFriendsList(true)} title={t('friends.list')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="7" r="3" />
                <circle cx="16" cy="7" r="3" />
                <path d="M2 19c0-3 2.5-5 6-5s6 2 6 5" />
                <path d="M14 14c3.5 0 6 2 6 5" />
              </svg>
            </button>
            {authUser?.isAdmin && (
              <button className="auth-btn auth-btn-config" onClick={() => setShowConfig(true)} title={t('config.title')}>
                &#9881; {t('config.button')}
              </button>
            )}
            <button className="auth-btn auth-btn-logout" onClick={logout}>
              {t('auth.logout')}
            </button>
          </span>
        )}
      </div>

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showFriendsList && <FriendsListModal onClose={() => setShowFriendsList(false)} />}

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
          {isAuthenticated && (
            <button className="menu-btn" onClick={() => setMode('online')} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
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
          )}
          <button className="menu-btn" onClick={() => setScreen('games-lobby')} style={{ backgroundImage: `url(${typeGameBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
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

          <div className="hotseat-password-section">
            <label className="deck-config-label">{t('game.passwordOptional')}</label>
            <input
              type="password"
              className="hotseat-password-input"
              value={hotseatPassword}
              onChange={e => setHotseatPassword(e.target.value)}
              placeholder={t('game.password')}
            />
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
            <label className="kami-unbound-toggle">
              <input type="checkbox" checked={kamiUnbound} onChange={event => setKamiUnbound(event.target.checked)} />
              <span>{t('kami.unbound.enable')}</span>
            </label>
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
                  getDeckConfig(),
                  hotseatPassword || undefined
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

          {/* Player count selector (both modes) */}
          <div className="player-count-select" style={{ marginTop: '1rem' }}>
            <label>{t('menu.players')}</label>
            <select value={createPc} onChange={e => {
              const newPc = +e.target.value;
              setCreatePc(newPc);
              setRandomClans(shuffle(CLANS.map(c => c.id)).slice(0, newPc));
              setInviteFriendIds(prev => prev.slice(0, newPc - 1));
            }}>
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {createMode === 'manual' ? (
            /* Manual mode: one row per player. Slot 0 is you; other slots pick a friend + clan
               (leave a slot as "open" to create an open game anyone can join). */
            <div className="player-setup-list">
              {Array.from({ length: createPc }, (_, i) => {
                const usedClans = slotClans.slice(0, createPc).filter((_, idx) => idx !== i);
                const usedFriends = slotFriends.slice(0, createPc).filter((v, idx) => idx !== i && v);
                const clanColor = CLANS.find(c => c.id === slotClans[i])?.color || '#fff';
                return (
                  <div key={i} className="player-setup-row">
                    <div className="player-setup-clan-icon">
                      <ClanShield clanId={slotClans[i]} size={40} />
                    </div>
                    {i === 0 ? (
                      <span style={{ flex: 1, fontWeight: 'bold', color: clanColor }}>
                        {authUser?.username || t('lobby.you')} ({t('lobby.you')})
                      </span>
                    ) : (
                      <select
                        style={{ flex: 1 }}
                        value={slotFriends[i] ?? ''}
                        onChange={e => {
                          const v = e.target.value || null;
                          setSlotFriends(prev => { const n = [...prev]; n[i] = v; return n; });
                        }}
                      >
                        <option value="">{t('lobby.openGame')}</option>
                        {friends
                          .filter(f => f.id === slotFriends[i] || !usedFriends.includes(f.id))
                          .map(f => (
                            <option key={f.id} value={f.id}>{f.username}</option>
                          ))}
                      </select>
                    )}
                    <select
                      value={slotClans[i]}
                      style={{ color: clanColor }}
                      onChange={e => {
                        const c = [...slotClans]; c[i] = e.target.value; setSlotClans(c);
                      }}
                    >
                      {CLANS.filter(c => !usedClans.includes(c.id) || c.id === slotClans[i]).map(c => (
                        <option key={c.id} value={c.id} style={{ color: c.color }}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {friends.length === 0 && createPc > 1 && (
                <p className="deck-config-hint">{t('friends.empty')}</p>
              )}
            </div>
          ) : (
            /* Random mode: available clan badges + invite friends */
            <>
              <div className="player-setup-list">
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('lobby.availableClans')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {randomClans.map(clanId => {
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
                  })}
                </div>
              </div>
              <div className="player-setup-list">
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('lobby.inviteFriends')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {friends.length === 0 ? (
                    <p className="deck-config-hint">{t('friends.empty')}</p>
                  ) : friends.map(f => {
                    const invited = inviteFriendIds.includes(f.id);
                    const full = !invited && inviteFriendIds.length >= createPc - 1;
                    return (
                      <button
                        key={f.id}
                        className={`deck-group-btn${invited ? ' active' : ''}`}
                        disabled={full}
                        onClick={() => setInviteFriendIds(prev => invited ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                      >
                        {invited ? '✓ ' : ''}{f.username}
                      </button>
                    );
                  })}
                </div>
                <span className="deck-config-hint">
                  {inviteFriendIds.length}/{createPc - 1} {t('lobby.invited')}
                  {createPc - 1 - inviteFriendIds.length > 0 ? ` · ${t('lobby.openSlots', { count: createPc - 1 - inviteFriendIds.length })}` : ''}
                </span>
              </div>
            </>
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
            <label className="kami-unbound-toggle">
              <input type="checkbox" checked={createKamiUnbound} onChange={event => setCreateKamiUnbound(event.target.checked)} />
              <span>{t('kami.unbound.enable')}</span>
            </label>
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
                const playerName = authUser?.username || 'Host';
                const deckConfig = {
                  chosenDeck: createDeck,
                  extraMonsters: createExtraMonsters,
                  selectedKami: createKamiMode === 'manual' && createSelectedKami.length === 4 ? createSelectedKami : undefined,
                  kamiUnbound: createKamiUnbound,
                };

                if (createMode === 'manual') {
                  // Slot 0 is the host (you). Other slots may assign a friend (invited, with a
                  // reserved clan) or be left open (anyone can Join).
                  const availableClans = slotClans.slice(0, createPc);
                  const hostClan = slotClans[0];
                  const invitedUserIds: string[] = [];
                  const invitedClans: Record<string, string> = {};
                  for (let i = 1; i < createPc; i++) {
                    const fid = slotFriends[i];
                    if (fid) {
                      invitedUserIds.push(fid);
                      invitedClans[fid] = slotClans[i];
                    }
                  }
                  connectWebSocket(getServerWsUrl(), (ws) => {
                    ws.send(JSON.stringify({
                      type: 'CREATE_LOBBY',
                      playerName,
                      clanId: hostClan,
                      maxPlayers: createPc,
                      availableClans,
                      deckConfig,
                      kamiMode: createKamiMode,
                      selectedKami: createKamiMode === 'manual' && createSelectedKami.length === 4 ? createSelectedKami : undefined,
                      autoAssignClan: false,
                      invitedUserIds,
                      invitedClans,
                    }));
                  });
                } else {
                  // Random mode: pick a random host clan from the random list
                  const randomHostClan = randomClans[Math.floor(Math.random() * randomClans.length)];
                  const randomInviteClans = randomClans.filter(clanId => clanId !== randomHostClan);
                  const invitedClans = Object.fromEntries(
                    inviteFriendIds.map((friendId, index) => [friendId, randomInviteClans[index]])
                  );
                  connectWebSocket(getServerWsUrl(), (ws) => {
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
                      invitedUserIds: inviteFriendIds,
                      invitedClans,
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
            <label>{t('lobby.gameId')}</label>
            <input value={lid} onChange={e => setLid(e.target.value)} placeholder="Game ID" />
          </div>
          <div className="setup-actions">
            <button
              className="btn-primary"
              onClick={() => {
                const playerName = authUser?.username || 'Player';
                connectWebSocket(getServerWsUrl(), (ws) => {
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
                <span className="clan-tooltip-name" style={{ color: c.color }}>
                  <ClanShield clanId={c.id} size={24} />
                  Clan {c.name}
                </span>
                <span className="clan-tooltip-stat"><HonorIcon size={14} color={c.color} /> {t('menu.initialHonor')} {c.initialHonor}</span>
                <span className="clan-tooltip-stat"><CoinIcon size={14} color={c.color} /> {t('menu.income')} {CLAN_INCOME[c.id] ?? 0}</span>
                <span className="clan-tooltip-power">
                  <span className="clan-tooltip-power-label">{t('clanPower.label')}</span>
                  <span className="clan-tooltip-power-content">
                    <ClanPowerContent clanId={c.id} color={c.color} />
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
