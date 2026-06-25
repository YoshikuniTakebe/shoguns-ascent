import { create } from 'zustand';
import type { GameState, MandateType, DeckConfig } from '../types/game';
import {
  createInitialGameState,
  setupSeason,
  breakAllAlliances,
  proposeAlliance,
  acceptAlliance,
  drawMandateTiles,
  chooseMandateTile,
  resolveKamiTurn,
  initiateWarPhase,
  submitWarTacticBids,
  allBidsSubmitted,
  resolveNextBattle,
  resolveWinter,
  moveForces,
  advancePhase,
  advancePlayer,
  getCurrentPlayer,
  buySeasonCard,
  skipTrainPurchase,
} from '../utils/gameLogic';

interface GameStore {
  gameState: GameState | null;
  localPlayerId: string | null;
  selectedRegion: string | null;
  moveMode: boolean;
  moveFrom: string | null;
  selectedFigures: string[];
  ws: WebSocket | null;
  screen: 'menu' | 'lobby' | 'game';
  lobbyId: string | null;
  currentMandateResolutionIndex: number;
  warTacticBidsSubmitted: boolean;

  // UI actions
  setScreen: (s: 'menu' | 'lobby' | 'game') => void;
  selectRegion: (id: string | null) => void;
  toggleMoveMode: () => void;
  setMoveFrom: (id: string | null) => void;
  setSelectedFigures: (ids: string[]) => void;

  // Game lifecycle
  createGame: (players: { name: string; clanId: string }[], mode: 'online' | 'hotseat', deckConfig?: DeckConfig) => void;
  setGameState: (s: GameState) => void;
  setLocalPlayerId: (id: string) => void;

  // Season Setup
  doSetupSeason: () => void;

  // Tea Ceremony
  doBreakAlliances: () => void;
  doProposeAlliance: (to: string) => void;
  doAcceptAlliance: (from: string) => void;

  // Politics
  doDrawMandateTiles: () => void;
  doChooseMandateTile: (mandate: MandateType) => void;

  // Buy Season Card (Train mandate)
  doBuySeasonCard: (cardId: string) => void;

  // Skip Train card purchase
  doSkipTrainPurchase: () => void;

  // Kami
  doResolveKami: () => void;

  // War
  doInitiateWar: () => void;
  doSubmitWarTacticBids: (provinceId: string, tacticBids: { [tacticId: string]: number }) => void;
  doResolveNextBattle: () => void;

  // Cleanup & Winter
  doResolveWinter: () => void;

  // Movement
  doMoveForces: (fromProvinceId: string, toProvinceId: string, figureIds: string[]) => void;

  // Phase/Turn advancement
  doAdvancePhase: () => void;
  doAdvancePlayer: () => void;

  // Online
  connectWebSocket: (url: string) => void;
  sendAction: (action: unknown) => void;
  setLobbyId: (id: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  selectedRegion: null,
  moveMode: false,
  moveFrom: null,
  selectedFigures: [],
  ws: null,
  screen: 'menu',
  lobbyId: null,
  currentMandateResolutionIndex: 0,
  warTacticBidsSubmitted: false,

  // --- UI Actions ---
  setScreen: (screen) => set({ screen }),
  selectRegion: (regionId) => set({ selectedRegion: regionId }),
  toggleMoveMode: () => set((s) => ({ moveMode: !s.moveMode, moveFrom: null, selectedFigures: [] })),
  setMoveFrom: (regionId) => set({ moveFrom: regionId }),
  setSelectedFigures: (ids) => set({ selectedFigures: ids }),

  // --- Game Lifecycle ---
  createGame: (players, mode, deckConfig) => {
    const state = createInitialGameState(players, mode, undefined, deckConfig);
    set({ gameState: state, localPlayerId: state.players[0].id, screen: 'game' });
  },
  setGameState: (state) => set({ gameState: state }),
  setLocalPlayerId: (id) => set({ localPlayerId: id }),

  // --- Season Setup ---
  doSetupSeason: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SETUP_SEASON', playerId: get().localPlayerId });
      return;
    }
    const ns = setupSeason(gameState, gameState.currentSeason);
    set({ gameState: ns });
  },

  // --- Tea Ceremony ---
  doBreakAlliances: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BREAK_ALLIANCE', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: breakAllAlliances(gameState) });
  },
  doProposeAlliance: (to) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'FORM_ALLIANCE', playerId: apid, payload: { toPlayerId: to } });
      return;
    }
    set({ gameState: proposeAlliance(gameState, apid, to) });
  },
  doAcceptAlliance: (from) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'FORM_ALLIANCE', playerId: apid, payload: { fromPlayerId: from, accept: true } });
      return;
    }
    set({ gameState: acceptAlliance(gameState, from, apid) });
  },

  // --- Politics ---
  doDrawMandateTiles: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (gameState.currentPhase !== 'politics') return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'DRAW_MANDATE_TILES', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: drawMandateTiles(gameState) });
  },
  doChooseMandateTile: (mandate) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid || gameState.currentPhase !== 'politics') return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'CHOOSE_MANDATE', playerId: apid, payload: { mandate } });
      return;
    }
    const ns = chooseMandateTile(gameState, mandate, apid);
    // If train mandate is active, wait for buy/skip before advancing
    if (ns.trainMandateActive) {
      set({ gameState: ns });
    } else {
      set({ gameState: advancePlayer(ns) });
    }
  },

  // --- Buy Season Card (Train mandate) ---
  doBuySeasonCard: (cardId) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BUY_CARD', playerId: apid, payload: { cardId } });
      return;
    }
    let ns = buySeasonCard(gameState, apid, cardId);
    // After buying, clear trainMandateActive and advance to next player
    ns = { ...ns, trainMandateActive: false };
    ns = advancePlayer(ns);
    set({ gameState: ns });
  },

  // --- Skip Train Purchase ---
  doSkipTrainPurchase: () => {
    const { gameState } = get();
    if (!gameState) return;
    let ns = skipTrainPurchase(gameState);
    // After skipping, advance to next player
    ns = advancePlayer(ns);
    set({ gameState: ns });
  },

  // --- Kami ---
  doResolveKami: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RESOLVE_KAMI', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: resolveKamiTurn(gameState) });
  },

  // --- War ---
  doInitiateWar: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'INITIATE_WAR', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: initiateWarPhase(gameState) });
  },
  doSubmitWarTacticBids: (provinceId, tacticBids) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SUBMIT_WAR_BIDS', playerId: apid, payload: { provinceId, tacticBids } });
      return;
    }
    let ns = submitWarTacticBids(gameState, provinceId, apid, tacticBids);
    // In hotseat mode, auto-resolve once all participants have submitted
    if (allBidsSubmitted(ns, provinceId)) {
      ns = resolveNextBattle(ns);
      set({ gameState: ns, warTacticBidsSubmitted: false });
    } else {
      set({ gameState: ns, warTacticBidsSubmitted: true });
    }
  },
  doResolveNextBattle: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RESOLVE_BATTLE', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: resolveNextBattle(gameState), warTacticBidsSubmitted: false });
  },

  // --- Cleanup & Winter ---
  doResolveWinter: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RESOLVE_WINTER', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: resolveWinter(gameState) });
  },

  // --- Movement ---
  doMoveForces: (fromProvinceId, toProvinceId, figureIds) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'MOVE_FIGURE', playerId: apid, payload: { fromProvinceId, toProvinceId, figureIds } });
      return;
    }
    const ns = moveForces(gameState, apid, fromProvinceId, toProvinceId, figureIds);
    set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [] });
  },

  // --- Phase/Turn advancement ---
  doAdvancePhase: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ADVANCE_PHASE', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: advancePhase(gameState) });
  },
  doAdvancePlayer: () => {
    const { gameState } = get();
    if (!gameState) return;
    set({ gameState: advancePlayer(gameState) });
  },

  // --- Online ---
  connectWebSocket: (url) => {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      switch (d.type) {
        case 'GAME_STATE':
          set({ gameState: d.state });
          break;
        case 'PLAYER_ID':
          set({ localPlayerId: d.playerId });
          break;
        case 'LOBBY_JOINED':
          set({ lobbyId: d.lobbyId, screen: 'lobby' });
          break;
        case 'GAME_START':
          set({ gameState: d.state, screen: 'game' });
          break;
      }
    };
    ws.onclose = () => set({ ws: null });
    set({ ws });
  },
  sendAction: (action) => {
    const { ws, lobbyId } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...(action as object), lobbyId }));
    }
  },
  setLobbyId: (id) => set({ lobbyId: id }),
}));
