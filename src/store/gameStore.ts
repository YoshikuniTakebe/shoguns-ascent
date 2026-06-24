import { create } from 'zustand';
import type { GameState, MandateType } from '../types/game';
import { createInitialGameState, moveForces, proposeAlliance, acceptAlliance, recruitMonster, advancePhase, advancePlayer, resolveBattleBids, drawThreeMandates, chooseMandateFromDrawn, advanceTeaTurn, getCurrentPlayer } from '../utils/gameLogic';

interface GameStore {
  gameState: GameState | null; localPlayerId: string | null; selectedRegion: string | null;
  moveMode: boolean; moveFrom: string | null; ws: WebSocket | null;
  screen: 'menu' | 'lobby' | 'game'; lobbyId: string | null;
  setScreen: (s: 'menu' | 'lobby' | 'game') => void;
  createGame: (players: { name: string; clanId: string }[], mode: 'online' | 'hotseat') => void;
  setGameState: (s: GameState) => void; setLocalPlayerId: (id: string) => void;
  selectRegion: (id: string | null) => void; toggleMoveMode: () => void; setMoveFrom: (id: string | null) => void;
  drawMandates: () => void; chooseMandateAction: (mandate: MandateType) => void;
  doMoveForces: (f: string, t: string, c: number) => void;
  doProposeAlliance: (to: string) => void; doAcceptAlliance: (from: string) => void;
  doRecruitMonster: (id: string) => void; doAdvancePhase: () => void; doAdvancePlayer: () => void;
  doEndTeaTurn: () => void;
  doBid: (amount: number, battleIndex: number) => void;
  connectWebSocket: (url: string) => void; sendAction: (action: unknown) => void; setLobbyId: (id: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null, localPlayerId: null, selectedRegion: null, moveMode: false, moveFrom: null, ws: null, screen: 'menu', lobbyId: null,
  setScreen: (screen) => set({ screen }),
  createGame: (players, mode) => { const state = createInitialGameState(players, mode); set({ gameState: state, localPlayerId: state.players[0].id, screen: 'game' }); },
  setGameState: (state) => set({ gameState: state }), setLocalPlayerId: (id) => set({ localPlayerId: id }),
  selectRegion: (regionId) => set({ selectedRegion: regionId }),
  toggleMoveMode: () => set((s) => ({ moveMode: !s.moveMode, moveFrom: null })),
  setMoveFrom: (regionId) => set({ moveFrom: regionId }),
  drawMandates: () => {
    const { gameState, ws } = get(); if (!gameState) return;
    if (gameState.currentPhase !== 'politics') return;
    if (ws && gameState.mode === 'online') { get().sendAction({ type: 'DRAW_MANDATES', playerId: get().localPlayerId }); return; }
    const ns = drawThreeMandates(gameState);
    set({ gameState: ns });
  },
  chooseMandateAction: (mandate) => {
    const { gameState, localPlayerId, ws } = get(); if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid || gameState.currentPhase !== 'politics') return;
    if (ws && gameState.mode === 'online') { get().sendAction({ type: 'CHOOSE_MANDATE', playerId: apid, payload: { mandate } }); return; }
    const ns = chooseMandateFromDrawn(gameState, mandate, apid);
    set({ gameState: advancePlayer(ns) });
  },
  doMoveForces: (fromRegion, toRegion, count) => {
    const { gameState, localPlayerId, ws } = get(); if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId; if (!apid) return;
    const ns = moveForces(gameState, apid, fromRegion, toRegion, count);
    if (ws && gameState.mode === 'online') get().sendAction({ type: 'MOVE', playerId: apid, payload: { fromRegion, toRegion, count } });
    else set({ gameState: ns, moveMode: false, moveFrom: null });
  },
  doProposeAlliance: (to) => { const { gameState, localPlayerId } = get(); if (!gameState || !localPlayerId) return; const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId; if (!apid) return; set({ gameState: proposeAlliance(gameState, apid, to) }); },
  doAcceptAlliance: (from) => { const { gameState, localPlayerId } = get(); if (!gameState || !localPlayerId) return; const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId; if (!apid) return; set({ gameState: acceptAlliance(gameState, from, apid) }); },
  doRecruitMonster: (id) => { const { gameState, localPlayerId } = get(); if (!gameState || !localPlayerId) return; const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId; if (!apid) return; set({ gameState: recruitMonster(gameState, apid, id) }); },
  doAdvancePhase: () => { const { gameState } = get(); if (!gameState) return; set({ gameState: advancePhase(gameState) }); },
  doAdvancePlayer: () => { const { gameState } = get(); if (!gameState) return; set({ gameState: advancePlayer(gameState) }); },
  doEndTeaTurn: () => { const { gameState } = get(); if (!gameState) return; set({ gameState: advanceTeaTurn(gameState) }); },
  doBid: (amount, battleIndex) => {
    const { gameState, localPlayerId } = get(); if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState); const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId; if (!apid) return;
    const battle = gameState.activeBattles[battleIndex]; if (!battle) return;
    const ns = { ...gameState, activeBattles: [...gameState.activeBattles] };
    ns.activeBattles[battleIndex] = { ...battle, bids: { ...battle.bids, [apid]: amount } };
    if (battle.participants.every((pid) => ns.activeBattles[battleIndex].bids[pid] !== undefined)) set({ gameState: resolveBattleBids(ns, battleIndex) });
    else set({ gameState: ns });
  },
  connectWebSocket: (url) => {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => { const d = JSON.parse(e.data); switch(d.type) { case 'GAME_STATE': set({ gameState: d.state }); break; case 'PLAYER_ID': set({ localPlayerId: d.playerId }); break; case 'LOBBY_JOINED': set({ lobbyId: d.lobbyId, screen: 'lobby' }); break; case 'GAME_START': set({ gameState: d.state, screen: 'game' }); break; } };
    ws.onclose = () => set({ ws: null }); set({ ws });
  },
  sendAction: (action) => { const { ws, lobbyId } = get(); if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ...(action as object), lobbyId })); },
  setLobbyId: (id) => set({ lobbyId: id }),
}));
