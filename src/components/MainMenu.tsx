import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, DECK_GROUPS } from '../types/game';
import type { DeckConfig, DeckName } from '../types/game';
import { ClanShield } from './ClanShields';
import { DaimyoPortrait } from './DaimyoPortraits';

export const MainMenu = () => {
  const { createGame, connectWebSocket, setLobbyId, setScreen } = useGameStore();
  const [mode, setMode] = useState<'select' | 'hotseat' | 'online'>('select');
  const [pc, setPc] = useState(3);
  const [names, setNames] = useState(
    Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`)
  );
  const [clans, setClans] = useState(CLANS.map(c => c.id));
  const [chosenDeck, setChosenDeck] = useState<DeckName | 'random'>('random');
  const [kickstarterCards, setKickstarterCards] = useState<0 | 1 | 2>(0);
  const [monsterPackCards, setMonsterPackCards] = useState<0 | 1 | 2>(0);
  const [url, setUrl] = useState('ws://localhost:3001');
  const [oName, setOName] = useState('');
  const [oClan, setOClan] = useState('koi');
  const [lid, setLid] = useState('');

  const hasSolOrLuna = clans.slice(0, pc).some(id => id === 'sol' || id === 'luna');

  const getDeckConfig = (): DeckConfig => ({
    chosenDeck,
    kickstarterCards,
    monsterPackCards,
  });

  return (
    <div className="main-menu">
      <div className="menu-header">
        <h1 className="game-title">SHOGUN&apos;S ASCENT</h1>
        <p className="game-subtitle">A Game of War, Honor &amp; Betrayal in Feudal Japan</p>
      </div>

      {mode === 'select' && (
        <div className="menu-options">
          <button className="menu-btn" onClick={() => setMode('hotseat')}>
            <span className="btn-icon">&#9876;</span>
            <span className="btn-text">Hotseat Mode</span>
            <span className="btn-desc">Same device, taking turns</span>
          </button>
          <button className="menu-btn" onClick={() => setMode('online')}>
            <span className="btn-icon">&#9733;</span>
            <span className="btn-text">Online Mode</span>
            <span className="btn-desc">Play over the network</span>
          </button>
        </div>
      )}

      {mode === 'hotseat' && (
        <div className="setup-panel">
          <h2>Hotseat Setup</h2>
          <div className="player-count-select">
            <label>Players:</label>
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
                    <ClanShield clanId={clans[i]} size={24} />
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
          <div className="deck-config-section">
            <h3>Deck Configuration</h3>
            <div className="deck-config-row">
              <label>Deck Group:</label>
              <select value={chosenDeck} onChange={e => setChosenDeck(e.target.value as DeckName | 'random')}>
                <option value="random">Random</option>
                {DECK_GROUPS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="deck-config-row">
              <label>Kickstarter Exclusive cards per season:</label>
              <select value={kickstarterCards} onChange={e => setKickstarterCards(+e.target.value as 0 | 1 | 2)}>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
            <div className="deck-config-row">
              <label>Monster Pack cards per season:</label>
              <select value={monsterPackCards} onChange={e => setMonsterPackCards(+e.target.value as 0 | 1 | 2)}>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
            {hasSolOrLuna && (
              <div className="deck-config-info">
                Dynasty Invasion cards will be auto-included (Sol or Luna clan selected).
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
              Start
            </button>
            <button className="btn-secondary" onClick={() => setMode('select')}>Back</button>
          </div>
        </div>
      )}

      {mode === 'online' && (
        <div className="setup-panel">
          <h2>Online Setup</h2>
          <div className="online-form">
            <label>Server:</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
            <label>Name:</label>
            <input value={oName} onChange={e => setOName(e.target.value)} placeholder="Your name" />
            <label>Clan:</label>
            <select value={oClan} onChange={e => setOClan(e.target.value)}>
              {CLANS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label>Lobby ID:</label>
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
              Join
            </button>
            <button className="btn-secondary" onClick={() => setMode('select')}>Back</button>
          </div>
        </div>
      )}

      <div className="menu-footer">
        <p>Clans:</p>
        <div className="clan-preview-list">
          {CLANS.map(c => (
            <div key={c.id} className="clan-preview" style={{ borderColor: c.color }}>
              <div className="clan-preview-header">
                <ClanShield clanId={c.id} size={32} />
                <span className="clan-name" style={{ color: c.color }}>{c.name}</span>
              </div>
              <div className="clan-preview-body">
                <DaimyoPortrait clanId={c.id} size={56} />
                <span className="clan-honor">Initial Honor: {c.initialHonor}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
