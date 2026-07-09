import { create } from 'zustand';
import type { GameState, MandateType, DeckConfig, SeasonCard, BattleResolutionData, Hostage, FigureType } from '../types/game';
import { SEASON_CARDS_DATA } from '../types/game';
import { API_BASE, WS_BASE } from '../config';
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
  buildFukurokuju,
  recruitPlaceFigure,
  recruitPlaceDaimyo,
  skipRecruitTurn,
  betraySelectFigure,
  skipBetrayTurn,
  advanceHarvestResolution,
  loseHonor,
  gainHonor,
  resolveUncontestedBattles,
  processHostageReturn,
  finalizeCleanupAndAdvance,
  determineTacticWinners,
  applyFireDragonEffect,
} from '../utils/gameLogic';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Checks if a Luna player has at least one valid province to place a monster.
 * A valid province must have a fortress owned by the player and fewer than 2 non-fortress figures.
 */
function lunaHasValidProvince(gameState: GameState, playerId: string): boolean {
  return Object.values(gameState.provinces).some(province => {
    const hasFortress = province.figures.some(f => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
    if (!hasFortress) return false;
    const lunaFigures = province.figures.filter(f => f.owner === playerId && f.type !== 'fortress').length;
    return lunaFigures < 2;
  });
}

/**
 * Detects if the given state has transitioned to a war phase with unresolved battles.
 * Returns partial store state to set battleStepPhase if war is active, empty object otherwise.
 */
function detectWarTransition(state: GameState): Partial<{ battleStepPhase: 'popup' | 'bidding' | 'seppuku-decision' | 'seppuku-result' | 'hostage-selection' | 'ronin-result' | 'result' | null; battleCurrentBiddingIndex: number }> {
  if (state.currentPhase === 'war' && state.activeBattles.some(b => !b.resolved) && !state.zorroPlacementActive && !state.daikaijuPlacementActive && !state.daikaijuSummaryVisible) {
    return { battleStepPhase: 'popup' as const, battleCurrentBiddingIndex: 0 };
  }
  return {};
}

/**
 * Computes war upgrade summary directly from player warUpgrade cards.
 * Mirrors the logic in applyWarUpgrades (gameLogic.ts) to determine bonuses.
 */
function computeWarUpgradeSummary(state: GameState): { playerName: string; clanId: string; bonuses: { cardName: string; resource: string; amount: number }[] }[] {
  const summary: { playerName: string; clanId: string; bonuses: { cardName: string; resource: string; amount: number }[] }[] = [];

  for (const player of state.players) {
    const warUpgradeCards = player.seasonCards.filter((c) => c.cardType === 'warUpgrade');
    if (warUpgradeCards.length === 0) continue;

    const bonuses: { cardName: string; resource: string; amount: number }[] = [];

    for (const card of warUpgradeCards) {
      const baseCardId = card.id.endsWith('-2') ? card.id.slice(0, -2) : card.id;

      switch (baseCardId) {
        case 'sp-way-of-the-shogun': {
          bonuses.push({ cardName: 'Way of the Shogun', resource: 'coins', amount: 3 });
          break;
        }
        case 'sp-way-of-the-righteous': {
          // Take 1 coin from each player with less honor who has coins
          const playerHonorIdx = state.honorTrack.indexOf(player.id);
          let count = 0;
          for (const other of state.players) {
            if (other.id === player.id) continue;
            const otherHonorIdx = state.honorTrack.indexOf(other.id);
            if (otherHonorIdx > playerHonorIdx && other.coins > 0) {
              count++;
            }
          }
          bonuses.push({ cardName: 'Way of the Righteous', resource: 'coins', amount: count });
          break;
        }
        case 'su-way-of-bushido': {
          const virtueCount = player.seasonCards.filter((c) => c.cardType === 'virtue').length;
          bonuses.push({ cardName: 'Way of Bushido', resource: 'coins', amount: 2 });
          bonuses.push({ cardName: 'Way of Bushido', resource: 'vp', amount: 2 * virtueCount });
          break;
        }
        case 'su-way-of-the-ronin': {
          bonuses.push({ cardName: 'Way of the Ronin', resource: 'ronin', amount: 2 });
          break;
        }
        case 'au-way-of-the-moneylender': {
          bonuses.push({ cardName: 'Way of the Moneylender', resource: 'coins', amount: 5 });
          break;
        }
        case 'su-way-of-naginata':
        case 'au-way-of-naginata': {
          bonuses.push({ cardName: 'Way of Naginata', resource: 'effect', amount: 0 });
          break;
        }
        case 'su-way-of-the-ashigaru': {
          bonuses.push({ cardName: 'Way of the Ashigaru', resource: 'effect', amount: 0 });
          break;
        }
        case 'au-way-of-the-katana': {
          bonuses.push({ cardName: 'Way of the Katana', resource: 'effect', amount: 0 });
          break;
        }
        case 'au-way-of-the-keiri': {
          bonuses.push({ cardName: 'Way of the Keiri', resource: 'effect', amount: 0 });
          break;
        }
      }
    }

    if (bonuses.length > 0) {
      summary.push({ playerName: player.name, clanId: player.clanId, bonuses });
    }
  }

  return summary;
}

/**
 * Wraps war transition detection with the war phase popup.
 * If a war transition is detected, shows warPhasePopupVisible instead of immediately starting battles.
 */
function detectWarTransitionWithPopup(state: GameState): Record<string, unknown> {
  // Guard: don't show war popup while kami summary is still visible
  if (state.kamiSummaryVisible) return {};
  const warTransition = detectWarTransition(state);
  if (Object.keys(warTransition).length > 0) {
    const summary = computeWarUpgradeSummary(state);
    return { warPhasePopupVisible: true, warPhaseUpgradeSummary: summary };
  }
  return {};
}

/**
 * After advancePlayer, detect if kamiPhasePopupPending is set and return popup state.
 */
function detectKamiPopupPending(ns: GameState): Record<string, unknown> {
  if (ns.kamiPhasePopupPending) {
    return { kamiPhasePopupVisible: true, kamiPendingTemples: ns.kamiResolutionTemples };
  }
  return {};
}

/**
 * Attaches resolution data to the current unresolved battle so resolveNextBattle can use it.
 */
function attachResolutionData(state: GameState, resData: BattleResolutionData): GameState {
  const unresolvedIdx = state.activeBattles.findIndex(b => !b.resolved && !b.uncontested);
  if (unresolvedIdx === -1) return state;
  const updatedBattles = state.activeBattles.map((b, i) => {
    if (i === unresolvedIdx) return { ...b, resolutionData: resData };
    return b;
  });
  return { ...state, activeBattles: updatedBattles };
}

interface GameStore {
  gameState: GameState | null;
  localPlayerId: string | null;
  username: string;
  authToken: string | null;
  authUser: { id: string; username: string; email: string; isAdmin?: boolean } | null;
  isAuthenticated: boolean;
  selectedRegion: string | null;
  moveMode: boolean;
  moveFrom: string | null;
  selectedFigures: string[];
  ws: WebSocket | null;
  screen: 'menu' | 'lobby' | 'game' | 'games-lobby' | 'replay' | 'auth';
  authInitialMode: 'login' | 'register';
  setAuthInitialMode: (mode: 'login' | 'register') => void;
  menuMode: 'select' | 'online' | 'online-create' | 'online-join' | null;
  lobbyId: string | null;
  currentMandateResolutionIndex: number;
  warTacticBidsSubmitted: boolean;
  battleStepPhase: 'popup' | 'bidding' | 'seppuku-decision' | 'seppuku-result' | 'hostage-selection' | 'ronin-result' | 'result' | null;
  battleCurrentBiddingIndex: number;
  battleResolutionData: import('../types/game').BattleResolutionData | null;
  selectedHostageTarget: { owner: string; figureId: string; figureType: string; figureName: string } | null;
  showTrainModal: boolean;
  buildFortressMode: boolean;
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
  setShowTrainModal: (show: boolean) => void;

  // UI actions
  setScreen: (s: 'menu' | 'lobby' | 'game' | 'games-lobby' | 'replay' | 'auth') => void;
  exitGame: () => void;
  selectRegion: (id: string | null) => void;
  toggleMoveMode: () => void;
  setMoveFrom: (id: string | null) => void;
  setSelectedFigures: (ids: string[]) => void;

  // Game lifecycle
  createGame: (players: { name: string; clanId: string }[], mode: 'online' | 'hotseat', deckConfig?: DeckConfig, password?: string) => void;
  setGameState: (s: GameState) => void;
  setLocalPlayerId: (id: string) => void;
  setUsername: (name: string) => void;

  // Auth actions
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // Season Setup
  doSetupSeason: () => void;
  doTeaReady: () => void;

  // Tea Ceremony
  doBreakAlliances: () => void;
  doProposeAlliance: (to: string, bribeAmount?: number, requestAmount?: number) => void;
  doAcceptAlliance: (from: string) => void;
  doTeaProposeAlliance: (toPlayerId: string, bribeAmount?: number, requestAmount?: number) => void;
  doTeaAcceptAlliance: (fromPlayerId: string) => void;
  doTeaRejectAlliance: (fromPlayerId: string) => void;
  doTeaOptOut: () => void;

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
  buildFukurokujuMode: boolean;
  toggleBuildFukurokujuMode: () => void;
  doBuildFukurokuju: (provinceId: string) => void;

  // Recruit mandate actions
  recruitMode: boolean;
  recruitFigureType: 'bushi' | 'shinto' | 'monster' | 'daimyo';
  toggleRecruitMode: () => void;
  setRecruitFigureType: (figureType: 'bushi' | 'shinto' | 'monster' | 'daimyo') => void;
  doRecruitPlaceFigure: (provinceId: string) => void;
  doRecruitPlaceTempleShinto: (templeId: string) => void;
  doSkipRecruitTurn: () => void;
  recruitMonsterSelectionVisible: boolean;
  recruitDaimyoSelectionVisible: boolean;
  recruitPendingProvinceId: string | null;
  doRecruitConfirmMonster: (monsterCardId: string) => void;
  doRecruitConfirmDaimyo: (daimyoType: string) => void;
  doRecruitDismissSelection: () => void;

  // Betray mandate actions
  betrayMode: boolean;
  toggleBetrayMode: () => void;
  doBetraySelectFigure: (figureId: string, provinceId: string) => void;
  doSkipBetrayTurn: () => void;
  betrayMonsterSelectionVisible: boolean;
  betrayMonsterSelectionProvinceId: string | null;
  betrayMonsterSelectionFigureId: string | null;
  doBetrayConfirmMonster: (monsterCardId: string) => void;
  doBetrayDismissMonsterSelection: () => void;

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
  komainuPrayCardId: string | null;
  confirmMonsterPlacement: () => void;
  doPlaceMonster: (provinceId: string) => void;
  doKomainuChoosePray: () => void;
  doKomainuChooseMap: () => void;
  doKomainuPlaceAtTemple: (templeId: string, replaceFigureId?: string) => void;
  cancelMonsterPlacement: () => void;

  // Monster no placement popup (Luna - no valid province)
  monsterNoPlacementPopupVisible: boolean;
  dismissMonsterNoPlacement: () => void;

  // Kami
  doResolveKami: () => void;
  doAcknowledgeKamiReward: () => void;
  doCompleteKamiInteractive: () => void;
  doFujinMove: (fromProvince: string, toProvince: string, figureIds: string[]) => void;
  doFujinDone: () => void;
  doFujinUndo: () => void;
  fujinPreMoveState: GameState | null;
  doRaijinPlace: (provinceId: string) => void;
  doRaijinConfirm: () => void;
  doRaijinUndo: () => void;
  raijinPrePlaceState: GameState | null;
  doRyujinBuyCard: (cardId: string) => void;
  doRyujinSkip: () => void;

  // War
  doInitiateWar: () => void;
  doZorroPlaceBushi: (provinceId: string) => void;
  doZorroSkipPlacement: () => void;
  doSubmitWarTacticBids: (provinceId: string, tacticBids: { [tacticId: string]: number }) => void;
  doResolveNextBattle: () => void;
  doAcceptBattlePopup: () => void;
  doSeppukuDecision: (accept: boolean) => void;
  doSeppukuResultAccept: () => void;
  doHostageSelect: (figureId: string) => void;
  doHostageConfirm: () => void;
  doHostageSkip: () => void;
  doRoninResultAccept: () => void;

  // Coin Distribution
  doCoinDistributionChoice: (targetPlayerId: string) => void;
  doCoinDistributionDismiss: () => void;

  // Cleanup & Winter
  doResolveWinter: () => void;

  // Movement
  doMoveForces: (fromProvinceId: string, toProvinceId: string, figureIds: string[]) => void;

  // Phase/Turn advancement
  doAdvancePhase: () => void;
  doAdvancePlayer: () => void;

  // Turn Popup (hotseat mandate transitions)
  turnPopupPlayer: string | null;
  turnPopupDismissedForIndex: number | null;
  dismissTurnPopup: () => void;

  // Kami Phase Popup
  kamiPhasePopupVisible: boolean;
  kamiPendingTemples: GameState['kamiResolutionTemples'] | null;
  dismissKamiPhasePopup: () => void;
  doKamiPhaseReady: () => void;
  doKamiSummaryReady: () => void;
  kamiTurnPopupShownForIndex: number | null;
  kamiSummaryVisibleSince: number | null;

  // War Phase Popup
  warPhasePopupVisible: boolean;
  warPhaseUpgradeSummary: { playerName: string; clanId: string; bonuses: { cardName: string; resource: string; amount: number }[] }[];
  dismissWarPhasePopup: () => void;

  // Daikaiju Placement
  doDaikaijuPlaceProvince: (provinceId: string) => void;
  doDaikaijuSummaryReady: () => void;

  // War Summary Popup (end of war phase)
  warSummaryVisible: boolean;
  dismissWarSummaryPopup: () => void;

  // Interactive cleanup (hostage return + tea ceremony)
  doHostageReturnAccepted: () => void;
  doCleanupTeaCeremonyReady: () => void;

  // Battle result acceptance for online mode
  doAcceptBattleResultOnline: () => void;

  // Undo mandate state
  undoMandateState: GameState | null;
  doUndoMandate: () => void;

  // Marshal pending moves/fortresses for online buffering
  marshalPendingMoves: { fromProvinceId: string; toProvinceId: string; figureIds: string[] }[];
  marshalPendingFortresses: { provinceId: string; fukurokuju?: boolean }[];

  // Map peek during bidding
  biddingMapPeek: boolean;
  setBiddingMapPeek: (v: boolean) => void;

  // Rule violation feedback
  ruleViolationMessage: string | null;
  setRuleViolationMessage: (msg: string | null) => void;

  // Jinmenju
  jinmenjuSummonActive: boolean;
  doJinmenjuActivate: () => void;
  doJinmenjuPlace: (provinceId: string) => void;
  doJinmenjuPlaceTemple: (templeId: string) => void;
  doJinmenjuCancel: () => void;

  // Trade
  tradeModalOpen: boolean;
  setTradeModalOpen: (open: boolean) => void;
  doSendTrade: (toPlayerId: string, offerCoins: number, offerRonin: number, requestCoins: number, requestRonin: number) => void;
  doAcceptTrade: (offerId: string) => void;
  doRejectTrade: (offerId: string) => void;

  // Finished game viewing
  viewingFinishedGame: boolean;
  loadFinishedGameScore: (gameId: string) => Promise<void>;

  // Persistence
  persistentGameId: string | null;
  saveSnapshot: () => Promise<void> | void;

  // Replay
  replayGameId: string | null;
  replaySnapshots: { index: number; state: GameState; description: string; phase: string; season: string }[];
  replayCurrentIndex: number;
  replayTotalSnapshots: number;
  replayGameMetadata: { id: string; name: string; players: { name: string; clanId: string }[]; winner: string | null } | null;
  loadReplayGame: (gameId: string) => Promise<void>;
  replayNext: () => void;
  replayPrev: () => void;
  replayNextKami: () => void;
  replayPrevKami: () => void;
  replayNextBattle: () => void;
  replayPrevBattle: () => void;
  resumeGame: (gameId: string) => Promise<void>;

  // Online
  connectWebSocket: (url: string, onOpen?: (ws: WebSocket) => void) => void;
  sendAction: (action: unknown) => void;
  setLobbyId: (id: string) => void;
  lobbyState: { id: string; name: string; host: string; players: { id: string; name: string; clanId: string }[]; maxPlayers: number; started: boolean; availableClans: string[]; deckConfig: unknown; kamiMode: string; autoAssignClan?: boolean } | null;
  sendCreateLobby: (params: { playerName: string; clanId: string; maxPlayers: number; availableClans: string[]; deckConfig: unknown; kamiMode: string; selectedKami?: string[] }) => void;
  sendSelectClan: (lobbyId: string, clanId: string) => void;

  // Rejoin
  rejoinWaitingVisible: boolean;
  rejoinPlayerStatuses: { id: string; name: string; clanId: string; connected: boolean }[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  username: localStorage.getItem('shoguns-ascent-username') || '',
  authToken: localStorage.getItem('shoguns-ascent-authToken') || null,
  authUser: (() => {
    try {
      const stored = localStorage.getItem('shoguns-ascent-authUser');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })(),
  isAuthenticated: !!localStorage.getItem('shoguns-ascent-authToken'),
  selectedRegion: null,
  moveMode: false,
  moveFrom: null,
  selectedFigures: [],
  ws: null,
  screen: 'menu',
  authInitialMode: 'login',
  menuMode: null,
  lobbyId: null,
  currentMandateResolutionIndex: 0,
  warTacticBidsSubmitted: false,
  battleStepPhase: null,
  battleCurrentBiddingIndex: 0,
  battleResolutionData: null,
  selectedHostageTarget: null,
  showTrainModal: false,
  buildFortressMode: false,
  buildFukurokujuMode: false,
  recruitMode: false,
  recruitFigureType: 'bushi',
  recruitMonsterSelectionVisible: false,
  recruitDaimyoSelectionVisible: false,
  recruitPendingProvinceId: null,
  betrayMode: false,
  monsterPlacementMode: false,
  monsterPlacementCard: null,
  monsterPlacementPlayerId: null,
  monsterPlacementPopupVisible: false,
  monsterNoPlacementPopupVisible: false,
  komainuChoiceVisible: false,
  komainuPrayMode: false,
  komainuPrayPlayerId: null,
  komainuPrayCardId: null,
  turnPopupPlayer: null,
  turnPopupDismissedForIndex: null,
  jinmenjuSummonActive: false,
  tradeModalOpen: false,
  viewingFinishedGame: false,
  persistentGameId: null,
  replayGameId: null,
  replaySnapshots: [],
  replayCurrentIndex: 0,
  replayTotalSnapshots: 0,
  replayGameMetadata: null,
  ruleViolationMessage: null,
  setRuleViolationMessage: (msg) => set({ ruleViolationMessage: msg }),
  doJinmenjuActivate: () => {
    const { gameState } = get();
    if (gameState?.jinmenjuUsedThisMandate) return;
    set({ jinmenjuSummonActive: true, recruitMode: true });
  },
  doJinmenjuPlace: (provinceId: string) => {
    const { gameState, recruitFigureType } = get();
    if (!gameState) return;
    const cp = getCurrentPlayer(gameState);
    if (!cp) return;

    // Find the province where Jinmenju is placed
    const jinmenjuProvince = Object.values(gameState.provinces).find(prov =>
      prov.figures.some(f => f.owner === cp.id && f.monsterCardId === 'sp-jinmenju')
    );
    if (!jinmenjuProvince || jinmenjuProvince.id !== provinceId) return;

    const player = gameState.players.find(p => p.id === cp.id);
    if (!player) return;

    // Check reserve
    if (recruitFigureType === 'bushi' && player.bushi <= 0) return;
    if (recruitFigureType === 'shinto' && player.shinto <= 0) return;

    // Luna clan power: max 2 figures per province (excluding fortresses)
    if (player.clanId === 'luna') {
      const lunaFiguresInProvince = jinmenjuProvince.figures.filter(
        (f) => f.owner === cp.id && f.type !== 'fortress'
      ).length;
      if (lunaFiguresInProvince >= 2) return;
    }

    const figureId = Math.random().toString(36).substring(2, 10);
    const newFigure = { type: recruitFigureType as FigureType, owner: cp.id, id: figureId };

    // Place figure
    const updatedProvinces = { ...gameState.provinces };
    updatedProvinces[provinceId] = {
      ...updatedProvinces[provinceId],
      figures: [...updatedProvinces[provinceId].figures, newFigure],
    };

    // Decrement reserve
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === cp.id) {
        if (recruitFigureType === 'bushi') return { ...p, bushi: p.bushi - 1 };
        if (recruitFigureType === 'shinto') return { ...p, shinto: p.shinto - 1 };
      }
      return p;
    });

    let ns: GameState = {
      ...gameState,
      provinces: updatedProvinces,
      players: updatedPlayers,
      honorTrack: [...gameState.honorTrack],
      jinmenjuUsedThisMandate: true,
      log: [...gameState.log, `${player.name} invoca un ${recruitFigureType} en ${jinmenjuProvince.name} usando Jinmenju (pierde {h})`],
    };

    // Lose honor
    loseHonor(ns, cp.id);

    set({ gameState: ns, jinmenjuSummonActive: false });
  },
  doJinmenjuPlaceTemple: (templeId: string) => {
    const { gameState, recruitFigureType } = get();
    if (!gameState) return;
    if (recruitFigureType !== 'shinto') return;
    const cp = getCurrentPlayer(gameState);
    if (!cp) return;

    const player = gameState.players.find(p => p.id === cp.id);
    if (!player || player.shinto <= 0) return;

    const templeIndex = gameState.temples.findIndex(t => t.id === templeId);
    if (templeIndex === -1) return;

    const temple = gameState.temples[templeIndex];
    const shintoInThisTemple = temple.figures.filter(f => f.playerId === cp.id).length;

    // Luna clan power: max 2 shinto per temple
    if (player.clanId === 'luna' && shintoInThisTemple >= 2) return;

    const figureId = Math.random().toString(36).substring(2, 10);

    // Add shinto figure to the temple
    const updatedTemples = [...gameState.temples];
    updatedTemples[templeIndex] = {
      ...temple,
      figures: [...temple.figures, { playerId: cp.id, figureId }],
    };

    // Decrement player's shinto count
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === cp.id) {
        return { ...p, shinto: Math.max(0, p.shinto - 1) };
      }
      return p;
    });

    let ns: GameState = {
      ...gameState,
      temples: updatedTemples,
      players: updatedPlayers,
      honorTrack: [...gameState.honorTrack],
      jinmenjuUsedThisMandate: true,
      log: [...gameState.log, `${player.name} coloca un shinto en santuario de ${capitalize(temple.kamiType)} usando Jinmenju (pierde {h})`],
    };

    // Lose honor
    loseHonor(ns, cp.id);

    set({ gameState: ns, jinmenjuSummonActive: false });
  },
  doJinmenjuCancel: () => {
    set({ jinmenjuSummonActive: false });
  },

  // --- Trade System ---
  setTradeModalOpen: (open) => set({ tradeModalOpen: open }),
  doSendTrade: (toPlayerId, offerCoins, offerRonin, requestCoins, requestRonin) => {
    const { gameState } = get();
    if (!gameState) return;
    if (gameState.currentPhase !== 'politics') return;
    const cp = gameState.players[gameState.currentPlayerIndex];
    if (!cp) return;
    // Validate sender has enough resources
    if (cp.coins < offerCoins || cp.ronin < offerRonin) return;
    // At least something must be offered or requested
    if (offerCoins === 0 && offerRonin === 0 && requestCoins === 0 && requestRonin === 0) return;
    const tradeOffer = {
      id: Math.random().toString(36).substring(2, 10),
      fromPlayerId: cp.id,
      toPlayerId,
      offerCoins,
      offerRonin,
      requestCoins,
      requestRonin,
      status: 'pending' as const,
    };
    const ns = { ...gameState, tradeOffers: [...gameState.tradeOffers, tradeOffer] };
    set({ gameState: ns, tradeModalOpen: false });
  },
  doAcceptTrade: (offerId) => {
    const { gameState } = get();
    if (!gameState) return;
    if (gameState.currentPhase !== 'politics') return;
    const offer = gameState.tradeOffers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;
    const sender = gameState.players.find(p => p.id === offer.fromPlayerId);
    const recipient = gameState.players.find(p => p.id === offer.toPlayerId);
    if (!sender || !recipient) return;
    // Validate resources
    if (sender.coins < offer.offerCoins || sender.ronin < offer.offerRonin) {
      // Sender no longer has enough - remove the offer and notify
      const ns = { ...gameState, tradeOffers: gameState.tradeOffers.filter(o => o.id !== offerId) };
      set({ gameState: ns, ruleViolationMessage: `${sender.name} no longer has enough resources to fulfill this trade.` });
      return;
    }
    if (recipient.coins < offer.requestCoins || recipient.ronin < offer.requestRonin) {
      // Recipient does not have enough to fulfill request - remove the offer and notify
      const ns = { ...gameState, tradeOffers: gameState.tradeOffers.filter(o => o.id !== offerId) };
      set({ gameState: ns, ruleViolationMessage: `You do not have enough resources to accept this trade.` });
      return;
    }
    // Transfer resources
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === offer.fromPlayerId) {
        return { ...p, coins: p.coins - offer.offerCoins + offer.requestCoins, ronin: p.ronin - offer.offerRonin + offer.requestRonin };
      }
      if (p.id === offer.toPlayerId) {
        return { ...p, coins: p.coins + offer.offerCoins - offer.requestCoins, ronin: p.ronin + offer.offerRonin - offer.requestRonin };
      }
      return p;
    });
    const ns = { ...gameState, players: updatedPlayers, tradeOffers: gameState.tradeOffers.filter(o => o.id !== offerId) };
    set({ gameState: ns });
  },
  doRejectTrade: (offerId) => {
    const { gameState } = get();
    if (!gameState) return;
    const ns = { ...gameState, tradeOffers: gameState.tradeOffers.filter(o => o.id !== offerId) };
    set({ gameState: ns });
  },

  // --- Persistence ---
  saveSnapshot: () => {
    const { persistentGameId, gameState } = get();
    if (!persistentGameId || !gameState) return;
    return fetch(`${API_BASE}/api/games/${persistentGameId}/snapshot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: gameState }),
    }).then(() => {}).catch((err) => { console.error('[saveSnapshot] persistence error:', err); });
  },

  // --- Finished Game Score ---
  loadFinishedGameScore: async (gameId) => {
    try {
      const snapshotsRes = await fetch(`${API_BASE}/api/games/${gameId}/snapshots`);
      const snapshots = await snapshotsRes.json();
      if (snapshots.length === 0) return;
      const lastSnapshot = snapshots[snapshots.length - 1];
      const gameState = lastSnapshot.state as GameState;
      if (!gameState.gameOver) return;
      set({
        gameState,
        localPlayerId: gameState.players[0]?.id || null,
        viewingFinishedGame: true,
        screen: 'game',
      });
    } catch (err) {
      console.error('[loadFinishedGameScore] failed to load game:', err);
    }
  },

  // --- Replay ---
  loadReplayGame: async (gameId) => {
    try {
      const [gameRes, snapshotsRes] = await Promise.all([
        fetch(`${API_BASE}/api/games/${gameId}`),
        fetch(`${API_BASE}/api/games/${gameId}/snapshots`),
      ]);
      const game = await gameRes.json();
      const snapshots = await snapshotsRes.json();
      const parsedSnapshots = snapshots.map((s: { snapshotIndex: number; state: GameState; description: string; phase: string; season: string }) => ({
        index: s.snapshotIndex,
        state: s.state as GameState,
        description: s.description,
        phase: s.phase,
        season: s.season,
      }));
      const players = game.players || [];
      set({
        replayGameId: gameId,
        replaySnapshots: parsedSnapshots,
        replayCurrentIndex: 0,
        replayTotalSnapshots: parsedSnapshots.length,
        replayGameMetadata: {
          id: game.id,
          name: game.name,
          players,
          winner: game.winner,
        },
        screen: 'replay',
      });
    } catch {
      /* silently ignore errors */
    }
  },
  replayNext: () => {
    const { replayCurrentIndex, replayTotalSnapshots } = get();
    if (replayCurrentIndex < replayTotalSnapshots - 1) {
      set({ replayCurrentIndex: replayCurrentIndex + 1 });
    }
  },
  replayPrev: () => {
    const { replayCurrentIndex } = get();
    if (replayCurrentIndex > 0) {
      set({ replayCurrentIndex: replayCurrentIndex - 1 });
    }
  },
  replayNextKami: () => {
    const { replayCurrentIndex, replaySnapshots } = get();
    for (let i = replayCurrentIndex + 1; i < replaySnapshots.length; i++) {
      if (replaySnapshots[i].phase === 'politics' && replaySnapshots[i].description.toLowerCase().includes('kami')) {
        set({ replayCurrentIndex: i });
        return;
      }
    }
  },
  replayPrevKami: () => {
    const { replayCurrentIndex, replaySnapshots } = get();
    for (let i = replayCurrentIndex - 1; i >= 0; i--) {
      if (replaySnapshots[i].phase === 'politics' && replaySnapshots[i].description.toLowerCase().includes('kami')) {
        set({ replayCurrentIndex: i });
        return;
      }
    }
  },
  replayNextBattle: () => {
    const { replayCurrentIndex, replaySnapshots } = get();
    for (let i = replayCurrentIndex + 1; i < replaySnapshots.length; i++) {
      if (replaySnapshots[i].phase === 'war') {
        set({ replayCurrentIndex: i });
        return;
      }
    }
  },
  replayPrevBattle: () => {
    const { replayCurrentIndex, replaySnapshots } = get();
    for (let i = replayCurrentIndex - 1; i >= 0; i--) {
      if (replaySnapshots[i].phase === 'war') {
        set({ replayCurrentIndex: i });
        return;
      }
    }
  },
  resumeGame: async (gameId) => {
    try {
      // Fetch game record to check mode without loading full snapshots
      const gameRes = await fetch(`${API_BASE}/api/games/${gameId}`);
      const gameRecord = await gameRes.json();

      // Check if this is an online game - if so, connect via WebSocket for rejoin
      if (gameRecord.mode === 'online') {
        set({
          persistentGameId: gameId,
          screen: 'game',
          rejoinWaitingVisible: true,
          rejoinPlayerStatuses: [],
        });
        get().connectWebSocket(WS_BASE, (wsConn) => {
          wsConn.send(JSON.stringify({ type: 'REJOIN_GAME', gameId }));
        });
        return;
      }

      // Hotseat flow - load snapshot directly
      const snapshotsRes = await fetch(`${API_BASE}/api/games/${gameId}/snapshots`);
      const snapshots = await snapshotsRes.json();
      if (snapshots.length === 0) return;
      const lastSnapshot = snapshots[snapshots.length - 1];
      const gameState = lastSnapshot.state as GameState;

      const authUser = get().authUser;
      const storedPlayerId = localStorage.getItem('shoguns-ascent-playerId');
      const storedUsername = get().username;
      const matchedByAuthUser = authUser
        ? gameState.players.find(p => p.id === authUser.id)
        : null;
      const matchedByPlayerId = storedPlayerId
        ? gameState.players.find(p => p.id === storedPlayerId)
        : null;
      const matchedByName = storedUsername
        ? gameState.players.find(p => p.name === storedUsername)
        : null;
      const matchedPlayer = matchedByAuthUser || matchedByPlayerId || matchedByName;
      set({
        gameState,
        localPlayerId: matchedPlayer?.id || gameState.players[0]?.id || null,
        persistentGameId: gameId,
        screen: 'game',
      });
    } catch (err) {
      console.error('[resumeGame] failed to load game:', err);
    }
  },

  undoMandateState: null,
  marshalPendingMoves: [],
  marshalPendingFortresses: [],
  doUndoMandate: () => {
    const { undoMandateState, gameState, ws } = get();
    if (!undoMandateState) return;

    // For online recruit: send undo to server
    if (ws && gameState?.mode === 'online' && gameState.recruitMandateActive) {
      get().sendAction({ type: 'UNDO_RECRUIT', playerId: get().localPlayerId });
      // Also restore local state immediately for responsiveness
      set({
        gameState: JSON.parse(JSON.stringify(undoMandateState)),
        recruitMode: true,
        recruitFigureType: 'bushi',
        // Keep undoMandateState so it can be used again
      });
      return;
    }

    // For online betray: send undo to server
    if (ws && gameState?.mode === 'online' && gameState.betrayMandateActive) {
      get().sendAction({ type: 'UNDO_BETRAY', playerId: get().localPlayerId });
      // Also restore local state immediately for responsiveness
      set({
        gameState: JSON.parse(JSON.stringify(undoMandateState)),
        betrayMode: true,
        betrayMonsterSelectionVisible: false,
        betrayMonsterSelectionProvinceId: null,
        betrayMonsterSelectionFigureId: null,
        // Keep undoMandateState so it can be used again
      });
      return;
    }

    // Original logic for hotseat/marshal
    set({
      gameState: JSON.parse(JSON.stringify(undoMandateState)),
      moveMode: false,
      moveFrom: null,
      selectedFigures: [],
      buildFortressMode: false,
      buildFukurokujuMode: false,
      recruitMode: undoMandateState.recruitMandateActive,
      recruitFigureType: 'bushi',
      betrayMode: undoMandateState.betrayMandateActive,
      betrayMonsterSelectionVisible: false,
      betrayMonsterSelectionProvinceId: null,
      betrayMonsterSelectionFigureId: null,
      marshalPendingMoves: [],
      marshalPendingFortresses: [],
    });
  },
  kamiPhasePopupVisible: false,
  kamiPendingTemples: null,
  warPhasePopupVisible: false,
  warPhaseUpgradeSummary: [],
  warSummaryVisible: false,
  biddingMapPeek: false,
  setBiddingMapPeek: (peek) => set({ biddingMapPeek: peek }),
  language: (localStorage.getItem('shoguns-ascent-language') as 'en' | 'es') || 'es',
  setLanguage: (lang) => {
    localStorage.setItem('shoguns-ascent-language', lang);
    set({ language: lang });
  },
  setShowTrainModal: (show) => set({ showTrainModal: show }),

  // --- UI Actions ---
  setScreen: (screen) => set({ screen }),
  setAuthInitialMode: (mode) => set({ authInitialMode: mode }),
  exitGame: async () => {
    const { persistentGameId, gameState } = get();
    try {
      if (persistentGameId) {
        await get().saveSnapshot();
      } else if (gameState && gameState.mode === 'hotseat') {
        const res = await fetch(`${API_BASE}/api/games/save-hotseat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: gameState }),
        });
        const data = await res.json();
        if (data && data.id) {
          set({ persistentGameId: data.id });
        }
      }
    } catch (err) {
      console.error('[exitGame] save failed:', err);
    }
    set({ screen: 'games-lobby' });
  },
  selectRegion: (regionId) => set({ selectedRegion: regionId }),
  toggleMoveMode: () => set((s) => ({ moveMode: !s.moveMode, moveFrom: null, selectedFigures: [] })),
  setMoveFrom: (regionId) => set({ moveFrom: regionId }),
  setSelectedFigures: (ids) => set({ selectedFigures: ids }),

  // --- Game Lifecycle ---
  createGame: (players, mode, deckConfig, password) => {
    const state = createInitialGameState(players, mode, undefined, deckConfig);
    set({ gameState: state, localPlayerId: state.players[0].id, screen: 'game', persistentGameId: null });
    // Persist hotseat games
    if (mode === 'hotseat') {
      fetch(`${API_BASE}/api/games/save-hotseat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, password: password || undefined }),
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            set({ persistentGameId: data.id });
          }
        })
        .catch((err) => { console.error('[createGame] persistence error:', err); });
    }
  },
  setGameState: (state) => set({ gameState: state }),
  setLocalPlayerId: (id) => set({ localPlayerId: id }),
  setUsername: (name) => {
    localStorage.setItem('shoguns-ascent-username', name);
    set({ username: name });
  },

  // --- Auth actions ---
  login: async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    localStorage.setItem('shoguns-ascent-authToken', data.token);
    localStorage.setItem('shoguns-ascent-authUser', JSON.stringify(data.user));
    localStorage.setItem('shoguns-ascent-username', data.user.username);
    set({
      authToken: data.token,
      authUser: data.user,
      isAuthenticated: true,
      username: data.user.username,
      screen: 'games-lobby',
    });
  },

  register: async (email, username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    localStorage.setItem('shoguns-ascent-authToken', data.token);
    localStorage.setItem('shoguns-ascent-authUser', JSON.stringify(data.user));
    localStorage.setItem('shoguns-ascent-username', data.user.username);
    set({
      authToken: data.token,
      authUser: data.user,
      isAuthenticated: true,
      username: data.user.username,
      screen: 'games-lobby',
    });
  },

  logout: () => {
    localStorage.removeItem('shoguns-ascent-authToken');
    localStorage.removeItem('shoguns-ascent-authUser');
    set({
      authToken: null,
      authUser: null,
      isAuthenticated: false,
      screen: 'auth',
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('shoguns-ascent-authToken');
    if (!token) {
      set({ authToken: null, authUser: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        localStorage.removeItem('shoguns-ascent-authToken');
        localStorage.removeItem('shoguns-ascent-authUser');
        set({ authToken: null, authUser: null, isAuthenticated: false });
        return;
      }
      const data = await res.json();
      localStorage.setItem('shoguns-ascent-authUser', JSON.stringify(data.user));
      set({
        authToken: token,
        authUser: data.user,
        isAuthenticated: true,
        username: data.user.username,
      });
    } catch {
      set({ authToken: null, authUser: null, isAuthenticated: false });
    }
  },

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

  doTeaReady: () => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !localPlayerId) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'TEA_READY', playerId: localPlayerId });
    }
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
  doProposeAlliance: (to, bribeAmount, requestAmount) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'FORM_ALLIANCE', playerId: apid, payload: { toPlayerId: to, bribeAmount: bribeAmount || 0, requestAmount: requestAmount || 0 } });
      return;
    }
    let ns = proposeAlliance(gameState, apid, to, bribeAmount || 0, requestAmount || 0);
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

  // --- Online Tea Ceremony (simultaneous mode) ---
  doTeaProposeAlliance: (toPlayerId, bribeAmount, requestAmount) => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !ws || !localPlayerId) return;
    get().sendAction({ type: 'TEA_PROPOSE_ALLIANCE', playerId: localPlayerId, payload: { toPlayerId, bribeAmount: bribeAmount || 0, requestAmount: requestAmount || 0 } });
  },
  doTeaAcceptAlliance: (fromPlayerId) => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !ws || !localPlayerId) return;
    get().sendAction({ type: 'TEA_ACCEPT_ALLIANCE', playerId: localPlayerId, payload: { fromPlayerId } });
  },
  doTeaRejectAlliance: (fromPlayerId) => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !ws || !localPlayerId) return;
    get().sendAction({ type: 'TEA_REJECT_ALLIANCE', playerId: localPlayerId, payload: { fromPlayerId } });
  },
  doTeaOptOut: () => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !ws || !localPlayerId) return;
    get().sendAction({ type: 'TEA_OPT_OUT', playerId: localPlayerId });
  },

  // --- Politics ---
  doDrawMandateTiles: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (gameState.currentPhase !== 'politics') return;
    if (gameState.mode === 'online') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        get().sendAction({ type: 'DRAW_MANDATE_TILES', playerId: get().localPlayerId });
      }
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
    if (gameState.mode === 'online') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        get().sendAction({ type: 'CHOOSE_MANDATE', playerId: apid, payload: { mandate } });
      }
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
      const undoSnapshot = (ns.marshalMandateActive || ns.recruitMandateActive || ns.betrayMandateActive) ? JSON.parse(JSON.stringify(ns)) : null;
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, betrayMode: ns.betrayMandateActive, undoMandateState: undoSnapshot, ...(gameState.mode === 'hotseat' && !ns.trainMandateActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
    } else {
      const advanced = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: advanced, ...detectWarTransitionWithPopup(advanced), ...detectKamiPopupPending(advanced), ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive && !advanced.kamiPhasePopupPending ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}) });
    }
    get().saveSnapshot();
  },
  doLotoChooseActualMandate: (mandate) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid || gameState.currentPhase !== 'politics') return;
    if (gameState.mode === 'online') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        get().sendAction({ type: 'LOTO_CHOOSE_ACTUAL_MANDATE', playerId: apid, payload: { mandate } });
      }
      return;
    }
    const ns = lotoChooseActualMandate(gameState, mandate, apid);
    // If train or marshal or recruit or betray or harvest mandate is active, wait for resolution before advancing
    if (ns.trainMandateActive || ns.marshalMandateActive || ns.recruitMandateActive || ns.betrayMandateActive || ns.harvestMandateActive) {
      const undoSnapshot = (ns.marshalMandateActive || ns.recruitMandateActive || ns.betrayMandateActive) ? JSON.parse(JSON.stringify(ns)) : null;
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, betrayMode: ns.betrayMandateActive, undoMandateState: undoSnapshot, ...(gameState.mode === 'hotseat' && !ns.trainMandateActive ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
    } else {
      const advanced = advancePlayer(ns);
      set({ gameState: advanced, ...detectWarTransitionWithPopup(advanced), ...detectKamiPopupPending(advanced), ...(gameState.mode === 'hotseat' && advanced.currentPhase === 'politics' && !advanced.kamiResolutionActive && !advanced.kamiPhasePopupPending ? { turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null } : {}) });
    }
    get().saveSnapshot();
  },

  // --- Buy Season Card (Train mandate) ---
  doBuySeasonCard: (cardId) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      // Send BUY_CARD to server so the purchase is recorded
      get().sendAction({ type: 'BUY_CARD', playerId: apid, payload: { cardId } });
      // Apply buySeasonCard locally to check if it's a monster
      const nsOnline = buySeasonCard(gameState, apid, cardId);
      const boughtCardOnline = nsOnline.players.find(p => p.id === apid)?.seasonCards.find(c => c.id === cardId);
      if (boughtCardOnline && boughtCardOnline.cardType === 'monster') {
        // Monster card: run the placement UI locally (server will wait for MONSTER_PLACED)
        if (boughtCardOnline.id === 'sp-komainu' || boughtCardOnline.id === 'su-hotei') {
          set({
            gameState: nsOnline,
            monsterPlacementCard: boughtCardOnline,
            monsterPlacementPlayerId: apid,
            komainuChoiceVisible: true,
            monsterPlacementPopupVisible: false,
            monsterPlacementMode: false,
          });
        } else {
          // Luna clan: check if there's a valid province BEFORE showing placement popup
          const placingPlayerOnline = nsOnline.players.find(p => p.id === apid);
          if (placingPlayerOnline && placingPlayerOnline.clanId === 'luna') {
            if (!lunaHasValidProvince(nsOnline, apid)) {
              // No valid province: monster goes to reserve directly
              const updatedPlayersOnline = nsOnline.players.map(p => {
                if (p.id !== apid) return p;
                return { ...p, monsters: p.monsters + 1 };
              });
              const nsUpdatedOnline: GameState = {
                ...nsOnline,
                players: updatedPlayersOnline,
                log: [...nsOnline.log, `Luna: no hay provincia valida para colocar monstruo - ${boughtCardOnline.name} se queda en reserva`],
              };
              set({
                gameState: nsUpdatedOnline,
                monsterPlacementCard: boughtCardOnline,
                monsterPlacementPlayerId: apid,
                monsterPlacementPopupVisible: false,
                monsterNoPlacementPopupVisible: true,
                monsterPlacementMode: false,
                komainuChoiceVisible: false,
              });
              return;
            }
          }
          // Show popup asking where to place the monster
          set({
            gameState: nsOnline,
            monsterPlacementCard: boughtCardOnline,
            monsterPlacementPlayerId: apid,
            monsterPlacementPopupVisible: true,
            monsterPlacementMode: false,
            komainuChoiceVisible: false,
          });
        }
        return;
      }
      // Non-monster card in online mode: server handles advancement, just return
      return;
    }
    let ns = buySeasonCard(gameState, apid, cardId);

    // Check if the bought card is a monster - if so, enter monster placement flow
    const boughtCard = ns.players.find(p => p.id === apid)?.seasonCards.find(c => c.id === cardId);
    if (boughtCard && boughtCard.cardType === 'monster') {
      // Komainu/Hotei special case: show choice between map and pray
      if (boughtCard.id === 'sp-komainu' || boughtCard.id === 'su-hotei') {
        set({
          gameState: ns,
          monsterPlacementCard: boughtCard,
          monsterPlacementPlayerId: apid,
          komainuChoiceVisible: true,
          monsterPlacementPopupVisible: false,
          monsterPlacementMode: false,
        });
      } else {
        // Luna clan: check if there's a valid province BEFORE showing placement popup
        const placingPlayer = ns.players.find(p => p.id === apid);
        if (placingPlayer && placingPlayer.clanId === 'luna') {
          if (!lunaHasValidProvince(ns, apid)) {
            // No valid province: monster goes to reserve directly
            const updatedPlayers = ns.players.map(p => {
              if (p.id !== apid) return p;
              return { ...p, monsters: p.monsters + 1 };
            });
            const nsUpdated: GameState = {
              ...ns,
              players: updatedPlayers,
              log: [...ns.log, `Luna: no hay provincia valida para colocar monstruo - ${boughtCard.name} se queda en reserva`],
            };
            set({
              gameState: nsUpdated,
              monsterPlacementCard: boughtCard,
              monsterPlacementPlayerId: apid,
              monsterPlacementPopupVisible: false,
              monsterNoPlacementPopupVisible: true,
              monsterPlacementMode: false,
              komainuChoiceVisible: false,
            });
            return;
          }
        }
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
      set({ gameState: ns, showTrainModal: false, ...detectWarTransitionWithPopup(ns), ...detectKamiPopupPending(ns) });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Skip Train Purchase ---
  doSkipTrainPurchase: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SKIP_TRAIN_PURCHASE', playerId: get().localPlayerId });
      return;
    }
    let ns = skipTrainPurchase(gameState);
    // If train mandate is now resolved (all players done), advance to next mandate turn
    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: ns, showTrainModal: false, ...detectWarTransitionWithPopup(ns), ...detectKamiPopupPending(ns) });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Marshal Mandate Actions ---
  doSkipMarshalTurn: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      const { marshalPendingMoves, marshalPendingFortresses } = get();
      get().sendAction({
        type: 'SKIP_MARSHAL_TURN',
        playerId: get().localPlayerId,
        payload: { moves: marshalPendingMoves, fortresses: marshalPendingFortresses },
      });
      set({ marshalPendingMoves: [], marshalPendingFortresses: [], undoMandateState: null, moveMode: false, moveFrom: null, selectedFigures: [], buildFortressMode: false, buildFukurokujuMode: false });
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
      buildFukurokujuMode: false,
      moveMode: false,
      moveFrom: null,
      selectedFigures: [],
      undoMandateState: ns.marshalMandateActive ? JSON.parse(JSON.stringify(ns)) : null,
      ...detectWarTransitionWithPopup(ns),
      ...detectKamiPopupPending(ns),
      ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}),
    });
  },
  doBuildFortress: (provinceId: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      // During marshal mandate, apply fortress locally instead of sending to server
      if (gameState.marshalMandateActive) {
        const ns = buildFortress(gameState, apid, provinceId);
        set({ gameState: ns, buildFortressMode: false, marshalPendingFortresses: [...get().marshalPendingFortresses, { provinceId }] });
        return;
      }
      get().sendAction({ type: 'BUILD_FORTRESS', playerId: apid, payload: { provinceId } });
      set({ buildFortressMode: false });
      return;
    }
    const ns = buildFortress(gameState, apid, provinceId);
    set({ gameState: ns, buildFortressMode: false });
  },
  toggleBuildFortressMode: () => set((s) => ({ buildFortressMode: !s.buildFortressMode, buildFukurokujuMode: false, moveMode: false, moveFrom: null, selectedFigures: [] })),
  toggleBuildFukurokujuMode: () => set((s) => ({ buildFukurokujuMode: !s.buildFukurokujuMode, buildFortressMode: false, moveMode: false, moveFrom: null, selectedFigures: [] })),
  doBuildFukurokuju: (provinceId: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    if (ws && gameState.mode === 'online') {
      // During marshal mandate, apply Fukurokuju locally instead of sending to server
      if (gameState.marshalMandateActive) {
        const ns = buildFukurokuju(gameState, apid, provinceId);
        set({ gameState: ns, buildFukurokujuMode: false, marshalPendingFortresses: [...get().marshalPendingFortresses, { provinceId, fukurokuju: true }] });
        return;
      }
      get().sendAction({ type: 'BUILD_FUKUROKUJU', playerId: apid, payload: { provinceId } });
      set({ buildFukurokujuMode: false });
      return;
    }
    const ns = buildFukurokuju(gameState, apid, provinceId);
    set({ gameState: ns, buildFukurokujuMode: false });
  },

  // --- Recruit Mandate Actions ---
  toggleRecruitMode: () => set((s) => ({ recruitMode: !s.recruitMode, moveMode: false, moveFrom: null, selectedFigures: [], buildFortressMode: false, buildFukurokujuMode: false, betrayMode: false, recruitMonsterSelectionVisible: false, recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null })),
  setRecruitFigureType: (figureType) => set({ recruitFigureType: figureType, recruitMonsterSelectionVisible: false, recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null }),
  doRecruitPlaceFigure: (provinceId: string) => {
    const { gameState, localPlayerId, recruitFigureType, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;

    // For monster/daimyo types, we need to show a selection popup instead of placing directly
    if (recruitFigureType === 'monster' || recruitFigureType === 'daimyo') {
      const player = gameState.players.find(p => p.id === apid);
      if (!player) return;
      const province = gameState.provinces[provinceId];
      if (!province) return;

      // Validate province: must have fortress (or libelula can place anywhere)
      const isDragonfly = player.clanId === 'libelula';
      if (!isDragonfly) {
        const hasFortress = province.figures.some(f => f.owner === apid && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
        if (!hasFortress) {
          set({ ruleViolationMessage: 'No tienes fortaleza en esta provincia' });
          return;
        }
      }

      // Luna clan power: max 2 figures per province
      if (player.clanId === 'luna') {
        const lunaFiguresInProvince = province.figures.filter(f => f.owner === apid && f.type !== 'fortress').length;
        if (lunaFiguresInProvince >= 2) {
          set({ ruleViolationMessage: 'Luna: maximo 2 figuras por provincia' });
          return;
        }
      }

      // Validate one-per-fortress-province rule
      const usedProvinces = gameState.recruitUsedFortressProvinces;
      const timesProvinceUsed = usedProvinces.filter(p => p === provinceId).length;
      if (timesProvinceUsed > 0) {
        const isBonus = gameState.recruitMandateIssuerId ? (() => {
          const issuer = gameState.players.find(p => p.id === gameState.recruitMandateIssuerId);
          if (!issuer) return false;
          return apid === gameState.recruitMandateIssuerId || issuer.allies.includes(apid) || player.allies.includes(gameState.recruitMandateIssuerId);
        })() : false;
        if (!isBonus) {
          set({ ruleViolationMessage: 'Ya has reclutado en esta fortaleza este turno' });
          return;
        }
        const bonusUsesConsumed = usedProvinces.length - new Set(usedProvinces).size;
        if (bonusUsesConsumed >= 1) {
          set({ ruleViolationMessage: 'Ya has reclutado en esta fortaleza este turno' });
          return;
        }
      }

      if (recruitFigureType === 'monster') {
        // Show monster selection popup
        set({ recruitMonsterSelectionVisible: true, recruitPendingProvinceId: provinceId });
        return;
      }

      if (recruitFigureType === 'daimyo') {
        // Determine available daimyos in reserve
        const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
        const deployedMonsterCardIds = new Set<string>();
        Object.values(gameState.provinces).forEach((prov) => {
          prov.figures.forEach((f) => {
            if (f.type === 'monster' && f.owner === apid && f.monsterCardId) {
              deployedMonsterCardIds.add(f.monsterCardId);
            }
          });
        });
        const daimyoMonstersInReserve = player.seasonCards.filter(
          (card) => card.cardType === 'monster' && DAIMYO_MONSTER_IDS.includes(card.id) && !deployedMonsterCardIds.has(card.id)
        );
        const totalDaimyos = (player.hasDaimyo ? 1 : 0) + daimyoMonstersInReserve.length;

        if (totalDaimyos === 0) {
          set({ ruleViolationMessage: 'No te quedan daimyos en reserva' });
          return;
        }

        if (totalDaimyos === 1) {
          // Only one available - place directly
          if (player.hasDaimyo) {
            // Place normal daimyo directly
            if (ws && gameState.mode === 'online') {
              get().sendAction({ type: 'RECRUIT_PLACE_DAIMYO', playerId: apid, payload: { provinceId, daimyoType: 'normal' } });
              return;
            }
            const ns = recruitPlaceDaimyo(gameState, apid, provinceId, 'normal');
            if (ns === gameState) {
              set({ ruleViolationMessage: 'No puedes realizar esta accion' });
              return;
            }
            set({ gameState: ns });
          } else {
            // Place the single daimyo monster directly
            const monsterCard = daimyoMonstersInReserve[0];
            if (ws && gameState.mode === 'online') {
              get().sendAction({ type: 'RECRUIT_PLACE_DAIMYO', playerId: apid, payload: { provinceId, daimyoType: monsterCard.id } });
              return;
            }
            const ns = recruitPlaceDaimyo(gameState, apid, provinceId, monsterCard.id);
            if (ns === gameState) {
              set({ ruleViolationMessage: 'No puedes realizar esta accion' });
              return;
            }
            set({ gameState: ns });
          }
          return;
        }

        // Multiple daimyos available - show selection popup
        set({ recruitDaimyoSelectionVisible: true, recruitPendingProvinceId: provinceId });
        return;
      }
      return;
    }

    if (ws && gameState.mode === 'online') {
      // Pre-validate reserve before anything else
      const player = gameState.players.find(p => p.id === apid);
      if (player) {
        if (recruitFigureType === 'shinto' && player.shinto <= 0) {
          set({ ruleViolationMessage: 'No te quedan mas shintos' });
          return;
        }
        if (recruitFigureType === 'bushi' && player.bushi <= 0) {
          set({ ruleViolationMessage: 'No te quedan mas bushis' });
          return;
        }
      }
      // Pre-validate on client side to show rule violation messages
      const preCheck = recruitPlaceFigure(gameState, apid, provinceId, recruitFigureType);
      if (preCheck === gameState) {
        // Validation failed - determine reason and show locally
        const player = gameState.players.find(p => p.id === apid);
        const province = gameState.provinces[provinceId];
        let msg = 'No puedes realizar esta accion';
        if (player && province) {
          const isDragonfly = player.clanId === 'libelula';
          if (!isDragonfly) {
            const hasFortress = province.figures.some(f => f.owner === apid && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
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
        if (recruitFigureType === 'shinto' && player.shinto <= 0) {
          msg = 'No te quedan mas shintos';
        } else if (recruitFigureType === 'bushi' && player.bushi <= 0) {
          msg = 'No te quedan mas bushis';
        } else {
          const isDragonfly = player.clanId === 'libelula';
          if (!isDragonfly) {
            const hasFortress = province.figures.some(f => f.owner === apid && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
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
      }
      set({ ruleViolationMessage: msg });
      return;
    }
    // Do NOT auto-advance when placements reach 0 - player must press Terminar manually
    set({ gameState: ns });
  },
  doRecruitPlaceTempleShinto: (templeId: string) => {
    const { gameState, localPlayerId, recruitFigureType, ws } = get();
    if (!gameState || !localPlayerId) return;
    if (recruitFigureType !== 'shinto') return;
    if (!gameState.recruitMandateActive) return;
    if (gameState.recruitPlacementsRemaining <= 0) return;

    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RECRUIT_PLACE_TEMPLE_SHINTO', playerId: apid, payload: { templeId } });
      return;
    }

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
      log: [...gameState.log, `${player.name} coloca un shinto en santuario de ${capitalize(temple.kamiType)}`],
    };

    // Do NOT auto-advance when placements reach 0 - player must press Terminar manually
    set({ gameState: ns });
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
    // Detect war phase transition or kami popup
    const warPopup = detectWarTransitionWithPopup(ns);
    const kamiPopup = detectKamiPopupPending(ns);
    const hotseatTurnPopup = ns.recruitMandateActive && gameState.mode === 'hotseat'
      ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null }
      : {};
    if (Object.keys(warPopup).length > 0 || Object.keys(kamiPopup).length > 0) {
      set({ gameState: ns, recruitMode: ns.recruitMandateActive, undoMandateState: ns.recruitMandateActive ? JSON.parse(JSON.stringify(ns)) : null, ...hotseatTurnPopup, ...warPopup, ...kamiPopup });
    } else {
      // Auto-enable recruitMode for next player if mandate is still active
      set({
        gameState: ns,
        recruitMode: ns.recruitMandateActive,
        undoMandateState: ns.recruitMandateActive ? JSON.parse(JSON.stringify(ns)) : null,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}),
      });
    }
  },

  // --- Recruit Monster/Daimyo Selection Actions ---
  doRecruitConfirmMonster: (monsterCardId: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    const { recruitPendingProvinceId } = get();
    if (!recruitPendingProvinceId) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RECRUIT_PLACE_MONSTER', playerId: apid, payload: { provinceId: recruitPendingProvinceId, monsterCardId } });
      set({ recruitMonsterSelectionVisible: false, recruitPendingProvinceId: null });
      return;
    }

    const player = gameState.players.find(p => p.id === apid);
    if (!player) return;
    if (player.monsters <= 0) return;
    if (!gameState.recruitMandateActive || gameState.recruitPlacementsRemaining <= 0) return;

    const province = gameState.provinces[recruitPendingProvinceId];
    if (!province) return;

    // Find the monster card to get its name
    const monsterCard = player.seasonCards.find(c => c.id === monsterCardId);
    if (!monsterCard) return;

    // Verify the monster card is not already deployed on the map (prevents double-placement race)
    const deployedMonsterCardIds = new Set<string>();
    Object.values(gameState.provinces).forEach((prov) => {
      prov.figures.forEach((f) => {
        if (f.type === 'monster' && f.owner === apid && f.monsterCardId) {
          deployedMonsterCardIds.add(f.monsterCardId);
        }
      });
    });
    if (deployedMonsterCardIds.has(monsterCardId)) return;

    const figureId = Math.random().toString(36).substring(2, 10);
    const newFigure = { type: 'monster' as const, owner: apid, id: figureId, monsterCardId };

    const updatedProvinces = { ...gameState.provinces };
    updatedProvinces[recruitPendingProvinceId] = {
      ...province,
      figures: [...province.figures, newFigure],
    };

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === apid) return { ...p, monsters: p.monsters - 1 };
      return p;
    });

    const ns: GameState = {
      ...gameState,
      provinces: updatedProvinces,
      players: updatedPlayers,
      recruitPlacementsRemaining: gameState.recruitPlacementsRemaining - 1,
      recruitUsedFortressProvinces: [...gameState.recruitUsedFortressProvinces, recruitPendingProvinceId],
      log: [...gameState.log, `${player.name} invoca a ${monsterCard.name} en ${province.name}`],
    };

    set({ gameState: ns, recruitMonsterSelectionVisible: false, recruitPendingProvinceId: null });
  },
  doRecruitConfirmDaimyo: (daimyoType: string) => {
    const { gameState, localPlayerId, ws } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    const { recruitPendingProvinceId } = get();
    if (!recruitPendingProvinceId) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RECRUIT_PLACE_DAIMYO', playerId: apid, payload: { provinceId: recruitPendingProvinceId, daimyoType } });
      set({ recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null });
      return;
    }

    const ns = recruitPlaceDaimyo(gameState, apid, recruitPendingProvinceId, daimyoType);
    if (ns === gameState) {
      set({ ruleViolationMessage: 'No puedes realizar esta accion', recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null });
      return;
    }
    set({ gameState: ns, recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null });
  },
  doRecruitDismissSelection: () => {
    set({ recruitMonsterSelectionVisible: false, recruitDaimyoSelectionVisible: false, recruitPendingProvinceId: null });
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
    // Check if the target is a monster and the issuer has multiple in reserve
    const province = gameState.provinces[provinceId];
    const figure = province?.figures.find(f => f.id === figureId);
    if (figure && figure.type === 'monster') {
      const issuer = gameState.players.find(p => p.id === apid);
      if (issuer) {
        const deployedMonsterCardIds = new Set<string>();
        Object.values(gameState.provinces).forEach((prov) => {
          prov.figures.forEach((f) => {
            if (f.type === 'monster' && f.owner === apid && f.monsterCardId) {
              deployedMonsterCardIds.add(f.monsterCardId);
            }
          });
        });
        const reserveMonsters = issuer.seasonCards.filter(
          (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id)
        );
        if (reserveMonsters.length > 1) {
          // Show monster selection popup
          set({ betrayMonsterSelectionVisible: true, betrayMonsterSelectionProvinceId: provinceId, betrayMonsterSelectionFigureId: figureId });
          return;
        }
        // Single monster - use it directly
        if (reserveMonsters.length === 1) {
          const ns = betraySelectFigure(gameState, apid, figureId, provinceId, reserveMonsters[0].id);
          if (!ns.betrayMandateActive) {
            const advanced = advancePlayer(ns);
            set({ gameState: advanced, betrayMode: false, undoMandateState: null, ...detectWarTransitionWithPopup(advanced), ...detectKamiPopupPending(advanced) });
          } else {
            set({ gameState: ns });
          }
          return;
        }
      }
    }
    const ns = betraySelectFigure(gameState, apid, figureId, provinceId);
    if (!ns.betrayMandateActive) {
      const advanced = advancePlayer(ns);
      // Detect war phase transition and set up battle step phase for hotseat
      set({ gameState: advanced, betrayMode: false, undoMandateState: null, ...detectWarTransitionWithPopup(advanced), ...detectKamiPopupPending(advanced) });
    } else {
      set({ gameState: ns });
    }
  },
  betrayMonsterSelectionVisible: false,
  betrayMonsterSelectionProvinceId: null,
  betrayMonsterSelectionFigureId: null,
  doBetrayConfirmMonster: (monsterCardId: string) => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return;
    const cp = getCurrentPlayer(gameState);
    const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
    if (!apid) return;
    const { betrayMonsterSelectionProvinceId, betrayMonsterSelectionFigureId } = get();
    if (!betrayMonsterSelectionProvinceId || !betrayMonsterSelectionFigureId) return;
    const ns = betraySelectFigure(gameState, apid, betrayMonsterSelectionFigureId, betrayMonsterSelectionProvinceId, monsterCardId);
    if (!ns.betrayMandateActive) {
      const advanced = advancePlayer(ns);
      set({ gameState: advanced, betrayMode: false, undoMandateState: null, betrayMonsterSelectionVisible: false, betrayMonsterSelectionProvinceId: null, betrayMonsterSelectionFigureId: null, ...detectWarTransitionWithPopup(advanced), ...detectKamiPopupPending(advanced) });
    } else {
      set({ gameState: ns, betrayMonsterSelectionVisible: false, betrayMonsterSelectionProvinceId: null, betrayMonsterSelectionFigureId: null });
    }
  },
  doBetrayDismissMonsterSelection: () => {
    set({ betrayMonsterSelectionVisible: false, betrayMonsterSelectionProvinceId: null, betrayMonsterSelectionFigureId: null });
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
    set({ gameState: ns, betrayMode: false, undoMandateState: null, ...detectWarTransitionWithPopup(ns), ...detectKamiPopupPending(ns) });
  },

  // --- Harvest Acknowledgement ---
  doAcknowledgeHarvest: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.harvestMandateActive) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ACKNOWLEDGE_HARVEST', playerId: get().localPlayerId });
      return;
    }
    let ns = advanceHarvestResolution(gameState);
    if (!ns.harvestMandateActive) {
      // Harvest fully resolved, advance player
      ns = advancePlayer(ns);
      // Detect war phase transition or kami popup
      const warPopup = detectWarTransitionWithPopup(ns);
      const kamiPopup = detectKamiPopupPending(ns);
      set({
        gameState: ns,
        ...warPopup,
        ...kamiPopup,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending && Object.keys(warPopup).length === 0
          ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null }
          : {}),
      });
    } else {
      set({ gameState: ns });
    }
  },

  // --- Monster Placement Actions ---
  confirmMonsterPlacement: () => {
    const { gameState, monsterPlacementPlayerId, monsterPlacementCard } = get();
    if (!gameState || !monsterPlacementPlayerId) return;

    // Daikaiju: auto-place in ocean without requiring province selection
    if (monsterPlacementCard && monsterPlacementCard.id === 'au-daikaiju') {
      get().doPlaceMonster('ocean');
      return;
    }

    // Luna clan power: max 2 figures per province. Check if Luna has ANY valid province to place.
    const placingPlayer = gameState.players.find(p => p.id === monsterPlacementPlayerId);
    if (placingPlayer && placingPlayer.clanId === 'luna') {
      if (!lunaHasValidProvince(gameState, monsterPlacementPlayerId)) {
        // No valid province: monster goes to reserve, show popup to inform player
        const updatedPlayers = gameState.players.map(p => {
          if (p.id !== monsterPlacementPlayerId) return p;
          return { ...p, monsters: p.monsters + 1 };
        });
        const ns: GameState = {
          ...gameState,
          players: updatedPlayers,
          log: [...gameState.log, `Luna: no hay provincia valida para colocar monstruo - el monstruo se queda en reserva`],
        };
        set({
          gameState: ns,
          monsterPlacementPopupVisible: false,
          monsterNoPlacementPopupVisible: true,
        });
        return;
      }
    }

    set({ monsterPlacementPopupVisible: false, monsterPlacementMode: true });
  },

  doPlaceMonster: (provinceId: string) => {
    const { gameState, monsterPlacementCard, monsterPlacementPlayerId } = get();
    if (!gameState || !monsterPlacementCard || !monsterPlacementPlayerId) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    // Luna clan power: max 2 figures per province (excluding fortresses)
    const placingPlayer = gameState.players.find(p => p.id === monsterPlacementPlayerId);
    if (placingPlayer && placingPlayer.clanId === 'luna') {
      const lunaFiguresInProvince = province.figures.filter(
        f => f.owner === monsterPlacementPlayerId && f.type !== 'fortress'
      ).length;
      if (lunaFiguresInProvince >= 2) {
        set({ ruleViolationMessage: 'Luna: maximo 2 figuras por provincia' });
        return;
      }
    }

    // Place a monster figure in the province
    const figureId = Math.random().toString(36).substring(2, 10);
    const newFigure = { type: 'monster' as const, owner: monsterPlacementPlayerId, id: figureId, monsterCardId: monsterPlacementCard.id };
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
      log: [...gameState.log, `${monsterPlacementCard.name} colocado en ${province.name}`],
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
        set({ ...clearState, ...detectWarTransitionWithPopup(ns) });
      }
      return;
    }

    // Online mode: send MONSTER_PLACED to server and reset UI (server handles train advancement)
    const { ws } = get();
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'MONSTER_PLACED', playerId: monsterPlacementPlayerId, payload: { cardId: monsterPlacementCard.id, provinceId } });
      set({
        gameState: ns,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      });
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
      const warPopup2 = detectWarTransitionWithPopup(ns);
      const kamiPopup2 = detectKamiPopupPending(ns);
      set({
        gameState: ns,
        showTrainModal: false,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
        ...warPopup2,
        ...kamiPopup2,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending && Object.keys(warPopup2).length === 0
          ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null }
          : {}),
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
      log: [...gameState.log, `${monsterPlacementCard.name} enviado a rezar a un santuario`],
    };

    set({
      gameState: ns,
      komainuChoiceVisible: false,
      monsterPlacementPopupVisible: false,
      monsterPlacementMode: false,
      monsterPlacementCard: null,
      komainuPrayMode: true,
      komainuPrayPlayerId: monsterPlacementPlayerId,
      komainuPrayCardId: monsterPlacementCard.id,
    });
  },

  doKomainuChooseMap: () => {
    // Transition from komainu choice to normal placement popup
    set({ komainuChoiceVisible: false, monsterPlacementPopupVisible: true });
  },

  doKomainuPlaceAtTemple: (templeId: string, replaceFigureId?: string) => {
    const { gameState, komainuPrayPlayerId, komainuPrayCardId } = get();
    if (!gameState || !komainuPrayPlayerId) return;

    const isHotei = komainuPrayCardId === 'su-hotei';

    // Luna clan power: max 2 figures per temple (non-Luna: max 1)
    const komainuPlayer = gameState.players.find(p => p.id === komainuPrayPlayerId);

    const templeIndex = gameState.temples.findIndex(t => t.id === templeId);
    if (templeIndex === -1) return;

    const temple = gameState.temples[templeIndex];
    const shintoInThisTemple = temple.figures.filter(f => f.playerId === komainuPrayPlayerId).length;

    // Luna clan power: max 2 shinto per temple. Non-Luna clans have no per-temple limit.
    if (komainuPlayer?.clanId === 'luna') {
      if (shintoInThisTemple >= 2) {
        console.warn(`[Komainu/Hotei] Luna player ${komainuPlayer.name} already has 2 shinto in ${temple.kamiType} temple`);
        return;
      }
    }

    const figureId = Math.random().toString(36).substring(2, 10);

    // Hotei replacement logic: if replaceFigureId is provided, remove that figure and return shinto to owner
    let updatedPlayers = gameState.players;
    let updatedFigures = [...temple.figures];
    let logMessage: string;

    if (isHotei && replaceFigureId) {
      const replacedFigure = temple.figures.find(f => f.figureId === replaceFigureId && f.playerId !== komainuPrayPlayerId);
      if (!replacedFigure) return;

      // Remove the replaced figure from temple
      updatedFigures = updatedFigures.filter(f => f.figureId !== replaceFigureId);

      // Return the shinto to its owner's reserve
      const replacedOwner = gameState.players.find(p => p.id === replacedFigure.playerId);
      updatedPlayers = gameState.players.map(p => {
        if (p.id !== replacedFigure.playerId) return p;
        return { ...p, shinto: p.shinto + 1 };
      });

      logMessage = `Hotei reemplaza shinto de ${replacedOwner?.name || 'jugador'} en santuario de ${capitalize(temple.kamiType)}`;
    } else if (isHotei) {
      logMessage = `Hotei colocado como shinto en santuario de ${capitalize(temple.kamiType)}`;
    } else {
      logMessage = `Komainu colocado como shinto en santuario de ${capitalize(temple.kamiType)}`;
    }

    // Add the new shinto figure to the temple
    updatedFigures = [...updatedFigures, { playerId: komainuPrayPlayerId, figureId, monsterCardId: komainuPrayCardId || undefined }];

    const updatedTemples = [...gameState.temples];
    updatedTemples[templeIndex] = {
      ...temple,
      figures: updatedFigures,
    };

    // The monster itself counts as the shinto figure - do NOT decrement player's shinto reserve
    let ns: GameState = {
      ...gameState,
      players: updatedPlayers,
      temples: updatedTemples,
      log: [...gameState.log, logMessage],
    };

    // If placing during Ryujin kami resolution, advance kami resolution instead of train
    if (ns.kamiResolutionActive) {
      ns = advanceKamiResolution(ns);
      const clearState = {
        gameState: ns,
        komainuPrayMode: false,
        komainuPrayPlayerId: null as string | null,
        komainuPrayCardId: null as string | null,
        monsterPlacementPlayerId: null as string | null,
      };
      if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        set({ ...clearState, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      } else {
        set({ ...clearState, ...detectWarTransitionWithPopup(ns) });
      }
      return;
    }

    // Online mode: send MONSTER_PLACED to server and reset UI (server handles train advancement)
    const { ws } = get();
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'MONSTER_PLACED', playerId: komainuPrayPlayerId, payload: { cardId: komainuPrayCardId, templeId, replaceFigureId } });
      set({
        komainuPrayMode: false,
        komainuPrayPlayerId: null,
        komainuPrayCardId: null as string | null,
        monsterPlacementPlayerId: null,
      });
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
      const warPopup3 = detectWarTransitionWithPopup(ns);
      const kamiPopup3 = detectKamiPopupPending(ns);
      set({
        gameState: ns,
        showTrainModal: false,
        komainuPrayMode: false,
        komainuPrayPlayerId: null,
        komainuPrayCardId: null as string | null,
        monsterPlacementPlayerId: null,
        ...warPopup3,
        ...kamiPopup3,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending && Object.keys(warPopup3).length === 0
          ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null }
          : {}),
      });
    } else {
      set({
        gameState: ns,
        showTrainModal: true,
        komainuPrayMode: false,
        komainuPrayPlayerId: null,
        komainuPrayCardId: null as string | null,
        monsterPlacementPlayerId: null,
      });
    }
  },

  cancelMonsterPlacement: () => {
    const { gameState, monsterPlacementPlayerId, monsterPlacementCard, ws } = get();
    if (!gameState || !monsterPlacementPlayerId) return;

    // Online mode: send MONSTER_PLACED with reserve: true to server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'MONSTER_PLACED', playerId: monsterPlacementPlayerId, payload: { cardId: monsterPlacementCard?.id, reserve: true } });
      set({
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      });
      return;
    }

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
        ...detectWarTransitionWithPopup(ns),
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

  dismissMonsterNoPlacement: () => {
    const { gameState, monsterPlacementCard, monsterPlacementPlayerId, ws } = get();
    if (!gameState) return;

    // Online mode: send MONSTER_PLACED with reserve: true to server
    if (ws && gameState.mode === 'online' && monsterPlacementPlayerId) {
      get().sendAction({ type: 'MONSTER_PLACED', playerId: monsterPlacementPlayerId, payload: { cardId: monsterPlacementCard?.id, reserve: true } });
      set({
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        monsterNoPlacementPopupVisible: false,
        komainuChoiceVisible: false,
      });
      return;
    }

    // Advance train resolution after showing the popup
    let ns: GameState = {
      ...gameState,
      trainResolutionIndex: gameState.trainResolutionIndex + 1,
    };
    ns = advanceTrainResolution(ns);

    if (!ns.trainMandateActive) {
      ns = advancePlayer(ns);
      const warPopup = detectWarTransitionWithPopup(ns);
      const kamiPopup = detectKamiPopupPending(ns);
      set({
        gameState: ns,
        showTrainModal: false,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        monsterNoPlacementPopupVisible: false,
        komainuChoiceVisible: false,
        ...warPopup,
        ...kamiPopup,
        ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' && !ns.kamiResolutionActive && !ns.kamiPhasePopupPending && Object.keys(warPopup).length === 0
          ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null }
          : {}),
      });
    } else {
      set({
        gameState: ns,
        showTrainModal: true,
        monsterPlacementMode: false,
        monsterPlacementCard: null,
        monsterPlacementPlayerId: null,
        monsterPlacementPopupVisible: false,
        monsterNoPlacementPopupVisible: false,
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
    get().saveSnapshot();
  },

  doAcknowledgeKamiReward: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    // In online mode, send the action to the server and let it handle the logic
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ACKNOWLEDGE_KAMI_REWARD', playerId: get().localPlayerId });
      return;
    }

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple) return;

    // If no winner and no forces (truly empty temple), auto-advance
    if (!currentTemple.winnerId && currentTemple.forces.length === 0) {
      let ns = advanceKamiResolution(gameState);
      if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
        if (ns.kamiSummaryVisible) {
          set({ gameState: ns });
        } else {
          set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
        }
      } else {
        set({ gameState: ns, ...detectWarTransitionWithPopup(ns) });
      }
      return;
    }

    // Apply the reward for the current temple (winnerId will be computed dynamically if null)
    let ns = resolveCurrentKamiReward(gameState);

    // If the reward is interactive (step changed to 'interactive'), wait for player input
    if (ns.kamiResolutionStep === 'interactive') {
      // For fujin, enable moveMode
      if (currentTemple.kamiType === 'fujin') {
        set({ gameState: ns, moveMode: true, moveFrom: null, selectedFigures: [], fujinPreMoveState: null });
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

    // If resolution just finished and we are in hotseat, show turn popup for next player (only if no summary pending)
    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      if (ns.kamiSummaryVisible) {
        // Summary popup will show - don't show turn popup yet
        set({ gameState: ns });
      } else {
        set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      }
    } else {
      set({ gameState: ns, ...detectWarTransitionWithPopup(ns) });
    }
  },

  doCompleteKamiInteractive: () => {
    const { gameState } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    let ns = advanceKamiResolution(gameState);

    // If resolution just finished and we are in hotseat, show turn popup for next player (only if no summary pending)
    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      if (ns.kamiSummaryVisible) {
        set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [] });
      } else {
        set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [], turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      }
    } else {
      set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [], ...detectWarTransitionWithPopup(ns) });
    }
  },

  fujinPreMoveState: null,

  raijinPrePlaceState: null,

  doFujinMove: (fromProvinceId: string, toProvinceId: string, figureIds: string[]) => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive || gameState.fujinMovesRemaining <= 0) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      set({ fujinPreMoveState: JSON.parse(JSON.stringify(gameState)) });
      get().sendAction({ type: 'FUJIN_MOVE', playerId: get().localPlayerId, payload: { fromProvinceId, toProvinceId, figureIds } });
      return;
    }

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    // Save pre-move state for undo
    const preMoveSnapshot = JSON.parse(JSON.stringify(gameState));

    const ns = moveForces(gameState, currentTemple.winnerId, fromProvinceId, toProvinceId, figureIds);
    // If moveForces returned the same state (validation failed), show feedback
    if (ns === gameState) {
      const lang = get().language;
      set({ ruleViolationMessage: lang === 'en' ? 'Invalid move' : 'Movimiento no valido' });
      return;
    }

    const remaining = ns.fujinMovesRemaining - 1;
    const updated: GameState = { ...ns, fujinMovesRemaining: remaining };

    if (remaining <= 0) {
      // Do NOT auto-advance - keep state with fujinMovesRemaining=0 for confirmation step
      set({ gameState: updated, moveFrom: null, selectedFigures: [], fujinPreMoveState: preMoveSnapshot });
    } else {
      set({ gameState: updated, moveFrom: null, selectedFigures: [], fujinPreMoveState: preMoveSnapshot });
    }
  },

  doFujinUndo: () => {
    const { fujinPreMoveState } = get();
    if (!fujinPreMoveState) return;
    set({
      gameState: JSON.parse(JSON.stringify(fujinPreMoveState)),
      fujinPreMoveState: null,
      moveFrom: null,
      selectedFigures: [],
    });
  },

  doFujinDone: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'FUJIN_DONE', playerId: get().localPlayerId });
      return;
    }

    const ns: GameState = { ...gameState, fujinMovesRemaining: 0 };
    const advanced = advanceKamiResolution(ns);

    if (!advanced.kamiResolutionActive && advanced.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [], fujinPreMoveState: null, turnPopupPlayer: advanced.players[advanced.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: advanced, moveMode: false, moveFrom: null, selectedFigures: [], fujinPreMoveState: null, ...detectWarTransitionWithPopup(advanced) });
    }
  },

  doRaijinPlace: (provinceId: string) => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.raijinPlacementActive) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      set({ raijinPrePlaceState: JSON.parse(JSON.stringify(gameState)) });
      get().sendAction({ type: 'RAIJIN_PLACE', playerId: get().localPlayerId, payload: { provinceId } });
      return;
    }

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    const player = gameState.players.find(p => p.id === currentTemple.winnerId);
    if (!player || player.bushi <= 0) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    // Save pre-placement state for undo
    const preState = JSON.parse(JSON.stringify(gameState));

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

    const ns: GameState = {
      ...gameState,
      provinces: updatedProvinces,
      players: updatedPlayers,
      raijinPlacementActive: false,
      raijinPlacementDone: true,
      log: [...gameState.log, `${player.name} invoca un Bushi en ${province.name} (Raijin)`],
    };

    // Do NOT advance kami resolution yet - wait for player to confirm
    set({ gameState: ns, raijinPrePlaceState: preState });
  },

  doRaijinConfirm: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.raijinPlacementDone) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RAIJIN_CONFIRM', playerId: get().localPlayerId });
      return;
    }

    let ns: GameState = { ...gameState, raijinPlacementDone: false };
    ns = advanceKamiResolution(ns);

    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, raijinPrePlaceState: null, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns, raijinPrePlaceState: null, ...detectWarTransitionWithPopup(ns) });
    }
  },

  doRaijinUndo: () => {
    const { raijinPrePlaceState, gameState, ws } = get();
    if (!raijinPrePlaceState) return;
    if (ws && gameState?.mode === 'online') {
      get().sendAction({ type: 'RAIJIN_UNDO', playerId: get().localPlayerId });
    }
    set({ gameState: JSON.parse(JSON.stringify(raijinPrePlaceState)), raijinPrePlaceState: null });
  },

  doRyujinBuyCard: (cardId: string) => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.ryujinBuyActive) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RYUJIN_BUY', playerId: get().localPlayerId, payload: { cardId } });

      // Apply ryujinBuyCard locally to check if the card is a monster
      const currentTempleOnline = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
      if (!currentTempleOnline || !currentTempleOnline.winnerId) return;
      const nsOnline = ryujinBuyCard(gameState, currentTempleOnline.winnerId, cardId);
      const boughtCardOnline = nsOnline.players.find(p => p.id === currentTempleOnline.winnerId)?.seasonCards.find(c => c.id === cardId);
      if (boughtCardOnline && boughtCardOnline.cardType === 'monster') {
        // Monster card: run the placement UI locally (server will wait for MONSTER_PLACED)
        if (boughtCardOnline.id === 'sp-komainu' || boughtCardOnline.id === 'su-hotei') {
          set({
            gameState: { ...nsOnline, ryujinBuyActive: false },
            monsterPlacementCard: boughtCardOnline,
            monsterPlacementPlayerId: currentTempleOnline.winnerId,
            komainuChoiceVisible: true,
            monsterPlacementPopupVisible: false,
            monsterPlacementMode: false,
          });
        } else {
          // Check for Luna no-valid-province case
          const placingPlayerOnline = nsOnline.players.find(p => p.id === currentTempleOnline.winnerId);
          if (placingPlayerOnline && placingPlayerOnline.clanId === 'luna') {
            if (!lunaHasValidProvince(nsOnline, currentTempleOnline.winnerId)) {
              // No valid province: monster goes to reserve directly
              const updatedPlayersOnline = nsOnline.players.map(p => {
                if (p.id !== currentTempleOnline.winnerId) return p;
                return { ...p, monsters: p.monsters + 1 };
              });
              const nsUpdatedOnline: GameState = {
                ...nsOnline,
                players: updatedPlayersOnline,
                ryujinBuyActive: false,
                log: [...nsOnline.log, `Luna: no hay provincia valida para colocar monstruo - ${boughtCardOnline.name} se queda en reserva`],
              };
              set({
                gameState: nsUpdatedOnline,
                monsterPlacementCard: boughtCardOnline,
                monsterPlacementPlayerId: currentTempleOnline.winnerId,
                monsterPlacementPopupVisible: false,
                monsterNoPlacementPopupVisible: true,
                monsterPlacementMode: false,
                komainuChoiceVisible: false,
              });
              return;
            }
          }
          // Show popup asking where to place the monster
          set({
            gameState: { ...nsOnline, ryujinBuyActive: false },
            monsterPlacementCard: boughtCardOnline,
            monsterPlacementPlayerId: currentTempleOnline.winnerId,
            monsterPlacementPopupVisible: true,
            monsterPlacementMode: false,
            komainuChoiceVisible: false,
          });
        }
        return;
      }
      // Non-monster: server will advance, just return
      return;
    }

    const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
    if (!currentTemple || !currentTemple.winnerId) return;

    // Buy the card at full cost (no issuer discount)
    const ns = ryujinBuyCard(gameState, currentTemple.winnerId, cardId);

    // Check if the bought card is a monster - if so, enter monster placement flow
    const boughtCard = ns.players.find(p => p.id === currentTemple.winnerId)?.seasonCards.find(c => c.id === cardId);
    if (boughtCard && boughtCard.cardType === 'monster') {
      // Komainu/Hotei special case: show choice between map and pray
      if (boughtCard.id === 'sp-komainu' || boughtCard.id === 'su-hotei') {
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
      set({ gameState: updated, ...detectWarTransitionWithPopup(updated) });
    }
  },

  doRyujinSkip: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.kamiResolutionActive || !gameState.ryujinBuyActive) return;

    // In online mode, send the action to the server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RYUJIN_SKIP', playerId: get().localPlayerId });
      return;
    }

    let ns: GameState = {
      ...gameState,
      ryujinBuyActive: false,
      log: [...gameState.log, 'Recompensa de Ryujin saltada'],
    };

    ns = advanceKamiResolution(ns);

    if (!ns.kamiResolutionActive && ns.currentPhase === 'politics' && gameState.mode === 'hotseat') {
      set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
    } else {
      set({ gameState: ns, ...detectWarTransitionWithPopup(ns) });
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
    const nsRaw = initiateWarPhase(gameState);
    // Clear pending trade offers when leaving politics phase
    const ns = { ...nsRaw, tradeOffers: [] as typeof nsRaw.tradeOffers };
    if (ns.zorroPlacementActive) {
      // Zorro needs to place first, don't start battles yet
      set({ gameState: ns, battleCurrentBiddingIndex: 0 });
    } else {
      // Show war phase popup before starting battles
      const summary = computeWarUpgradeSummary(ns);
      set({ gameState: ns, warPhasePopupVisible: true, warPhaseUpgradeSummary: summary, battleCurrentBiddingIndex: 0 });
    }
    get().saveSnapshot();
  },

  doZorroPlaceBushi: (provinceId: string) => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (!gameState.zorroPlacementActive || !gameState.zorroPlacementPlayerId) return;

    // Online mode: send to server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ZORRO_PLACE_BUSHI', playerId: get().localPlayerId, payload: { provinceId } });
      return;
    }

    const zorroPlayer = gameState.players.find(p => p.id === gameState.zorroPlacementPlayerId);
    if (!zorroPlayer) return;

    // Validate: province must be a battle province where Zorro has no figures
    const isBattleProvince = gameState.warProvinceSlots.some(s => s.provinceId === provinceId);
    if (!isBattleProvince) return;

    const province = gameState.provinces[provinceId];
    if (!province) return;

    const hasOwnFigure = province.figures.some(f => f.owner === gameState.zorroPlacementPlayerId && f.type !== 'fortress');
    if (hasOwnFigure) return;

    if (zorroPlayer.bushi <= 0) return;
    if (gameState.zorroPlacementsRemaining <= 0) return;

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

    const newLog = [...gameState.log, `${zorroPlayer.name} (Zorro) coloca 1 Bushi en ${province.name}`];

    const ns: GameState = {
      ...gameState,
      players: newPlayers,
      provinces: newProvinces,
      zorroPlacementsRemaining: newRemaining,
      zorroPlacementActive: true,
      zorroPlacementPlayerId: gameState.zorroPlacementPlayerId,
      log: newLog,
    };

    set({ gameState: ns });
  },

  doZorroSkipPlacement: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (!gameState.zorroPlacementActive) return;

    // Online mode: send to server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'ZORRO_SKIP_PLACEMENT', playerId: get().localPlayerId });
      return;
    }

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

    const summary3 = computeWarUpgradeSummary(ns);
    set({ gameState: ns, warPhasePopupVisible: true, warPhaseUpgradeSummary: summary3, battleCurrentBiddingIndex: 0 });
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
        // Instead of resolving immediately, enter step-by-step resolution
        const battle = ns.activeBattles.find(b => b.provinceId === provinceId && !b.resolved);
        if (!battle) return;
        // Apply Fire Dragon pre-battle effect before determining tactic winners
        ns = applyFireDragonEffect(ns, provinceId);
        const resData = determineTacticWinners(ns, battle);
        // Enter first phase: seppuku decision if winner exists
        if (resData.seppukuWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'seppuku-decision', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else if (resData.hostageWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'hostage-selection', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else if (resData.roninWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'ronin-result', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else {
          // No interactive phases needed, resolve battle directly
          ns = resolveNextBattle(ns);
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0, battleResolutionData: null, selectedHostageTarget: null });
        }
      } else {
        // More participants need to bid - show popup for next participant
        const { battleCurrentBiddingIndex } = get();
        set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'popup', battleCurrentBiddingIndex: battleCurrentBiddingIndex + 1 });
      }
    } else {
      // Online mode: auto-resolve once all participants have submitted
      if (allBidsSubmitted(ns, provinceId)) {
        const battle = ns.activeBattles.find(b => b.provinceId === provinceId && !b.resolved);
        if (!battle) return;
        // Apply Fire Dragon pre-battle effect before determining tactic winners
        ns = applyFireDragonEffect(ns, provinceId);
        const resData = determineTacticWinners(ns, battle);
        if (resData.seppukuWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'seppuku-decision', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else if (resData.hostageWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'hostage-selection', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else if (resData.roninWinnerId) {
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'ronin-result', battleCurrentBiddingIndex: 0, battleResolutionData: resData, selectedHostageTarget: null });
        } else {
          ns = resolveNextBattle(ns);
          set({ gameState: ns, warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0, battleResolutionData: null, selectedHostageTarget: null });
        }
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
    set({ gameState: resolveNextBattle(gameState), warTacticBidsSubmitted: false, battleStepPhase: 'result', battleCurrentBiddingIndex: 0, battleResolutionData: null });
    get().saveSnapshot();
  },
  doSeppukuDecision: (accept: boolean) => {
    const { gameState, battleResolutionData, ws } = get();
    if (!gameState || !battleResolutionData || !battleResolutionData.seppukuWinnerId) return;

    // Online mode: send to server and let server handle
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SEPPUKU_DECISION', playerId: get().localPlayerId, payload: { accept } });
      return;
    }

    const unresolvedIdx = gameState.activeBattles.findIndex(b => !b.resolved && !b.uncontested);
    if (unresolvedIdx === -1) return;

    if (!accept) {
      // Player declines seppuku - skip to next phase
      const updatedResData: BattleResolutionData = { ...battleResolutionData, seppukuAccepted: false };
      if (updatedResData.hostageWinnerId) {
        set({ battleStepPhase: 'hostage-selection', battleResolutionData: updatedResData });
      } else if (updatedResData.roninWinnerId) {
        set({ battleStepPhase: 'ronin-result', battleResolutionData: updatedResData });
      } else {
        // No more interactive phases, resolve battle
        const withResData = attachResolutionData(gameState, updatedResData);
        const ns = resolveNextBattle(withResData);
        set({ gameState: ns, battleStepPhase: 'result', battleResolutionData: updatedResData, selectedHostageTarget: null });
      }
      return;
    }

    // Player accepts seppuku - kill all their troops in the battle province
    const seppukuPlayerId = battleResolutionData.seppukuWinnerId;
    const newState: GameState = {
      ...gameState,
      players: gameState.players.map(p => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages] })),
      provinces: { ...gameState.provinces },
      activeBattles: gameState.activeBattles.map(b => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
      honorTrack: [...gameState.honorTrack],
      log: [...gameState.log],
    };

    const battle = newState.activeBattles[unresolvedIdx];
    const province = newState.provinces[battle.provinceId];
    const bidder = newState.players.find(p => p.id === seppukuPlayerId)!;

    // Kill ALL own troops (bushi, shinto, daimyo, monster) - NOT fortress
    const ownFigures = province.figures.filter(
      f => f.owner === seppukuPlayerId && (f.type === 'bushi' || f.type === 'shinto' || f.type === 'daimyo' || f.type === 'monster')
    );
    const killCount = ownFigures.length;
    let phoenixDied = false;

    for (const fig of ownFigures) {
      bidder.victoryPoints += 1;
      if (fig.type === 'bushi') {
        bidder.bushi += 1;
      } else if (fig.type === 'shinto') {
        bidder.shinto += 1;
      } else if (fig.type === 'daimyo') {
        bidder.hasDaimyo = true;
      } else if (fig.type === 'monster') {
        bidder.monsters += 1;
        if (fig.monsterCardId === 'sp-phoenix') {
          phoenixDied = true;
        }
      }
    }

    // Remove killed figures from province
    const killedIds = new Set(ownFigures.map(f => f.id));
    newState.provinces[battle.provinceId] = {
      ...province,
      figures: province.figures.filter(f => !killedIds.has(f.id)),
    };

    // Phoenix revival: if Phoenix died, immediately place it back
    if (phoenixDied) {
      const figureId = Math.random().toString(36).substring(2, 10);
      const phoenixFigure = { type: 'monster' as const, owner: seppukuPlayerId, id: figureId, monsterCardId: 'sp-phoenix' };
      newState.provinces[battle.provinceId] = {
        ...newState.provinces[battle.provinceId],
        figures: [...newState.provinces[battle.provinceId].figures, phoenixFigure],
      };
      // Phoenix revives so it's no longer in reserve
      bidder.monsters -= 1;
    }

    // Gain honor for each killed figure
    for (let i = 0; i < killCount; i++) {
      gainHonor(newState, seppukuPlayerId);
    }

    newState.log = [...newState.log, `${bidder.name} comete Seppuku: elimina ${killCount} figuras por ${killCount} PV y ${killCount} Honor`];

    // Compute figure type breakdown for the seppuku result popup
    const figureTypeCounts: Record<string, number> = {};
    for (const fig of ownFigures) {
      figureTypeCounts[fig.type] = (figureTypeCounts[fig.type] || 0) + 1;
    }
    const seppukuFigures = Object.entries(figureTypeCounts).map(([type, count]) => ({ type, count }));

    const updatedResData: BattleResolutionData = {
      ...battleResolutionData,
      seppukuAccepted: true,
      seppukuKillCount: killCount,
      phoenixDiedInSeppuku: phoenixDied,
      seppukuFigures,
    };

    set({ gameState: newState, battleStepPhase: 'seppuku-result', battleResolutionData: updatedResData });
  },
  doSeppukuResultAccept: () => {
    const { gameState, battleResolutionData, ws } = get();
    if (!gameState || !battleResolutionData) return;

    // In online mode, notify server so all clients transition
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'SEPPUKU_RESULT_ACCEPT', playerId: get().localPlayerId });
      return;
    }

    // Move to next phase
    if (battleResolutionData.hostageWinnerId) {
      set({ battleStepPhase: 'hostage-selection' });
    } else if (battleResolutionData.roninWinnerId) {
      set({ battleStepPhase: 'ronin-result' });
    } else {
      // No more interactive phases, resolve battle
      if (ws && gameState.mode === 'online') {
        // Server needs to resolve - send RESOLVE_BATTLE
        get().sendAction({ type: 'RESOLVE_BATTLE', playerId: get().localPlayerId });
        return;
      }
      const withResData = attachResolutionData(gameState, battleResolutionData);
      const ns = resolveNextBattle(withResData);
      set({ gameState: ns, battleStepPhase: 'result', battleResolutionData: battleResolutionData, selectedHostageTarget: null });
    }
  },
  doHostageSelect: (figureId: string) => {
    const { gameState, battleResolutionData } = get();
    if (!gameState || !battleResolutionData || !battleResolutionData.hostageWinnerId) return;

    const unresolvedIdx = gameState.activeBattles.findIndex(b => !b.resolved && !b.uncontested);
    if (unresolvedIdx === -1) return;
    const battle = gameState.activeBattles[unresolvedIdx];
    const province = gameState.provinces[battle.provinceId];

    const figure = province.figures.find(f => f.id === figureId);
    if (!figure) return;

    // Determine figure name
    let figureName = figure.type === 'bushi' ? 'Bushi' : figure.type === 'shinto' ? 'Shinto' : '';
    if (figure.type === 'monster' && figure.monsterCardId) {
      const card = SEASON_CARDS_DATA.find(c => c.id === figure.monsterCardId);
      figureName = card?.name || figure.monsterCardId || 'Monster';
    }

    set({ selectedHostageTarget: { owner: figure.owner, figureId: figure.id, figureType: figure.type, figureName } });
  },
  doHostageConfirm: () => {
    const { gameState, battleResolutionData, selectedHostageTarget, ws } = get();
    if (!gameState || !battleResolutionData || !battleResolutionData.hostageWinnerId || !selectedHostageTarget) return;

    // Online mode: send to server and let server handle
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'HOSTAGE_CONFIRM', playerId: get().localPlayerId, payload: { figureId: selectedHostageTarget.figureId } });
      return;
    }

    const unresolvedIdx = gameState.activeBattles.findIndex(b => !b.resolved && !b.uncontested);
    if (unresolvedIdx === -1) return;

    const hostageWinnerId = battleResolutionData.hostageWinnerId;

    const newState: GameState = {
      ...gameState,
      players: gameState.players.map(p => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages] })),
      provinces: { ...gameState.provinces },
      activeBattles: gameState.activeBattles.map(b => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
      honorTrack: [...gameState.honorTrack],
      log: [...gameState.log],
    };

    const battle = newState.activeBattles[unresolvedIdx];
    const province = newState.provinces[battle.provinceId];
    const captor = newState.players.find(p => p.id === hostageWinnerId)!;

    // Find and remove the figure from the province
    const capturedFig = province.figures.find(f => f.id === selectedHostageTarget.figureId);
    if (!capturedFig) return;

    const hostage: Hostage = { fromClanId: capturedFig.owner, figureType: selectedHostageTarget.figureType, figureName: selectedHostageTarget.figureName };
    captor.hostages.push(hostage);
    captor.victoryPoints += 1;

    newState.provinces[battle.provinceId] = {
      ...province,
      figures: province.figures.filter(f => f.id !== selectedHostageTarget.figureId),
    };

    // Return figure to victim's reserve
    const victim = newState.players.find(p => p.id === capturedFig.owner);
    if (victim) {
      if (capturedFig.type === 'bushi') victim.bushi += 1;
      else if (capturedFig.type === 'shinto') victim.shinto += 1;
      else if (capturedFig.type === 'monster') victim.monsters += 1;
    }

    newState.log = [...newState.log, `${captor.name} captura un rehen (${selectedHostageTarget.figureName}) de ${victim?.name}`];

    const updatedResData: BattleResolutionData = {
      ...battleResolutionData,
      capturedHostage: { captorId: hostageWinnerId, fromClanId: capturedFig.owner, figureType: capturedFig.type, figureName: selectedHostageTarget.figureName, monsterCardId: capturedFig.monsterCardId },
    };

    // Move to next phase
    if (updatedResData.roninWinnerId) {
      set({ gameState: newState, battleStepPhase: 'ronin-result', battleResolutionData: updatedResData, selectedHostageTarget: null });
    } else {
      // Resolve battle
      const withResData = attachResolutionData(newState, updatedResData);
      const ns = resolveNextBattle(withResData);
      set({ gameState: ns, battleStepPhase: 'result', battleResolutionData: updatedResData, selectedHostageTarget: null });
    }
  },
  doHostageSkip: () => {
    const { gameState, battleResolutionData, ws } = get();
    if (!gameState || !battleResolutionData) return;

    // Online mode: send skip to server (empty figureId means skip)
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'HOSTAGE_CONFIRM', playerId: get().localPlayerId, payload: { figureId: null } });
      return;
    }

    // No capturable figures - advance to next phase
    if (battleResolutionData.roninWinnerId) {
      set({ battleStepPhase: 'ronin-result', selectedHostageTarget: null });
    } else {
      const withResData = attachResolutionData(gameState, battleResolutionData);
      const ns = resolveNextBattle(withResData);
      set({ gameState: ns, battleStepPhase: 'result', battleResolutionData: battleResolutionData, selectedHostageTarget: null });
    }
  },
  doRoninResultAccept: () => {
    const { gameState, battleResolutionData, ws } = get();
    if (!gameState || !battleResolutionData) return;

    // Online mode: tell server to resolve the battle
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'RESOLVE_BATTLE', playerId: get().localPlayerId });
      return;
    }

    // Resolve the battle with final force calculation
    const withResData = attachResolutionData(gameState, battleResolutionData);
    const ns = resolveNextBattle(withResData);

    // Store resolution data for result popup
    set({ gameState: ns, battleStepPhase: 'result', selectedHostageTarget: null });
  },
  doAcceptBattlePopup: () => {
    const { gameState, ws } = get();
    if (!gameState) return;

    // If showing a battle result, dismiss it and move to popup for the next battle
    if (get().battleStepPhase === 'result') {
      // Online mode: send acceptance to server and wait for broadcast
      if (ws && gameState.mode === 'online') {
        get().sendAction({ type: 'BATTLE_RESULT_ACCEPTED', playerId: get().localPlayerId });
        return;
      }
      // Check if all battles are now resolved
      const allResolved = gameState.activeBattles.every(b => b.resolved || b.uncontested);
      if (allResolved) {
        set({ battleStepPhase: null, battleCurrentBiddingIndex: 0, battleResolutionData: null, selectedHostageTarget: null, warSummaryVisible: true });
        return;
      }
      set({ battleStepPhase: 'popup', battleCurrentBiddingIndex: 0, battleResolutionData: null, selectedHostageTarget: null });
      return;
    }

    const currentBattleIndex = gameState.activeBattles.findIndex(b => !b.resolved);
    if (currentBattleIndex === -1) {
      set({ battleStepPhase: null, battleCurrentBiddingIndex: 0, battleResolutionData: null, selectedHostageTarget: null });
      return;
    }

    const battle = gameState.activeBattles[currentBattleIndex];

    if (battle.uncontested) {
      // Online mode: send acceptance to server - it manages battle resolution state
      if (ws && gameState.mode === 'online') {
        get().sendAction({ type: 'BATTLE_RESULT_ACCEPTED', playerId: get().localPlayerId });
        return;
      }
      // Mark uncontested battle as resolved (user accepted the popup)
      const province = gameState.provinces[battle.provinceId];
      const battleNumber = currentBattleIndex + 1;
      const provinceName = province?.name || battle.provinceId;
      const newLog = [...gameState.log, `--- Inicio Batalla ${battleNumber} (${provinceName}) ---`];
      if (battle.winner) {
        const winner = gameState.players.find(p => p.id === battle.winner);
        newLog.push(`${winner?.name || ''} gana sin oposicion en ${provinceName}`);
      } else {
        newLog.push(`Ficha de guerra descartada en ${provinceName}`);
      }
      newLog.push(`--- Batalla ${battleNumber} resuelta ---`);
      const updatedBattles = [...gameState.activeBattles];
      updatedBattles[currentBattleIndex] = { ...battle, resolved: true };
      // Check if this was the last battle
      const allNowResolved = updatedBattles.every(b => b.resolved || b.uncontested);
      if (allNowResolved) {
        set({
          gameState: { ...gameState, activeBattles: updatedBattles, log: newLog },
          battleStepPhase: null,
          battleCurrentBiddingIndex: 0,
          warSummaryVisible: true,
        });
        return;
      }
      set({
        gameState: { ...gameState, activeBattles: updatedBattles, log: newLog },
        battleStepPhase: 'popup',
        battleCurrentBiddingIndex: 0,
      });
      return;
    }

    // Contested battle: transition from popup to bidding
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BATTLE_POPUP_READY', playerId: get().localPlayerId });
      return;
    }
    set({ battleStepPhase: 'bidding' });
  },

  // --- Coin Distribution ---
  doCoinDistributionChoice: (targetPlayerId) => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.coinDistributionPending) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'COIN_DISTRIBUTION_CHOICE', playerId: get().localPlayerId, payload: { targetPlayerId } });
      return;
    }

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

  // --- Coin Distribution Dismiss (informational only, no remainder) ---
  doCoinDistributionDismiss: () => {
    const { gameState, ws } = get();
    if (!gameState || !gameState.coinDistributionPending) return;

    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'COIN_DISTRIBUTION_READY', playerId: get().localPlayerId });
      return;
    }

    const newState: GameState = {
      ...gameState,
      coinDistributionPending: null,
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
    get().saveSnapshot();
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
      // During marshal mandate, apply moves locally instead of sending to server
      if (gameState.marshalMandateActive) {
        const ns = moveForces(gameState, apid, fromProvinceId, toProvinceId, figureIds);
        if (ns.marshalMandateActive) {
          set({ gameState: ns, moveFrom: null, selectedFigures: [], marshalPendingMoves: [...get().marshalPendingMoves, { fromProvinceId, toProvinceId, figureIds }] });
        } else {
          set({ gameState: ns, moveMode: false, moveFrom: null, selectedFigures: [], marshalPendingMoves: [...get().marshalPendingMoves, { fromProvinceId, toProvinceId, figureIds }] });
        }
        return;
      }
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
    set({ gameState: ns, ...detectWarTransitionWithPopup(ns), ...(gameState.mode === 'hotseat' && ns.currentPhase === 'politics' ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
    get().saveSnapshot();
  },
  doAdvancePlayer: () => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState) return;
    // In online mode during tea phase, send to server and let broadcast handle state update
    if (ws && gameState.mode === 'online' && gameState.currentPhase === 'tea') {
      get().sendAction({ type: 'TEA_ADVANCE_PLAYER', playerId: localPlayerId });
      return;
    }
    const ns = advancePlayer(gameState);
    // Detect war phase transition and set up battle step phase for hotseat
    set({ gameState: ns, ...detectWarTransitionWithPopup(ns), ...detectKamiPopupPending(ns), ...(gameState.mode === 'hotseat' && (ns.currentPhase === 'tea' || (gameState.currentPhase === 'tea' && ns.currentPhase === 'politics')) ? { turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null } : {}) });
  },

  // --- Turn Popup (hotseat mandate transitions + online politics) ---
  dismissTurnPopup: () => {
    const { gameState, localPlayerId, ws } = get();
    set({ turnPopupPlayer: null, turnPopupDismissedForIndex: gameState?.currentPlayerIndex ?? null });
    // For online politics: after dismissing turn popup, draw mandate tiles for this player
    if (ws && gameState && gameState.mode === 'online' && gameState.currentPhase === 'politics' && gameState.drawnMandates.length === 0 && !gameState.mandateChoicePhase && !gameState.marshalMandateActive && !gameState.recruitMandateActive && !gameState.betrayMandateActive && !gameState.harvestMandateActive && !gameState.trainMandateActive) {
      get().sendAction({ type: 'DRAW_MANDATE_TILES', playerId: localPlayerId });
    }
  },

  // --- Kami Phase Popup ---
  dismissKamiPhasePopup: () => {
    const { gameState, kamiPendingTemples } = get();
    if (!gameState || !kamiPendingTemples) return;
    if (gameState.mode === 'online') {
      // Online: send ready signal and wait for all players
      get().sendAction({ type: 'KAMI_PHASE_READY', playerId: get().localPlayerId });
      return;
    }
    // Hotseat: directly activate
    const ns: GameState = {
      ...gameState,
      kamiResolutionActive: true,
      kamiPhasePopupPending: false,
    };
    set({ gameState: ns, kamiPhasePopupVisible: false, kamiPendingTemples: null });
  },

  doKamiPhaseReady: () => {
    const { gameState, ws, localPlayerId } = get();
    if (!gameState || !localPlayerId) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'KAMI_PHASE_READY', playerId: localPlayerId });
    }
  },

  doKamiSummaryReady: () => {
    const { gameState, ws, localPlayerId, kamiSummaryVisibleSince } = get();
    if (!gameState || !localPlayerId) return;
    // Debounce: prevent accepting the popup within the first 500ms of it appearing
    if (kamiSummaryVisibleSince && Date.now() - kamiSummaryVisibleSince < 500) return;
    if (ws && gameState.mode === 'online') {
      // Optimistically add local player to kamiSummaryReadyPlayers so the UI immediately shows "Listo x/x"
      if (!gameState.kamiSummaryReadyPlayers.includes(localPlayerId)) {
        const updatedState: GameState = {
          ...gameState,
          kamiSummaryReadyPlayers: [...gameState.kamiSummaryReadyPlayers, localPlayerId],
        };
        set({ gameState: updatedState });
      }
      get().sendAction({ type: 'KAMI_SUMMARY_READY', playerId: localPlayerId });
    } else {
      // Hotseat: directly clear summary and show turn popup for next player
      const ns: GameState = { ...gameState, kamiSummaryVisible: false, kamiSummaryData: [], kamiSummaryReadyPlayers: [] };
      if (ns.currentPhase === 'politics' && !ns.kamiResolutionActive) {
        set({ gameState: ns, turnPopupPlayer: ns.players[ns.currentPlayerIndex]?.id || null });
      } else {
        set({ gameState: ns });
      }
    }
  },

  kamiTurnPopupShownForIndex: null,
  kamiSummaryVisibleSince: null,

  // --- War Phase Popup ---
  dismissWarPhasePopup: () => {
    const { gameState, ws } = get();
    if (!gameState) return;

    // Online mode: send WAR_PHASE_READY to server, don't hide locally (wait for server)
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'WAR_PHASE_READY', playerId: get().localPlayerId });
      return;
    }

    // Hotseat: if Daikaiju placement is active, don't resolve battles yet
    if (gameState.daikaijuPlacementActive) {
      set({ warPhasePopupVisible: false, warPhaseUpgradeSummary: [] });
      return;
    }

    const updatedState = resolveUncontestedBattles(gameState);
    set({ gameState: updatedState, warPhasePopupVisible: false, warPhaseUpgradeSummary: [], battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
  },

  // --- Daikaiju Placement Actions ---
  doDaikaijuPlaceProvince: (provinceId: string) => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (!gameState.daikaijuPlacementActive || !gameState.daikaijuPlacementPlayerId) return;

    // Online mode: send to server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'DAIKAIJU_PLACE_PROVINCE', playerId: get().localPlayerId, payload: { provinceId } });
      return;
    }

    // Hotseat: do the logic locally
    const targetProvince = gameState.provinces[provinceId];
    if (!targetProvince || provinceId === 'ocean') return;

    const daikaijuPlayerId = gameState.daikaijuPlacementPlayerId;
    const oceanProv = gameState.provinces['ocean'];
    if (!oceanProv) return;
    const daikaijuFigure = oceanProv.figures.find(f => f.type === 'monster' && f.monsterCardId === 'au-daikaiju');
    if (!daikaijuFigure) return;

    // Move Daikaiju from ocean to target province
    let ns: GameState = {
      ...gameState,
      provinces: {
        ...gameState.provinces,
        ocean: { ...oceanProv, figures: oceanProv.figures.filter(f => f.id !== daikaijuFigure.id) },
        [provinceId]: { ...targetProvince, figures: [...targetProvince.figures, daikaijuFigure] },
      },
    };

    // Destroy ALL fortresses in target province (including own and Tortuga's)
    const allFortresses = ns.provinces[provinceId].figures.filter(f => f.type === 'fortress');
    const destroyedFortressMap: { [playerId: string]: number } = {};
    for (const fort of allFortresses) {
      destroyedFortressMap[fort.owner] = (destroyedFortressMap[fort.owner] || 0) + 1;
    }

    // Remove fortresses from province and return to owners
    ns = {
      ...ns,
      provinces: {
        ...ns.provinces,
        [provinceId]: {
          ...ns.provinces[provinceId],
          figures: ns.provinces[provinceId].figures.filter(f => f.type !== 'fortress'),
        },
      },
      players: ns.players.map(p => {
        const returned = destroyedFortressMap[p.id] || 0;
        if (returned > 0) return { ...p, fortresses: p.fortresses + returned };
        return p;
      }),
    };

    // Build summary data
    const destroyedFortresses = Object.entries(destroyedFortressMap).map(([pId, count]) => {
      const player = ns.players.find(p => p.id === pId);
      return { playerId: pId, playerName: player?.name || 'jugador', count };
    });

    const daikaijuOwner = ns.players.find(p => p.id === daikaijuPlayerId);
    ns = {
      ...ns,
      daikaijuPlacementActive: false,
      daikaijuSummaryVisible: true,
      daikaijuSummaryReadyPlayers: [],
      daikaijuSummaryData: { provinceId, provinceName: targetProvince.name, destroyedFortresses },
      log: [...ns.log, `🦕 Daikaiju de ${daikaijuOwner?.name || 'jugador'} aparece en ${targetProvince.name} y destruye ${allFortresses.length} fortaleza(s)`],
    };

    set({ gameState: ns });
  },

  doDaikaijuSummaryReady: () => {
    const { gameState, ws } = get();
    if (!gameState) return;

    // Online mode: send to server
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'DAIKAIJU_SUMMARY_READY', playerId: get().localPlayerId });
      return;
    }

    // Hotseat: clear summary and proceed to battles
    const ns: GameState = {
      ...gameState,
      daikaijuSummaryVisible: false,
      daikaijuSummaryReadyPlayers: [],
      daikaijuSummaryData: null,
    };
    const updatedState = resolveUncontestedBattles(ns);
    set({ gameState: updatedState, battleStepPhase: 'popup', battleCurrentBiddingIndex: 0 });
  },

  // --- War Summary Popup (end of all battles) ---
  dismissWarSummaryPopup: () => {
    const { gameState, ws } = get();
    if (!gameState) return;

    // Online mode: send WAR_SUMMARY_READY to server, don't hide locally (wait for server)
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'WAR_SUMMARY_READY', playerId: get().localPlayerId });
      return;
    }

    // Hotseat: advance to cleanup phase directly
    const ns = advancePhase(gameState);
    set({ gameState: ns, warSummaryVisible: false, battleStepPhase: null });
  },

  // --- Battle Result Acceptance for Online ---
  doAcceptBattleResultOnline: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'BATTLE_RESULT_ACCEPTED', playerId: get().localPlayerId });
    }
  },

  // --- Interactive Cleanup: Hostage Return Accepted ---
  doHostageReturnAccepted: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'HOSTAGE_RETURN_ACCEPTED', playerId: get().localPlayerId });
      return;
    }
    // Hotseat: process locally
    const ns = processHostageReturn(gameState);
    set({ gameState: ns });
    get().saveSnapshot();
  },

  // --- Interactive Cleanup: Tea Ceremony Ready ---
  doCleanupTeaCeremonyReady: () => {
    const { gameState, ws } = get();
    if (!gameState) return;
    if (ws && gameState.mode === 'online') {
      get().sendAction({ type: 'CLEANUP_TEA_CEREMONY_READY', playerId: get().localPlayerId });
      return;
    }
    // Hotseat: advance directly
    const ns = finalizeCleanupAndAdvance(gameState);
    set({ gameState: ns });
    get().saveSnapshot();
  },

  // --- Online ---
  connectWebSocket: (url, onOpen) => {
    const { authToken } = get();
    const wsUrl = authToken ? `${url}${url.includes('?') ? '&' : '?'}token=${authToken}` : url;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => { if (onOpen) onOpen(ws); };
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      switch (d.type) {
        case 'GAME_STATE': {
          const state = d.state;
          let newTurnPopup: string | null = null;
          const { turnPopupDismissedForIndex, localPlayerId: lpId, gameState: prevGameState } = get();
          const prevPlayerIndex = prevGameState?.currentPlayerIndex;
          const prevTrainResolutionIndex = prevGameState?.trainResolutionIndex;

          // Reset dismissed tracking when the current player index changes (compute early so popup logic uses the correct value)
          const dismissedIdx = (turnPopupDismissedForIndex !== null && turnPopupDismissedForIndex !== state.currentPlayerIndex) ? null : turnPopupDismissedForIndex;

          if (state.mode === 'online' && state.currentPhase === 'politics') {
            const noResolution = !state.trainMandateActive && !state.marshalMandateActive && !state.recruitMandateActive && !state.betrayMandateActive && !state.harvestMandateActive;
            if (noResolution && state.drawnMandates.length === 0 && !state.mandateChoicePhase && !state.kamiResolutionActive && !state.kamiSummaryVisible && !state.kamiPhasePopupPending) {
              // Only show the popup if it wasn't already dismissed for this player's turn
              // Use the potentially-reset dismissedIdx so popup fires after mandate resolution ends and advancePlayer changes currentPlayerIndex
              if (dismissedIdx !== state.currentPlayerIndex) {
                newTurnPopup = state.players[state.currentPlayerIndex]?.id || null;
              }
            }
            // During train mandate resolution: show turn popup when trainResolutionIndex changes and it's the local player's turn
            if (state.trainMandateActive) {
              const currentTrainPlayer = state.trainResolutionOrder?.[state.trainResolutionIndex];
              if (currentTrainPlayer === lpId) {
                // First trigger: trainMandateActive just became true (was false/undefined before)
                if (!prevGameState?.trainMandateActive) {
                  newTurnPopup = lpId;
                } else if (prevTrainResolutionIndex !== undefined && prevTrainResolutionIndex !== null && state.trainResolutionIndex !== prevTrainResolutionIndex) {
                  // Subsequent triggers: trainResolutionIndex changed
                  newTurnPopup = lpId;
                } else if (prevPlayerIndex !== undefined && prevPlayerIndex !== null && state.currentPlayerIndex !== prevPlayerIndex) {
                  newTurnPopup = lpId;
                }
              }
            }
            // During other mandate resolution (marshal, recruit, betray), show turn popup when currentPlayerIndex changes
            const otherMandateActive = state.marshalMandateActive || state.recruitMandateActive || state.betrayMandateActive;
            if (otherMandateActive && !state.kamiResolutionActive && prevPlayerIndex !== undefined && prevPlayerIndex !== null && state.currentPlayerIndex !== prevPlayerIndex) {
              const newCurrentPlayerId = state.players[state.currentPlayerIndex]?.id;
              if (newCurrentPlayerId && newCurrentPlayerId === lpId) {
                newTurnPopup = newCurrentPlayerId;
              }
            }
          }

          // Build UI state resets for online mode: clean up client-local flags when mandates are no longer active
          const uiResets: Record<string, unknown> = {};
          if (state.mode === 'online') {
            if (!state.recruitMandateActive) {
              uiResets.recruitMode = false;
              if (!state.marshalMandateActive && !state.betrayMandateActive) {
                uiResets.undoMandateState = null;
              }
            }
            if (state.recruitMandateActive && lpId) {
              // Auto-select recruit mode when it's this player's recruit turn (same as hotseat behavior)
              const currentRecruitPlayerId = state.players[state.currentPlayerIndex]?.id;
              if (currentRecruitPlayerId === lpId) {
                uiResets.recruitMode = true;
                // Only reset recruitFigureType to 'bushi' when the recruit turn is STARTING
                // (player index changed or recruitMandateActive just became true), not on every broadcast
                const recruitTurnJustStarted = prevPlayerIndex !== state.currentPlayerIndex || !prevGameState?.recruitMandateActive;
                if (recruitTurnJustStarted) {
                  uiResets.recruitFigureType = 'bushi';
                }
                // Save undo state when recruit turn begins (don't overwrite during local placements)
                const existingUndo = get().undoMandateState;
                if (!existingUndo) {
                  uiResets.undoMandateState = JSON.parse(JSON.stringify(state));
                }
              } else {
                // Not this player's recruit turn - deactivate recruit mode
                uiResets.recruitMode = false;
                uiResets.undoMandateState = null;
              }
            }
            if (!state.marshalMandateActive) {
              // Don't reset moveMode during Fujin resolution
              if (!(state.kamiResolutionActive && state.kamiResolutionStep === 'interactive')) {
                uiResets.moveMode = false;
                uiResets.moveFrom = null;
                uiResets.selectedFigures = [];
              }
              uiResets.buildFortressMode = false;
              if (!state.recruitMandateActive && !state.betrayMandateActive) {
                uiResets.undoMandateState = null;
              }
              uiResets.marshalPendingMoves = [];
              uiResets.marshalPendingFortresses = [];
            }
            // Fujin movement: override moveMode when kami resolution is in interactive step with moves remaining
            if (state.kamiResolutionActive && state.kamiResolutionStep === 'interactive' && state.kamiResolutionCurrentPlayerId === lpId) {
              const currentTemple = state.kamiResolutionTemples?.[state.kamiResolutionIndex];
              if (currentTemple?.kamiType === 'fujin') {
                if (state.fujinMovesRemaining > 0) {
                  uiResets.moveMode = true;
                }
                uiResets.moveFrom = null;
                uiResets.selectedFigures = [];
              }
            }
            if (!state.betrayMandateActive) {
              uiResets.betrayMode = false;
            }
            if (state.betrayMandateActive && lpId) {
              // Betray is only for the issuer - check if local player is the current player (issuer)
              const currentBetrayPlayerId = state.players[state.currentPlayerIndex]?.id;
              if (currentBetrayPlayerId === lpId) {
                uiResets.betrayMode = true;
                // Save undo state when betray turn begins
                const existingUndo = get().undoMandateState;
                if (!existingUndo) {
                  uiResets.undoMandateState = JSON.parse(JSON.stringify(state));
                }
              }
            }
          }

          // Force show turn popup when a mandate just ended and no mandate is active now
          const prevMandateWasActive = prevGameState?.trainMandateActive || prevGameState?.marshalMandateActive || prevGameState?.recruitMandateActive || prevGameState?.betrayMandateActive || prevGameState?.harvestMandateActive;
          const noMandateNow = !state.trainMandateActive && !state.marshalMandateActive && !state.recruitMandateActive && !state.betrayMandateActive && !state.harvestMandateActive;
          if (prevMandateWasActive && noMandateNow && state.drawnMandates.length === 0 && !state.mandateChoicePhase && !state.kamiResolutionActive && !state.kamiSummaryVisible && !state.kamiPhasePopupPending) {
            newTurnPopup = state.players[state.currentPlayerIndex]?.id || null;
            uiResets.turnPopupDismissedForIndex = null;
          }

          // Harvest mandate transition: show turn popup when harvest ends for all players
          if (state.mode === 'online' && prevGameState?.harvestMandateActive && !state.harvestMandateActive && !state.kamiResolutionActive && !state.kamiSummaryVisible && !state.kamiPhasePopupPending) {
            newTurnPopup = state.players[state.currentPlayerIndex]?.id || null;
            uiResets.turnPopupDismissedForIndex = null;
          }

          // For online marshal: save undoMandateState when it's this player's marshal turn
          // Only set when we receive a fresh state from the server (not from local modifications)
          if (state.mode === 'online' && state.marshalMandateActive && lpId) {
            const currentMarshalPlayerId = state.marshalResolutionOrder?.[state.marshalResolutionIndex];
            if (currentMarshalPlayerId === lpId) {
              // Only set undoMandateState if we don't already have one (avoid overwriting during local moves)
              const existingUndo = get().undoMandateState;
              if (!existingUndo) {
                uiResets.undoMandateState = JSON.parse(JSON.stringify(state));
                uiResets.marshalPendingMoves = [];
                uiResets.marshalPendingFortresses = [];
              }
            }
          }

          // Detect kami phase popup pending for online
          // Guard: only trigger if not already visible/dismissed locally (avoid re-trigger on subsequent broadcasts)
          if (state.kamiPhasePopupPending && !state.kamiResolutionActive && !get().kamiPhasePopupVisible && !get().gameState?.kamiResolutionActive && !state.kamiSummaryVisible) {
            uiResets.kamiPhasePopupVisible = true;
            uiResets.kamiPendingTemples = state.kamiResolutionTemples;
          }

          // When kamiSummaryVisible is true, ensure kami phase start popup is hidden
          if (state.kamiSummaryVisible) {
            uiResets.kamiPhasePopupVisible = false;
            uiResets.kamiPendingTemples = null;
            // Track when kamiSummaryVisible transitions from false to true for debounce
            if (!prevGameState?.kamiSummaryVisible) {
              uiResets.kamiSummaryVisibleSince = Date.now();
            }
          } else {
            // Reset the timestamp when summary is no longer visible
            if (prevGameState?.kamiSummaryVisible) {
              uiResets.kamiSummaryVisibleSince = null;
            }
          }

          // When kamiResolutionActive becomes true and we are in online mode: hide kami phase popup
          if (state.kamiResolutionActive && !state.kamiPhasePopupPending) {
            uiResets.kamiPhasePopupVisible = false;
            uiResets.kamiPendingTemples = null;
          }

          // When kamiSummaryVisible becomes false after being true: show turn popup for mandate selector
          if (state.mode === 'online' && prevGameState?.kamiSummaryVisible && !state.kamiSummaryVisible) {
            newTurnPopup = state.players[state.currentPlayerIndex]?.id || null;
            uiResets.turnPopupDismissedForIndex = null;
            uiResets.kamiTurnPopupShownForIndex = null;
          }

          // --- Online War Phase detection ---
          if (state.mode === 'online' && state.currentPhase === 'war') {
            // When war phase just started and no Zorro placement, show war phase popup directly
            const prevPhase = prevGameState?.currentPhase;
            if (prevPhase !== 'war' && !state.zorroPlacementActive && !state.kamiSummaryVisible) {
              uiResets.warPhasePopupVisible = true;
              uiResets.warPhaseUpgradeSummary = computeWarUpgradeSummary(state);
            }

            // When Zorro placement ends (zorroPlacementActive becomes false), show war phase popup
            const prevZorroActive = prevGameState?.zorroPlacementActive;
            if (prevZorroActive && !state.zorroPlacementActive && !state.kamiSummaryVisible) {
              uiResets.warPhasePopupVisible = true;
              uiResets.warPhaseUpgradeSummary = computeWarUpgradeSummary(state);
            }

            // When warPhaseReadyPlayers clears (all accepted war summary), start battle flow
            const prevWarPhaseReady = prevGameState?.warPhaseReadyPlayers?.length || 0;
            if (prevWarPhaseReady > 0 && (state.warPhaseReadyPlayers?.length || 0) === 0 && !state.zorroPlacementActive) {
              // War phase popup accepted by all - hide popup
              uiResets.warPhasePopupVisible = false;
              uiResets.warPhaseUpgradeSummary = [];
              // Only start battles if Daikaiju placement is not active
              if (!state.daikaijuPlacementActive) {
                uiResets.battleStepPhase = 'popup';
                uiResets.battleCurrentBiddingIndex = 0;
              }
            }

            // When daikaijuSummaryVisible goes from true to false (all players accepted), start battles
            if (prevGameState?.daikaijuSummaryVisible && !state.daikaijuSummaryVisible) {
              uiResets.battleStepPhase = 'popup';
              uiResets.battleCurrentBiddingIndex = 0;
            }

            // When battlePopupReadyPlayers clears (all accepted battle start popup), transition to bidding
            const prevBattlePopupReady = prevGameState?.battlePopupReadyPlayers?.length || 0;
            if (prevBattlePopupReady > 0 && (state.battlePopupReadyPlayers?.length || 0) === 0) {
              uiResets.battleStepPhase = 'bidding';
            }

            // When battleResultReadyPlayers clears (all accepted battle result), advance to next battle popup
            const prevBattleReady = prevGameState?.battleResultReadyPlayers?.length || 0;
            if (prevBattleReady > 0 && (state.battleResultReadyPlayers?.length || 0) === 0) {
              // Check if all battles are now resolved - if so, show war summary instead
              const allBattlesResolved = state.activeBattles?.length > 0 && state.activeBattles.every((b: { resolved?: boolean; uncontested?: boolean }) => b.resolved || b.uncontested);
              if (allBattlesResolved) {
                uiResets.warSummaryVisible = true;
                uiResets.battleStepPhase = null;
              } else {
                uiResets.battleStepPhase = 'popup';
                uiResets.battleCurrentBiddingIndex = 0;
                uiResets.battleResolutionData = null;
                uiResets.selectedHostageTarget = null;
              }
            }

            // Reconnection support: if server has warSummaryVisible=true but client doesn't, show it
            if (state.warSummaryVisible && !get().warSummaryVisible) {
              uiResets.warSummaryVisible = true;
              uiResets.battleStepPhase = null;
            }

            // When server clears warSummaryVisible (all accepted), hide client popup
            if (!state.warSummaryVisible && get().warSummaryVisible) {
              uiResets.warSummaryVisible = false;
              uiResets.battleStepPhase = null;
            }

            // Clear war summary when server advances to hostage return
            if (state.hostageReturnActive && get().warSummaryVisible) {
              uiResets.warSummaryVisible = false;
              uiResets.battleStepPhase = null;
            }

            // Detect battle just resolved (server resolved via SUBMIT_WAR_BIDS): show result
            const prevResolvedCount = prevGameState?.activeBattles?.filter((b: { resolved?: boolean; uncontested?: boolean }) => b.resolved && !b.uncontested).length || 0;
            const currentResolvedCount = state.activeBattles?.filter((b: { resolved?: boolean; uncontested?: boolean }) => b.resolved && !b.uncontested).length || 0;
            if (currentResolvedCount > prevResolvedCount && prevBattleReady === 0) {
              uiResets.battleStepPhase = 'result';
            }

            // Detect when server attaches resolutionData to a battle (interactive steps needed)
            const unresolvedWithResData = state.activeBattles?.find((b: { resolved?: boolean; uncontested?: boolean; resolutionData?: BattleResolutionData }) => !b.resolved && !b.uncontested && b.resolutionData);
            const prevUnresolvedWithResData = prevGameState?.activeBattles?.find((b: { resolved?: boolean; uncontested?: boolean; resolutionData?: BattleResolutionData }) => !b.resolved && !b.uncontested && b.resolutionData);
            if (unresolvedWithResData?.resolutionData && !prevUnresolvedWithResData?.resolutionData) {
              // New resolutionData appeared - enter interactive step
              const rd = unresolvedWithResData.resolutionData as BattleResolutionData;
              uiResets.battleResolutionData = rd;
              uiResets.selectedHostageTarget = null;
              if (rd.seppukuWinnerId) {
                uiResets.battleStepPhase = 'seppuku-decision';
              } else if (rd.hostageWinnerId && !rd.capturedHostage) {
                uiResets.battleStepPhase = 'hostage-selection';
              } else {
                uiResets.battleStepPhase = 'ronin-result';
              }
            } else if (unresolvedWithResData?.resolutionData && prevUnresolvedWithResData?.resolutionData) {
              // ResolutionData was updated (e.g., seppuku accepted/declined) - check if we should transition
              const rd = unresolvedWithResData.resolutionData as BattleResolutionData;
              const prevRd = prevUnresolvedWithResData.resolutionData as BattleResolutionData;
              if (rd.seppukuAccepted && !prevRd.seppukuAccepted) {
                // Seppuku was accepted - show result
                uiResets.battleResolutionData = rd;
                uiResets.battleStepPhase = 'seppuku-result';
              } else if (rd.seppukuPhaseComplete && !prevRd.seppukuPhaseComplete) {
                // Seppuku result was accepted by winner - transition to next phase
                uiResets.battleResolutionData = rd;
                if (rd.hostageWinnerId && !rd.capturedHostage) {
                  uiResets.battleStepPhase = 'hostage-selection';
                  uiResets.selectedHostageTarget = null;
                } else if (rd.roninWinnerId) {
                  uiResets.battleStepPhase = 'ronin-result';
                }
              } else if (prevRd.seppukuWinnerId && !rd.seppukuWinnerId) {
                // Seppuku was declined (seppukuWinnerId cleared)
                uiResets.battleResolutionData = rd;
                if (rd.hostageWinnerId && !rd.capturedHostage) {
                  uiResets.battleStepPhase = 'hostage-selection';
                  uiResets.selectedHostageTarget = null;
                } else if (rd.roninWinnerId) {
                  uiResets.battleStepPhase = 'ronin-result';
                }
              }
            }
          }

          // Fix war summary loop: clear warSummaryVisible when phase is no longer 'war'
          if (state.mode === 'online' && state.currentPhase !== 'war' && get().warSummaryVisible) {
            uiResets.warSummaryVisible = false;
            uiResets.battleStepPhase = null;
          }

          // If monster placement is in progress, suppress turn popup to avoid interference
          const { monsterPlacementCard: currentMonsterCard, monsterPlacementMode: currentMonsterMode, komainuPrayMode: currentKomainuPray, monsterPlacementPopupVisible: currentMonsterPopup, komainuChoiceVisible: currentKomainuChoice, monsterNoPlacementPopupVisible: currentNoPlacementPopup } = get();
          const monsterPlacementInProgress = !!(currentMonsterCard || currentMonsterMode || currentKomainuPray || currentMonsterPopup || currentKomainuChoice || currentNoPlacementPopup);
          const finalTurnPopup = monsterPlacementInProgress ? null : newTurnPopup;

          // During online marshal, if local player has pending moves/fortresses, don't overwrite local state with server state
          const suppressGameStateUpdate = state.mode === 'online' && state.marshalMandateActive && lpId &&
            state.marshalResolutionOrder?.[state.marshalResolutionIndex] === lpId &&
            get().undoMandateState !== null && (get().marshalPendingMoves.length > 0 || get().marshalPendingFortresses.length > 0);

          if (suppressGameStateUpdate) {
            // Keep local gameState (with pending moves applied), only update non-gameState fields
            set({ turnPopupPlayer: finalTurnPopup, turnPopupDismissedForIndex: dismissedIdx, ...uiResets });
          } else {
            // Preserve client-local jinmenjuUsedThisMandate flag during recruit (jinmenju is client-only)
            const localJinmenjuUsed = get().gameState?.jinmenjuUsedThisMandate;
            const mergedState = (state.recruitMandateActive && localJinmenjuUsed && !state.jinmenjuUsedThisMandate)
              ? { ...state, jinmenjuUsedThisMandate: true }
              : state;
            set({ gameState: mergedState, turnPopupPlayer: finalTurnPopup, turnPopupDismissedForIndex: dismissedIdx, ...uiResets });
          }
          break;
        }
        case 'PLAYER_ID':
          localStorage.setItem('shoguns-ascent-playerId', d.playerId);
          set({ localPlayerId: d.playerId });
          break;
        case 'LOBBY_JOINED':
          set({ lobbyId: d.lobbyId, screen: get().rejoinWaitingVisible ? get().screen : 'lobby' });
          break;
        case 'LOBBY_CREATED':
          set({ lobbyId: d.lobbyId, screen: 'lobby' });
          break;
        case 'LOBBY_STATE':
          set({ lobbyState: d.lobby });
          break;
        case 'GAME_START':
          set({ gameState: d.state, screen: 'game', turnPopupPlayer: null, turnPopupDismissedForIndex: null, persistentGameId: d.state?.id || null });
          break;
        case 'LOBBY_CLOSED':
          set({ lobbyState: null, lobbyId: null, screen: 'menu' });
          break;
        case 'REJOIN_STATUS':
          set({ rejoinPlayerStatuses: d.players, rejoinWaitingVisible: true });
          break;
        case 'REJOIN_COMPLETE':
          set({ rejoinWaitingVisible: false, rejoinPlayerStatuses: [] });
          break;
        case 'ERROR':
          console.error('[WS] Server error:', d.message);
          break;
      }
    };
    ws.onclose = () => {
      const currentScreen = get().screen;
      if (get().rejoinWaitingVisible) {
        // WS closed while waiting for players to rejoin - reset popup and return to menu
        set({ ws: null, rejoinWaitingVisible: false, rejoinPlayerStatuses: [], lobbyState: null, lobbyId: null, screen: 'menu' });
      } else if (currentScreen === 'lobby') {
        set({ ws: null, lobbyState: null, lobbyId: null, screen: 'menu' });
      } else {
        set({ ws: null });
      }
    };
    set({ ws });
  },
  sendAction: (action) => {
    const { ws, lobbyId } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...(action as object), lobbyId }));
    }
  },
  setLobbyId: (id) => set({ lobbyId: id }),
  lobbyState: null,
  rejoinWaitingVisible: false,
  rejoinPlayerStatuses: [],
  sendCreateLobby: (params) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CREATE_LOBBY', ...params }));
    }
  },
  sendSelectClan: (lobbyId, clanId) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SELECT_CLAN', lobbyId, clanId }));
    }
  },
}));
