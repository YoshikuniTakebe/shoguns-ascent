import { create } from 'zustand';
import type { GameState, MandateType, DeckConfig, SeasonCard } from '../types/game';
import {
  createInitialGameState,
  setupSeason,
  breakAllAlliances,
  proposeAlliance,
  acceptAlliance,
  drawMandateTiles,
  chooseMandateTile,
  lotoChooseActualMandate,
  resolveKamiTurn,
  resolveCurrentKamiReward,
  advanceKamiResolution,
  ryujinBuyCard,
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
  advanceTrainResolution,
  skipMarshalTurn,
  buildFortress,
  recruitPlaceFigure,
  skipRecruitTurn,
  betraySelectFigure,
  skipBetrayTurn,
  advanceHarvestResolution,
} from '../utils/gameLogic';

/**
 * Detects if the given state has transitioned to a war phase with unresolved battles.
 * Returns partial store state to set battleStepPhase if war is active, empty object otherwise.
 */
function detectWarTransition(state: GameState): Partial<{ battleStepPhase: 'popup' | 'bidding' | 'result' | null; battleCurrentBiddingIndex: number }> {
  if (state.currentPhase === 'war' && state.activeBattles.some(b => !b.resolved) && !state.zorroPlacementActive) {
    return { battleStepPhase: 'popup' as const, battleCurrentBiddingIndex: 0 };
  }
  return {};
}

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
  battleStepPhase: 'popup' | 'bidding' | 'result' | null;
  battleCurrentBiddingIndex: number;
  showTrainModal: boolean;
  buildFortressMode: boolean;
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
  setShowTrainModal: (show: boolean) => void;

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
  doProposeAlliance: (to: string, bribeAmount?: number) => void;
  doAcceptAlliance: (from: string) => void;

  // Politics
  doDrawMandateTiles: () => void;
  doChooseMandateTile: (mandate: MandateType) => void;
  doLotoChooseActualMandate: (mandate: MandateType) => void;

  // Buy Season Card (Train mandate)
  doBuySeasonCard: (cardId: string) => void;

  // Skip Train card purchase
  doSkipTrainPurchase: () => void;

  // Marshal mandate actions
  doSkipMarshalTurn: () => void;
  doBuildFortress: (provinceId: string) => void;
  toggleBuildFortressMode: () => void;

  // Recruit mandate actions
  recruitMode: boolean;
  recruitFigureType: 'bushi' | 'shinto';
  toggleRecruitMode: () => void;
  setRecruitFigureType: (figureType: 'bushi' | 'shinto') => void;
  doRecruitPlaceFigure: (provinceId: string) => void;
  doRecruitPlaceTempleShinto: (templeId: string) => void;
  doSkipRecruitTurn: () => void;

  // Betray mandate actions
  betrayMode: boolean;
  toggleBetrayMode: () => void;
  doBetraySelectFigure: (figureId: string, provinceId: string) => void;
  doSkipBetrayTurn: () => void;

  // Harvest acknowledgement
  doAcknowledgeHarvest: () => void;

  // Monster placement actions
  monsterPlacementMode: boolean;
  monsterPlacementCard: SeasonCard | null;
  monsterPlacementPlayerId: string | null;
  monsterPlacementPopupVisible: boolean;
  komainuChoiceVisible: boolean;
  komainuPrayMode: boolean;
  komainuPrayPlayerId: string | null;
  confirmMonsterPlacement: () => void;
  doPlaceMonster: (provinceId: string) => void;
  doKomainuChoosePray: () => void;
  doKomainuChooseMap: () => void;
  doKomainuPlaceAtTemple: (templeId: string) => void;
  cancelMonsterPlacement: () => void;

  // Kami
  doResolveKami: () => void;
  doAcknowledgeKamiReward: () => void;
  doCompleteKamiInteractive: () => void;
  doFujinMove: (fromProvince: string, toProvince: string, figureIds: string[]) => void;
  doFujinDone: () => void;
  doRaijinPlace: (provinceId: string) => void;
  doRyujinBuyCard: (cardId: string) => void;
  doRyujinSkip: () => void;

  // War
  doInitiateWar: () => void;
  doZorroPlaceBushi: (provinceId: string) => void;
  doZorroSkipPlacement: () => void;
  doSubmitWarTacticBids: (provinceId: string, tacticBids: { [tacticId: string]: number }) => void;
  doResolveNextBattle: () => void;
  doAcceptBattlePopup: () => void;

  // Coin Distribution
  doCoinDistributionChoice: (targetPlayerId: string) => void;

  // Cleanup & Winter
  doResolveWinter: () => void;

  // Movement
  doMoveForces: (fromProvinceId: string, toProvinceId: string, figureIds: string[]) => void;

  // Phase/Turn advancement
  doAdvancePhase: () => void;
  doAdvancePlayer: () => void;

  // Turn Popup (hotseat mandate transitions)
  turnPopupPlayer: string | null;
  dismissTurnPopup: () => void;

  // Rule violation feedback
  ruleViolationMessage: string | null;
  setRuleViolationMessage: (msg: string | null) => void;

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
  battleStepPhase: null,
  battleCurrentBiddingIndex: 0,
  showTrainModal: false,
  buildFortressMode: false,
  recruitMode: false,
  recruitFigureType: 'bushi',
  betrayMode: false,
  monsterPlacementMode: false,
  monsterPlacementCard: null,
  monsterPlacementPlayerId: null,
  monsterPlacementPopupVisible: false,
  komainuChoiceVisible: false,
  komainuPrayMode: false,
  komainuPrayPlayerId: null,
  turnPopupPlayer: null,
  ruleViolationMessage: null,
  setRuleViolationMessage: (msg) => set({ ruleViolationMessage: msg }),
  language: (localStorage.getItem('shoguns-ascent-language') as 'en' | 'es') || 'es',
  setLanguage: (lang) => {
    localStorage.setItem('shoguns-ascent-language', lang);
    set({ language: lang });
  },
  setShowTrainModal: (show) => set({ showTrainModal: show }),

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
    set({ gameState: ns, ...(gameState.mode === 'hotseat' ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
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
  doProposeAlliance: (to, bribeAmount) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'FORM_ALLIANCE', playerId: apid, payload: { toPlayerId: to, bribeAmount: bribeAmount || 0 } });
      return;
    }
    let ns = proposeAlliance(gameState, apid, to, bribeAmount || 0);
    // If the proposal resulted in an auto-accept (reverse proposal existed),
    // the current player now has an ally. Advance their tea turn.
    const updatedPlayer = ns.players.find(p => p.id === apid);
    if (ns.currentPhase === 'tea' && updatedPlayer && updatedPlayer.allies.length > 0 && cp && cp.allies.length === 0) {
      ns = advancePlayer(ns);
    }
    set({ gameState: ns, ...(gameState.mode === 'hotseat' && ns.currentPhase === 'tea' ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
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
    let ns = acceptAlliance(gameState, from, apid);
    // Bug fix: After accepting an alliance during tea phase, the player's turn ends immediately
    if (ns.currentPhase === 'tea' && apid === cp?.id) {
      ns = advancePlayer(ns);
    }
    set({ gameState: ns, ...(gameState.mode === 'hotseat' && ns.currentPhase === 'tea' ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
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
    // If Loto entered the two-step choice phase, just update state without advancing
    if (ns.lotoChoicePhase) {
      set({ gameState: ns });
      return;
    }
    // If train or marshal or recruit or betray or harvest mandate is active, wait for resolution before advancing
    if (ns.trainMandateActive || ns.marshalMandateActive || ns.recruitMandateActive || ns.betrayMandateActive || ns.harvestMandateActive) {
      // Auto-enable recruitMode when recruit mandate first activates, betrayMode when betray activates
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, betrayMode: ns.betrayMandateActive, ...(gameState.mode === 'hotseat' && !ns.trainMandateActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
    } else {
      const advanced = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: advanced, ...detectWarTransition(advanced), ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}) });
    }
  },
  doLotoChooseActualMandate: (mandate) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid || gameState.currentPhase !== 'politics') return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'LOTO_CHOOSE_ACTUAL_MANDATE', playerId: apid, payload: { mandate } });
      return;
    }
    const ns = lotoChooseActualMandate(gameState, mandate, apid);
    // If train or marshal or recruit or betray or harvest mandate is active, wait for resolution before advancing
    if (ns.trainMandateActive || ns.marshalMandateActive || ns.recruitMandateActive || ns.betrayMandateActive || ns.harvestMandateActive) {
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, betrayMode: ns.betrayMandateActive, ...(gameState.mode === 'hotseat' && !ns.trainMandateActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
    } else {
      const advanced = advancePlayer(ns);
      set({ gameState: advanced, ...detectWarTransition(advanced), ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}) });
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

    // Check if the bought card is a monster - if so, enter monster placement flow
    const boughtCard = ns.players.find(p => p.id === apid)?.seasonCards.find(c => c.id === cardId);
    if (boughtCard && boughtCard.cardType === 'monster') {
      // Komainu special case: show choice between map and pray
      if (boughtCard.id === 'sp-komainu') {
        set({
          gameState: ns,
          monsterPlacementCard: boughtCard,
          monsterPlacementPlayerId: apid,
          komainuChoiceVisible: true,
          monsterPlacementPopupVisible: false,
          monsterPlacementMode: false,
        });
      } else {
        // Show popup asking where to place the monster
        set({
          gameState: ns,
          monsterPlacementCard: boughtCard,
          monsterPlacementPlayerId: apid,
          monsterPlacementPopupVisible: true,
          monsterPlacementMode: false,
          komainuChoiceVisible: false,
        });
      }
      return;
    }

    // Non-monster card: advance normally
    ns = {
      ...ns,
      trainResolutionIndex: ns.trainResolutionIndex + 1,
      log: [...ns.log],
    };
    ns = advanceTrainResolution(ns);
    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: ns, showTrainModal: false, ...detectWarTransition(ns) });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Skip Train Purchase ---
  doSkipTrainPurchase: () => {
    const { gameState } = get();
    if (!gameState) return;
    let ns = skipTrainPurchase(gameState);
    // If train mandate is now resolved (all players done), advance to next mandate turn
    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: ns, showTrainModal: false, ...detectWarTransition(ns) });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Marshal Mandate Actions ---
  doSkipMarshalTurn: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SKIP_MARSHAL_TURN', playerId: get().localPlayerId });
      return;
    }
    let ns = skipMarshalTurn(gameState);
    if (!ns.marshalMandateActive) {
      ns = advancePlayer(ns);
    }
    // Detect war phase transition and set up battle step phase for hotseat
    set({
      gameState: ns,
      buildFortressMode: false,
      moveMode: false,
      moveFrom: null,
      selectedFigures: [],
      ...detectWarTransition(ns),
      ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}),
    });
  },
  doBuildFortress: (provinceId: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BUILD_FORTRESS', playerId: apid, payload: { provinceId } });
      return;
    }
    const ns = buildFortress(gameState, apid, provinceId);
    set({ gameState: ns, buildFortressMode: false });
  },
  toggleBuildFortressMode: () => set((s) => ({ buildFortressMode: !s.buildFortressMode, moveMode: false, moveFrom: null, selectedFigures: [] })),

  // --- Recruit Mandate Actions ---
  toggleRecruitMode: () => set((s) => ({ recruitMode: !s.recruitMode, moveMode: false, moveFrom: null, selectedFigures: [], buildFortressMode: false, betrayMode: false })),
  setRecruitFigureType: (figureType) => set({ recruitFigureType: figureType }),
  doRecruitPlaceFigure: (provinceId: string) => {
    const { gameState, localPlayerId, recruitFigureType, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RECRUIT_PLACE_FIGURE', playerId: apid, payload: { provinceId, figureType: recruitFigureType } });
      return;
    }
    const ns = recruitPlaceFigure(gameState, apid, provinceId, recruitFigureType);
    // If the state is unchanged (same reference), validation failed - show rule violation
    if (ns === gameState) {
      // Determine the reason for failure
      const player = gameState.players.find(p => p.id === apid);
      const province = gameState.provinces[provinceId];
      let msg = 'No puedes realizar esta accion';
      if (player && province) {
        const isDragonfly = player.clanId === 'libelula';
        if (!isDragonfly) {
          const hasFortress = province.figures.some(f => f.owner === apid && f.type === 'fortress');
          if (!hasFortress) {
            msg = 'No tienes fortaleza en esta provincia';
          } else if (player.clanId === 'luna') {
            const lunaFiguresInProvince = province.figures.filter(f => f.owner === apid && f.type !== 'fortress').length;
            if (lunaFiguresInProvince >= 2) {
              msg = 'Luna: maximo 2 figuras por provincia';
            } else {
              msg = 'Ya has reclutado en esta fortaleza este turno';
            }
          } else {
            msg = 'Ya has reclutado en esta fortaleza este turno';
          }
        }
      }
      set({ ruleViolationMessage: msg });
      return;
    }
    // Auto-advance when placements reach 0
    if (ns.recruitPlacementsRemaining <= 0) {
      let advanced = skipRecruitTurn(ns);
      if (!advanced.recruitMandateActive) {
        advanced = advancePlayer(advanced);
      }
      // Detect war phase transition and set up battle step phase for hotseat
      set({
        gameState: advanced,
        recruitMode: advanced.recruitMandateActive,
        ...detectWarTransition(advanced),
        ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}),
      });
    } else {
      set({ gameState: ns });
    }
  },
  doRecruitPlaceTempleShinto: (templeId: string) => {
    const { gameState, localPlayerId, recruitFigureType } = get();
    if (!gameState || !localPlayerId) return;
    if (recruitFigureType !== 'shinto') return;
    if (!gameState.recruitMandateActive) return;
    if (gameState.recruitPlacementsRemaining <= 0) return;

    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;

    const player = gameState.players.find(p => p.id === apid);
    if (!player || player.shinto <= 0) return;

    const templeIndex = gameState.temples.findIndex(t => t.id === templeId);
    if (templeIndex === -1) return;

    const temple = gameState.temples[templeIndex];
    const shintoInThisTemple = temple.figures.filter(f => f.playerId === apid).length;

    // Luna clan power: max 2 shinto per temple. Non-Luna clans have no per-temple limit.
    if (player.clanId === 'luna') {
      if (shintoInThisTemple >= 2) {
        console.warn(`[Recruit] Luna player ${player.name} already has 2 shinto in ${temple.kamiType} temple`);
        return;
      }
    }

    const figureId = Math.random().toString(36).substring(2, 10);

    // Add shinto figure to the temple
    const updatedTemples = [...gameState.temples];
    updatedTemples[templeIndex] = {
      ...temple,
      figures: [...temple.figures, { playerId: apid, figureId }],
    };

    // Decrement player's shinto count
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === apid) {
        return { ...p, shinto: Math.max(0, p.shinto - 1) };
      }
      return p;
    });

    let ns: GameState = {
      ...gameState,
      temples: updatedTemples,
      players: updatedPlayers,
      recruitPlacementsRemaining: gameState.recruitPlacementsRemaining - 1,
      log: [...gameState.log, `${player.name} places a shinto at ${temple.kamiType} temple`],
    };

    // Auto-advance when placements reach 0
    if (ns.recruitPlacementsRemaining <= 0) {
      let advanced = skipRecruitTurn(ns);
      if (!advanced.recruitMandateActive) {
        advanced = advancePlayer(advanced);
      }
      // Detect war phase transition and set up battle step phase for hotseat
      set({
        gameState: advanced,
        recruitMode: advanced.recruitMandateActive,
        ...detectWarTransition(advanced),
        ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}),
      });
    } else {
      set({ gameState: ns });
    }
  },
  doSkipRecruitTurn: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SKIP_RECRUIT_TURN', playerId: get().localPlayerId });
      return;
    }
    let ns = skipRecruitTurn(gameState);
    if (!ns.recruitMandateActive) {
      ns = advancePlayer(ns);
    }
    // Detect war phase transition and set up battle step phase for hotseat
    const warTransition = detectWarTransition(ns);
    if (Object.keys(warTransition).length > 0) {
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, ...warTransition });
    } else {
      // Auto-enable recruitMode for next player if mandate is still active
      set({
        gameState: ns,
        recruitMode: ns.recruitMandateActive,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}),
      });
    }
  },

  // --- Betray Mandate Actions ---
  toggleBetrayMode: () => set((s) => ({ betrayMode: !s.betrayMode, moveMode: false, moveFrom: null, selectedFigures: [], buildFortressMode: false, recruitMode: false })),
  doBetraySelectFigure: (figureId: string, provinceId: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BETRAY_SELECT_FIGURE', playerId: apid, payload: { figureId, provinceId } });
      return;
    }
    const ns = betraySelectFigure(gameState, apid, figureId, provinceId);
    if (!ns.betrayMandateActive) {
      const advanced = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: advanced, betrayMode: false, ...detectWarTransition(advanced) });
    } else {
      const newCurrentPlayerId = ns.players[ns.currentPlayerIndex]?.id || null;
      set({ gameState: ns, ...(gameState.mode === 'hotseat' ? { turnPopupPlayer: newCurrentPlayerId } : {}) });
    }
  },
  doSkipBetrayTurn: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SKIP_BETRAY_TURN', playerId: get().localPlayerId });
      return;
    }
    let ns = skipBetrayTurn(gameState);
    ns = advancePlayer(ns);
    // Detect war phase transition and set up battle step phase for hotseat
    set({ gameState: ns, betrayMode: false, ...detectWarTransition(ns) });
  },

  // --- Harvest Acknowledgement ---
  doAcknowledgeHarvest: () => {
    const { gameState } = get();
    if (!gameState || !gameState.harvestMandateActive) return;
    let ns = advanceHarvestResolution(gameState);
    if (!ns.harvestMandateActive) {
      // Harvest fully resolved, advance player
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: ns, ...detectWarTransition(ns) });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Monster Placement Actions ---
  confirmMonsterPlacement: () => {
    set({ monsterPlacementPopupVisible: false, monsterPlacementMode: true });
  },

  doPlaceMonster: (provinceId: string) => {
    const { gameState, monsterPlacementCard, monsterPlacementPlayerId } = get();
    if (!gameState || !monsterPlacementCard || !monsterPlacementPlayerId) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    // Place a monster figure in the province
    const figureId = Math.random().toString(36).substring(2, 10);
    const newFigure = { type: 'monster' as const, owner: monsterPlacementPlayerId, id: figureId };
    const updatedProvinces = {
      ...gameState.provinces,
      [provinceId]: {
        ...province,
        figures: [...province.figures, newFigure],
      },
    };

    let ns: GameState = {
      ...gameState,
      provinces: updatedProvinces,
      log: [...gameState.log, `${monsterPlacementCard.name} placed in ${province.name}`],
    };

    // If placing during Ryujin kami resolution, advance kami resolution instead of train
    if (ns.kamiResolutionActive) {
      ns = advanceKamiResolution(ns);
      const clearState = {
        gameState: ns,
        monsterPlacementMode: false,
        monsterPlacementCard: null as SeasonCard | null,
        monsterPlacementPlayerId: null as string | null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      };
      if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        set({ ...clearState, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      } else {
        set(clearState);
      }
      return;
    }

    // Advance train resolution
    ns = {
      ...ns,
      trainResolutionIndex: ns.trainResolutionIndex + 1,
    };
    ns = advanceTrainResolution(ns);

    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({
        gameState: ns,
        showTrainModal: false,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
        ...detectWarTransition(ns),
      });
    } else {
      set({
        gameState: ns,
        showTrainModal: true,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      });
    }
  },

  doKomainuChoosePray: () => {
    const { gameState, monsterPlacementCard, monsterPlacementPlayerId } = get();
    if (!gameState || !monsterPlacementCard || !monsterPlacementPlayerId) return;

    // Enter komainu pray mode: close popup, show temple selection
    const ns: GameState = {
      ...gameState,
      log: [...gameState.log, `${monsterPlacementCard.name} sent to worship at a temple`],
    };

    set({
      gameState: ns,
      komainuChoiceVisible: false,
      monsterPlacementPopupVisible: false,
      monsterPlacementMode: false,
      monsterPlacementCard: null,
      komainuPrayMode: true,
      komainuPrayPlayerId: monsterPlacementPlayerId,
    });
  },

  doKomainuChooseMap: () => {
    // Transition from komainu choice to normal placement popup
    set({ komainuChoiceVisible: false, monsterPlacementPopupVisible: true });
  },

  doKomainuPlaceAtTemple: (templeId: string) => {
    const { gameState, komainuPrayPlayerId } = get();
    if (!gameState || !komainuPrayPlayerId) return;

    // Luna clan power: max 2 figures per temple (non-Luna: max 1)
    const komainuPlayer = gameState.players.find(p => p.id === komainuPrayPlayerId);

    const templeIndex = gameState.temples.findIndex(t => t.id === templeId);
    if (templeIndex === -1) return;

    const temple = gameState.temples[templeIndex];
    const shintoInThisTemple = temple.figures.filter(f => f.playerId === komainuPrayPlayerId).length;

    // Luna clan power: max 2 shinto per temple. Non-Luna clans have no per-temple limit.
    if (komainuPlayer?.clanId === 'luna') {
      if (shintoInThisTemple >= 2) {
        console.warn(`[Komainu] Luna player ${komainuPlayer.name} already has 2 shinto in ${temple.kamiType} temple`);
        return;
      }
    }

    const figureId = Math.random().toString(36).substring(2, 10);

    // Add shinto figure to the temple
    const updatedTemples = [...gameState.temples];
    updatedTemples[templeIndex] = {
      ...temple,
      figures: [...temple.figures, { playerId: komainuPrayPlayerId, figureId }],
    };

    // Komainu itself counts as the shinto figure - do NOT decrement player's shinto reserve
    let ns: GameState = {
      ...gameState,
      temples: updatedTemples,
      log: [...gameState.log, `Komainu placed as shinto at ${temple.kamiType} temple`],
    };

    // If placing during Ryujin kami resolution, advance kami resolution instead of train
    if (ns.kamiResolutionActive) {
      ns = advanceKamiResolution(ns);
      const clearState = {
        gameState: ns,
        komainuPrayMode: false,
        komainuPrayPlayerId: null as string | null,
        monsterPlacementPlayerId: null as string | null,
      };
      if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        set({ ...clearState, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      } else {
        set(clearState);
      }
      return;
    }

    ns = {
      ...ns,
      trainResolutionIndex: gameState.trainResolutionIndex + 1,
    };
    ns = advanceTrainResolution(ns);

    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({
        gameState: ns,
        showTrainModal: false,
        komainuPrayMode: false,
        komainuPrayPlayerId: null,
        monsterPlacementPlayerId: null,
        ...detectWarTransition(ns),
      });
    } else {
      set({
        gameState: ns,
        showTrainModal: true,
        komainuPrayMode: false,
        komainuPrayPlayerId: null,
        monsterPlacementPlayerId: null,
      });
    }
  },

  cancelMonsterPlacement: () => {
    const { gameState, monsterPlacementPlayerId } = get();
    if (!gameState || !monsterPlacementPlayerId) return;

    // Cancel placement - advance train without placing
    let ns: GameState = {
      ...gameState,
      trainResolutionIndex: gameState.trainResolutionIndex + 1,
    };
    ns = advanceTrainResolution(ns);

    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({
        gameState: ns,
        showTrainModal: false,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
        ...detectWarTransition(ns),
      });
    } else {
      set({
        gameState: ns,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      });
    }
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

  doAcknowledgeKamiReward: () => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple) return;

    // If no winner (empty temple), auto-advance without showing anything interactive
    if (!currentTemple.winnerId) {
      let ns = advanceKamiResolution(gameState);
      if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      } else {
        set({ gameState: ns });
      }
      return;
    }

    // Apply the reward for the current temple
    let ns = resolveCurrentKamiReward(gameState);

    // If the reward is interactive (step changed to 'interactive'), wait for player input
    if (ns.kamiResolutionStep === 'interactive') {
      // For fujin, enable moveMode
      if (currentTemple.kamiType === 'fujin') {
        set({ gameState: ns, moveMode: true, moveFrom: null, selectedFigures: [] });
      } else if (currentTemple.kamiType === 'raijin') {
        set({ gameState: ns });
      } else if (currentTemple.kamiType === 'ryujin') {
        set({ gameState: ns });
      } else {
        set({ gameState: ns });
      }
      return;
    }

    // Auto reward applied - advance to next temple
    ns = advanceKamiResolution(ns);

    // If resolution just finished and we are in hotseat, show turn popup for next player
    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns });
    }
  },

  doCompleteKamiInteractive: () => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    let ns = advanceKamiResolution(gameState);

    // If resolution just finished and we are in hotseat, show turn popup for next player
    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [], turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [] });
    }
  },

  doFujinMove: (fromProvinceId: string, toProvinceId: string, figureIds: string[]) => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive || gameState.fujinMovesRemaining <= 0) return;

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    const ns = moveForces(gameState, currentTemple.winnerId, fromProvinceId, toProvinceId, figureIds);
    const remaining = ns.fujinMovesRemaining - 1;
    const updated: GameState = { ...ns, fujinMovesRemaining: remaining };

    if (remaining <= 0) {
      // Auto-complete
      const advanced = advanceKamiResolution(updated);
      if (!advanced.kamiResolutionActive && advanced.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [], turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null });
      } else {
        set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [] });
      }
    } else {
      set({ gameState: updated, moveFrom: null, selectedFigures: [] });
    }
  },

  doFujinDone: () => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    const ns: GameState = { ...gameState, fujinMovesRemaining: 0 };
    const advanced = advanceKamiResolution(ns);

    if (!advanced.kamiResolutionActive && advanced.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [], turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [] });
    }
  },

  doRaijinPlace: (provinceId: string) => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.raijinPlacementActive) return;

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    const player = gameState.players.find(p => p.id === currentTemple.winnerId);
    if (!player || player.bushi <= 0) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    const figureId = Math.random().toString(36).substring(2, 10);
    const newFigure = { type: 'bushi' as const, owner: currentTemple.winnerId, id: figureId };

    const updatedProvinces = {
      ...gameState.provinces,
      [provinceId]: {
        ...province,
        figures: [...province.figures, newFigure],
      },
    };

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === currentTemple.winnerId) {
        return { ...p, bushi: Math.max(0, p.bushi - 1) };
      }
      return p;
    });

    let ns: GameState = {
      ...gameState,
      provinces: updatedProvinces,
      players: updatedPlayers,
      raijinPlacementActive: false,
      log: [...gameState.log, `${player.name} summons a Bushi to ${province.name} (Raijin)`],
    };

    ns = advanceKamiResolution(ns);

    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns });
    }
  },

  doRyujinBuyCard: (cardId: string) => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.ryujinBuyActive) return;

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    // Buy the card at full cost (no issuer discount)
    const ns = ryujinBuyCard(gameState, currentTemple.winnerId, cardId);

    // Check if the bought card is a monster - if so, enter monster placement flow
    const boughtCard = ns.players.find(p => p.id === currentTemple.winnerId)?.seasonCards.find(c => c.id === cardId);
    if (boughtCard && boughtCard.cardType === 'monster') {
      // Komainu special case: show choice between map and pray
      if (boughtCard.id === 'sp-komainu') {
        set({
          gameState: { ...ns, ryujinBuyActive: false },
          monsterPlacementCard: boughtCard,
          monsterPlacementPlayerId: currentTemple.winnerId,
          komainuChoiceVisible: true,
          monsterPlacementPopupVisible: false,
          monsterPlacementMode: false,
        });
      } else {
        // Show popup asking where to place the monster
        set({
          gameState: { ...ns, ryujinBuyActive: false },
          monsterPlacementCard: boughtCard,
          monsterPlacementPlayerId: currentTemple.winnerId,
          monsterPlacementPopupVisible: true,
          monsterPlacementMode: false,
          komainuChoiceVisible: false,
        });
      }
      return;
    }

    // Non-monster card: advance normally
    let updated: GameState = {
      ...ns,
      ryujinBuyActive: false,
    };

    updated = advanceKamiResolution(updated);

    if (!updated.kamiResolutionActive && updated.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: updated, turnPopupPlayer: updated.players[updated.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: updated });
    }
  },

  doRyujinSkip: () => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.ryujinBuyActive) return;

    let ns: GameState = {
      ...gameState,
      ryujinBuyActive: false,
      log: [...gameState.log, 'Ryujin reward skipped'],
    };

    ns = advanceKamiResolution(ns);

    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns });
    }
  },

  // --- War ---
  doInitiateWar: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'INITIATE_WAR', playerId: get().localPlayerId });
      return;
    }
    const ns = initiateWarPhase(gameState);
    if (ns.zorroPlacementActive) {
      // Zorro needs to place first, don't start battles yet
      set({ gameState: ns, battleCurrentBiddingIndex: 0 });
    } else {
      set({ gameState: ns, battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
    }
  },

  doZorroPlaceBushi: (provinceId: string) => {
    const { gameState } = get();
    if (!gameState) return;
    if (!gameState.zorroPlacementActive || !gameState.zorroPlacementPlayerId) return;

    const zorroPlayer = gameState.players.find(p => p.id === gameState.zorroPlacementPlayerId);
    if (!zorroPlayer) return;

    // Validate: province must be a battle province where Zorro has no figures
    const isBattleProvince = gameState.warProvinceSlots.some(s => s.provinceId === provinceId);
    if (!isBattleProvince) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    const hasOwnFigure = province.figures.some(f => f.owner === gameState.zorroPlacementPlayerId);
    if (hasOwnFigure) return;

    if (zorroPlayer.bushi <= 0) return;

    // Place bushi
    const newPlayers = gameState.players.map(p => {
      if (p.id === gameState.zorroPlacementPlayerId) {
        return { ...p, bushi: p.bushi - 1 };
      }
      return p;
    });

    const newFigure = { type: 'bushi' as const, owner: gameState.zorroPlacementPlayerId!, id: `fig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const newProvinces = {
      ...gameState.provinces,
      [provinceId]: { ...province, figures: [...province.figures, newFigure] },
    };

    const newRemaining = gameState.zorroPlacementsRemaining - 1;
    const placementDone = newRemaining <= 0;

    const newLog = [...gameState.log, `${zorroPlayer.name} (Zorro) coloca 1 Bushi en ${province.name}`];

    const ns: GameState = {
      ...gameState,
      players: newPlayers,
      provinces: newProvinces,
      zorroPlacementsRemaining: newRemaining,
      zorroPlacementActive: !placementDone,
      zorroPlacementPlayerId: placementDone ? null : gameState.zorroPlacementPlayerId,
      log: newLog,
    };

    if (placementDone) {
      // Update battle participants to include Zorro in provinces where they now have figures
      const zorroId = ns.zorroPlacementPlayerId ?? gameState.zorroPlacementPlayerId;
      let updatedNs = ns;
      if (zorroId) {
        updatedNs = {
          ...ns,
          activeBattles: ns.activeBattles.map(b => {
            const prov = ns.provinces[b.provinceId];
            const hasFigures = prov?.figures.some(f => f.owner === zorroId);
            if (hasFigures && !b.participants.includes(zorroId)) {
              const participants = [...b.participants, zorroId].sort((a, bb) => {
                const aIdx = ns.turnOrder.indexOf(a);
                const bIdx = ns.turnOrder.indexOf(bb);
                return aIdx - bIdx;
              });
              return { ...b, participants, uncontested: false, winner: undefined };
            }
            return b;
          }),
        };
      }
      set({ gameState: updatedNs, battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
    } else {
      set({ gameState: ns });
    }
  },

  doZorroSkipPlacement: () => {
    const { gameState } = get();
    if (!gameState) return;
    if (!gameState.zorroPlacementActive) return;

    const zorroId = gameState.zorroPlacementPlayerId;
    let ns: GameState = {
      ...gameState,
      zorroPlacementActive: false,
      zorroPlacementPlayerId: null,
      zorroPlacementsRemaining: 0,
    };

    // Update battle participants to include Zorro in provinces where they now have figures
    if (zorroId) {
      ns = {
        ...ns,
        activeBattles: ns.activeBattles.map(b => {
          const prov = ns.provinces[b.provinceId];
          const hasFigures = prov?.figures.some(f => f.owner === zorroId);
          if (hasFigures && !b.participants.includes(zorroId)) {
            const participants = [...b.participants, zorroId].sort((a, bb) => {
              const aIdx = ns.turnOrder.indexOf(a);
              const bIdx = ns.turnOrder.indexOf(bb);
              return aIdx - bIdx;
            });
            return { ...b, participants, uncontested: false, winner: undefined };
          }
          return b;
        }),
      };
    }

    set({ gameState: ns, battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
  },
  doSubmitWarTacticBids: (provinceId, tacticBids) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SUBMIT_WAR_BIDS', playerId: localPlayerId, payload: { provinceId, tacticBids } });
      return;
    }

    // Determine which player is submitting bids
    let apid: string;
    if (gameState.mode === 'hotseat') {
      // In hotseat, the current bidding participant is determined by battleCurrentBiddingIndex
      const battle = gameState.activeBattles.find(b => b.provinceId === provinceId && !b.resolved);
      if (!battle) return;
      apid = battle.participants[get().battleCurrentBiddingIndex];
    } else {
      apid = localPlayerId;
    }
    if (!apid) return;

    let ns = submitWarTacticBids(gameState, provinceId, apid, tacticBids);

    if (gameState.mode === 'hotseat') {
      // In hotseat: after current player bids, check if all done
      if (allBidsSubmitted(ns, provinceId)) {
        ns = resolveNextBattle(ns);
        // Battle resolved, show result popup before advancing
        set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0 });
      } else {
        // More participants need to bid - show popup for next participant
        const { battleCurrentBiddingIndex } = get();
        set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'popup', battleCurrentBiddingIndex: battleCurrentBiddingIndex + 1 });
      }
    } else {
      // Online mode: auto-resolve once all participants have submitted
      if (allBidsSubmitted(ns, provinceId)) {
        ns = resolveNextBattle(ns);
        set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0 });
      } else {
        set({ gameState: ns, warTacticBidsSubmitted: true });
      }
    }
  },
  doResolveNextBattle: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RESOLVE_BATTLE', playerId: get().localPlayerId });
      return;
    }
    set({ gameState: resolveNextBattle(gameState), warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0 });
  },
  doAcceptBattlePopup: () => {
    const { gameState } = get();
    if (!gameState) return;

    // If showing a battle result, dismiss it and move to popup for the next battle
    if (get().battleStepPhase === 'result') {
      set({ battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
      return;
    }

    const currentBattleIndex = gameState.activeBattles.findIndex(b => !b.resolved);
    if (currentBattleIndex === -1) {
      set({ battleStepPhase: null, battleCurrentBiddingIndex: 0 });
      return;
    }

    const battle = gameState.activeBattles[currentBattleIndex];

    if (battle.uncontested) {
      // Mark uncontested battle as resolved (user accepted the popup)
      const updatedBattles = [...gameState.activeBattles];
      updatedBattles[currentBattleIndex] = { ...battle, resolved: true };
      set({
        gameState: { ...gameState, activeBattles: updatedBattles },
        battleStepPhase: 'popup',
        battleCurrentBiddingIndex: 0,
      });
      return;
    }

    // Contested battle: transition from popup to bidding
    set({ battleStepPhase: 'bidding' });
  },

  // --- Coin Distribution ---
  doCoinDistributionChoice: (targetPlayerId) => {
    const { gameState } = get();
    if (!gameState || !gameState.coinDistributionPending) return;

    const pending = gameState.coinDistributionPending;
    if (!pending.losers.includes(targetPlayerId)) return;

    const target = gameState.players.find(p => p.id === targetPlayerId);
    const winner = gameState.players.find(p => p.id === pending.winnerId);
    if (!target || !winner) return;

    const newPlayers = gameState.players.map(p => {
      if (p.id === targetPlayerId) {
        return { ...p, coins: p.coins + 1 };
      }
      return p;
    });

    const newRemainder = pending.remainder - 1;
    const newLog = [...gameState.log, `${winner.name} da 1 moneda extra a ${target.name}`];

    const newState: GameState = {
      ...gameState,
      players: newPlayers,
      log: newLog,
      coinDistributionPending: newRemainder > 0
        ? { ...pending, remainder: newRemainder, distributed: pending.distributed + 1 }
        : null,
    };

    set({ gameState: newState });
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

    // If in Fujin interactive mode, delegate to doFujinMove
    if (gameState.kamiResolutionActive && gameState.fujinMovesRemaining > 0) {
      get().doFujinMove(fromProvinceId, toProvinceId, figureIds);
      return;
    }

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'MOVE_FIGURE', playerId: apid, payload: { fromProvinceId, toProvinceId, figureIds } });
      return;
    }
    const ns = moveForces(gameState, apid, fromProvinceId, toProvinceId, figureIds);
    // During marshal mandate, keep moveMode active so the player can move more figures
    if (ns.marshalMandateActive) {
      set({ gameState: ns, moveFrom: null, selectedFigures: [] });
    } else {
      set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [] });
    }
  },

  // --- Phase/Turn advancement ---
  doAdvancePhase: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ADVANCE_PHASE', playerId: get().localPlayerId });
      return;
    }
    const ns = advancePhase(gameState);
    // Detect war phase transition and set up battle step phase for hotseat
    set({ gameState: ns, ...detectWarTransition(ns), ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
  },
  doAdvancePlayer: () => {
    const { gameState } = get();
    if (!gameState) return;
    const ns = advancePlayer(gameState);
    // Detect war phase transition and set up battle step phase for hotseat
    set({ gameState: ns, ...detectWarTransition(ns), ...(gameState.mode === 'hotseat' && (ns.currentPhase === 'tea' || (gameState.currentPhase === 'tea' && ns.currentPhase === 'politics')) ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
  },

  // --- Turn Popup (hotseat mandate transitions) ---
  dismissTurnPopup: () => set({ turnPopupPlayer: null }),

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
