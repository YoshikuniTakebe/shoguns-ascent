import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS, SEASON_CARDS_DATA } from '../types/game';
import type { Battle, GameState, BattleResolutionData } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon, BushiIcon, ShintoIcon, DaimyoIcon, MonsterIcon, VPIcon, HonorIcon, RoninIcon, FistIcon } from './Icons';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { calculateForce } from '../utils/gameLogic';
import { BattleBiddingOverlay } from './BattleBiddingOverlay';
import type { BattleCombatant } from './BattleBiddingOverlay';

// Kept only so older snapshots containing coinDistributionPending can continue directly to results.
const SHOW_COIN_DISTRIBUTION_POPUP = false;

/**
 * Extract log entries for a resolved battle using its logStartIndex
 * to avoid pulling entries from other battles.
 */
function extractBattleLogs(log: string[], battle: Battle): string[] {
  const startIdx = battle.logStartIndex ?? 0;
  const battleLogs: string[] = [];
  for (let i = startIdx; i < log.length; i++) {
    const entry = log[i];
    if (
      entry.includes('commits Seppuku') ||
      entry.includes('takes a hostage') ||
      entry.includes('hires ronin') ||
      (entry.includes('gains') && entry.includes('VP from Imperial Poets')) ||
      entry.includes('wins the battle in')
    ) {
      battleLogs.push(entry);
    }
  }
  return battleLogs;
}

/**
 * Render a battle log entry with colored player names and clan seals.
 */
function renderBattleLogEntry(entry: string, players: { id: string; name: string; clanId: string }[]): ReactNode {
  type Segment = { type: 'text'; value: string } | { type: 'node'; value: ReactNode };
  let segments: Segment[] = [{ type: 'text', value: entry }];

  const sortedPlayers = [...players].sort((a, b) => b.name.length - a.name.length);
  let nodeCounter = 0;

  for (const player of sortedPlayers) {
    if (!player.name) continue;
    const clan = CLANS.find(c => c.id === player.clanId);
    const escapedName = player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(`(?<![\\w])${escapedName}(?![\\w])`, 'g');

    const newSegments: Segment[] = [];
    for (const seg of segments) {
      if (seg.type !== 'text') {
        newSegments.push(seg);
        continue;
      }
      const text = seg.value;
      let lastIndex = 0;
      const regex = new RegExp(namePattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          newSegments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        nodeCounter++;
        const key = `bl-${nodeCounter}`;
        newSegments.push({
          type: 'node',
          value: (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <ClanShield clanId={player.clanId} size={14} />
              <span style={{ color: clan?.color || '#fff', fontWeight: 'bold' }}>{match[0]}</span>
            </span>
          )
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        newSegments.push({ type: 'text', value: text.slice(lastIndex) });
      }
    }
    segments = newSegments;
  }

  // Replace VP/PV patterns with VPIcon
  {
    const vpPattern = /(\d+)\s*(?:VP|PV)/g;
    const newSegs: Segment[] = [];
    for (const seg of segments) {
      if (seg.type !== 'text') {
        newSegs.push(seg);
        continue;
      }
      const text = seg.value;
      let lastIndex = 0;
      const regex = new RegExp(vpPattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          newSegs.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        nodeCounter++;
        newSegs.push({
          type: 'node',
          value: (
            <span key={`vp-${nodeCounter}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>{match[1]}</span>
              <VPIcon size={14} color="#f5c842" />
            </span>
          )
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        newSegs.push({ type: 'text', value: text.slice(lastIndex) });
      }
    }
    segments = newSegs;
  }

  // Replace "at Honor" at end with "at [HonorIcon] Track"
  {
    const atHonorPattern = /at Honor\s*$/;
    const newSegs: Segment[] = [];
    for (const seg of segments) {
      if (seg.type !== 'text') {
        newSegs.push(seg);
        continue;
      }
      const text = seg.value;
      const match = atHonorPattern.exec(text);
      if (match) {
        if (match.index > 0) {
          newSegs.push({ type: 'text', value: text.slice(0, match.index) });
        }
        nodeCounter++;
        newSegs.push({
          type: 'node',
          value: (
            <span key={`ah-${nodeCounter}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>at</span>
              <HonorIcon size={14} color="#e57373" />
              <span>Track</span>
            </span>
          )
        });
      } else {
        newSegs.push(seg);
      }
    }
    segments = newSegs;
  }

  // Replace remaining "Honor" (standalone, not already handled) with HonorIcon
  {
    const honorPattern = /(\d+)\s*Honor/g;
    const newSegs: Segment[] = [];
    for (const seg of segments) {
      if (seg.type !== 'text') {
        newSegs.push(seg);
        continue;
      }
      const text = seg.value;
      let lastIndex = 0;
      const regex = new RegExp(honorPattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          newSegs.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        nodeCounter++;
        newSegs.push({
          type: 'node',
          value: (
            <span key={`hon-${nodeCounter}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>{match[1]}</span>
              <HonorIcon size={14} color="#e57373" />
            </span>
          )
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        newSegs.push({ type: 'text', value: text.slice(lastIndex) });
      }
    }
    segments = newSegs;
  }

  return segments.map((seg, i) =>
    seg.type === 'text' ? <span key={`t${i}`}>{seg.value}</span> : <span key={`n${i}`}>{seg.value}</span>
  );
}

/**
 * Render icon for a figure type in the battle result display.
 */
function FigureTypeIcon({ figureType, color = '#fff', size = 16 }: { figureType: string; color?: string; size?: number }) {
  switch (figureType) {
    case 'bushi':
      return <BushiIcon size={size} color={color} />;
    case 'shinto':
      return <ShintoIcon size={size} color={color} />;
    case 'daimyo':
      return <DaimyoIcon size={size} color={color} />;
    case 'monster':
    default:
      return <MonsterIcon size={size} color={color} />;
  }
}

/**
 * Shared battle result popup content used by both hotseat and online modes.
 */
function BattleResultPopup({
  battle,
  gameState,
  onAccept,
  t,
  resolutionData,
  localPlayerId,
  battleResultReadyPlayers,
  mode,
}: {
  battle: Battle;
  gameState: GameState;
  onAccept: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  resolutionData?: BattleResolutionData | null;
  localPlayerId?: string | null;
  battleResultReadyPlayers?: string[];
  mode?: string;
}) {
  const resProvince = gameState.provinces[battle.provinceId];
  const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
  const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
  const battleLogs = extractBattleLogs(gameState.log, battle);
  const provinceName = resProvince?.name || battle.provinceId;
  const provinceColor = PROVINCE_COLORS[battle.provinceId] || '#fff';
  const warTokenMarker = '__PROVINCE__';
  const [warTokenPrefix, warTokenSuffix = ''] = t('battle.resultWarToken', { province: warTokenMarker }).split(warTokenMarker);

  // Use resolution data from battle or prop
  const resData = battle.resolutionData || resolutionData;

  // Build bets data from battle.warTacticBids
  const tacticIds = ['seppuku', 'take-hostage', 'hire-ronin', 'imperial-poets'] as const;
  const tacticLabels: Record<string, string> = {
    'seppuku': 'Seppuku',
    'take-hostage': 'Take Hostage',
    'hire-ronin': 'Hire Ronin',
    'imperial-poets': 'Imperial Poets',
  };

  return (
    <div className="battle-popup-overlay">
      <div className="battle-popup-card" style={{ maxWidth: '700px', width: '95%', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', paddingTop: '15px' }}>
        <h3 className="battle-popup-title">{t('battle.resultTitle')}</h3>
        <p className="battle-popup-message" style={{ fontSize: '1.1em', marginBottom: '0.5rem', color: PROVINCE_COLORS[battle.provinceId] || '#fff' }}>
          {resProvince?.name || battle.provinceId}
        </p>
        {/* Bets (Apuestas) container */}
        {battle.warTacticBids && Object.keys(battle.warTacticBids).length > 0 && (
          <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>Apuestas</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {tacticIds.map(tacticId => {
                const bidsForTactic = battle.participants
                  .map(pid => {
                    const playerBids = battle.warTacticBids[pid];
                    const amount = playerBids?.[tacticId] || 0;
                    if (amount <= 0) return null;
                    const player = gameState.players.find(p => p.id === pid);
                    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                    return { pid, player, clan, amount };
                  })
                  .filter(Boolean) as { pid: string; player: any; clan: any; amount: number }[];
                const tacticWinner = bidsForTactic.length > 0
                  ? bidsForTactic.reduce((best, curr) => curr.amount > best.amount ? curr : best)
                  : null;
                const tacticWinnerColor = tacticWinner?.clan?.color || undefined;
                return (
                  <div key={tacticId} style={{ background: 'rgba(0,0,0,0.15)', padding: '0.4rem', borderRadius: '4px', minWidth: '120px', flex: 1 }}>
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.8em', fontWeight: 'bold', opacity: tacticWinnerColor ? 1 : 0.8, color: tacticWinnerColor || 'inherit' }}>{tacticLabels[tacticId]}</p>
                    {bidsForTactic.length === 0 && (
                      <span style={{ fontSize: '0.75em', opacity: 0.5 }}>-</span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {bidsForTactic.map(({ pid, clan, amount }) => (
                        <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <CoinIcon size={14} color={clan?.color || '#FFD700'} />
                          <span style={{ fontWeight: 'bold', color: clan?.color || '#fff', fontSize: '0.85em' }}>{amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Participant force badges */}
        {resData?.participantForces && resData.participantForces.length > 0 && (
          <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>Fuerza Total</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxWidth: '100%' }}>
              {resData.participantForces.map((pf, i) => {
                const pfPlayer = gameState.players.find(p => p.id === pf.playerId);
                const pfClan = pfPlayer ? CLANS.find(c => c.id === pfPlayer.clanId) : null;
                return (
                  <div key={i} style={{ background: 'rgba(15,52,96,0.5)', border: `1px solid ${pfClan?.color || '#fff'}`, borderRadius: '6px', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ClanShield clanId={pfPlayer?.clanId || ''} size={18} />
                    <FistIcon size={16} color={pfClan?.color || '#fff'} />
                    <span style={{ fontWeight: 'bold', color: pfClan?.color || '#fff' }}>{pf.force}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {winner && winnerClan && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={winner.clanId} size={28} />
            <span style={{ color: winnerClan.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {t('battle.resultWinner', { name: winner.name })}
            </span>
          </div>
        )}
        {winner && (
          <p style={{ margin: '0.25rem 0' }}>
            {warTokenPrefix}
            <span style={{ color: provinceColor, fontWeight: 'bold' }}>{provinceName}</span>
            {warTokenSuffix}
          </p>
        )}
        {/* Seppuku section */}
        {resData?.seppukuAccepted && resData.seppukuWinnerId && (
          <div style={{ margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>Seppuku</p>
            {(() => {
              const seppPlayer = gameState.players.find(p => p.id === resData.seppukuWinnerId);
              const seppClan = seppPlayer ? CLANS.find(c => c.id === seppPlayer.clanId) : null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9em', flexWrap: 'wrap' }}>
                  <ClanShield clanId={seppPlayer?.clanId || ''} size={16} />
                  <span style={{ color: seppClan?.color, fontWeight: 'bold' }}>{seppPlayer?.name}</span>
                  <span style={{ opacity: 0.7 }}>sacrifico</span>
                  <span style={{ fontWeight: 'bold' }}>{resData.seppukuKillCount}</span>
                  <span style={{ opacity: 0.7 }}>unidades</span>
                  {resData.seppukuFigures && resData.seppukuFigures.length > 0 && (
                    <span style={{ opacity: 0.8 }}>
                      ({resData.seppukuFigures.map((entry: any, i: number) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          {i > 0 && ' | '}
                          <span>{entry.count}</span>
                          {entry.type === 'bushi' && <BushiIcon size={14} color={seppClan?.color || '#fff'} />}
                          {entry.type === 'shinto' && <ShintoIcon size={14} color={seppClan?.color || '#fff'} />}
                          {entry.type === 'monster' && <MonsterIcon size={14} color={seppClan?.color || '#fff'} />}
                          {entry.type === 'monster' && entry.names && entry.names.length > 0 && (
                            <span style={{ fontSize: '0.85em' }}>[{entry.names.join(', ')}]</span>
                          )}
                        </span>
                      ))})
                    </span>
                  )}
                  <span style={{ opacity: 0.7 }}>y gano</span>
                  <VPIcon size={14} color="#f5c842" />
                  <span style={{ color: '#f5c842', fontWeight: 'bold' }}>{resData.seppukuKillCount}</span>
                  <span style={{ opacity: 0.7 }}>y subio</span>
                  <span style={{ fontWeight: 'bold' }}>{resData.seppukuKillCount}</span>
                  <span style={{ opacity: 0.7 }}>posiciones de</span>
                  <HonorIcon size={14} color="#e57373" />
                </div>
              );
            })()}
          </div>
        )}
        {/* Killed figures display */}
        {battle.killedFigures && battle.killedFigures.length > 0 && (
          <div style={{ margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>
              {t('battle.killedFigures')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem' }}>
              {battle.killedFigures.map((kf, i) => {
                const owner = gameState.players.find(p => p.id === kf.owner);
                const ownerClan = owner ? CLANS.find(c => c.id === owner.clanId) : null;
                const casualtyColor = ownerClan?.color || '#fff';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85em' }}>
                    <ClanShield clanId={owner?.clanId || ''} size={16} />
                    <span style={{ color: casualtyColor, fontWeight: 'bold' }}>{owner?.name}</span>
                    <FigureTypeIcon figureType={kf.figureType} color={casualtyColor} size={16} />
                    <span style={{ color: casualtyColor, fontWeight: 'bold' }}>{kf.count}</span>
                    {kf.figureType === 'monster' && kf.monsterNames && kf.monsterNames.length > 0 && (
                      <span style={{ color: casualtyColor, fontWeight: 600 }}>({kf.monsterNames.join(', ')})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Prisoners section */}
        {resData?.capturedHostage && (
          <div style={{ margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>
              Prisioneros
            </p>
            {(() => {
              const captor = gameState.players.find(p => p.id === resData.capturedHostage!.captorId);
              const captorClan = captor ? CLANS.find(c => c.id === captor.clanId) : null;
              const victim = gameState.players.find(p => p.id === resData.capturedHostage!.fromClanId);
              const victimClan = victim ? CLANS.find(c => c.id === victim.clanId) : null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9em', flexWrap: 'wrap' }}>
                  <ClanShield clanId={captor?.clanId || ''} size={16} />
                  <span style={{ color: captorClan?.color, fontWeight: 'bold' }}>{captor?.name}</span>
                  <span style={{ opacity: 0.7 }}>captura</span>
                  <span style={{ fontWeight: 'bold', color: victimClan?.color || '#fff' }}>{resData.capturedHostage!.figureName}</span>
                  <span style={{ opacity: 0.7 }}>de</span>
                  <ClanShield clanId={victim?.clanId || ''} size={16} />
                  <span style={{ color: victimClan?.color, fontWeight: 'bold' }}>{victim?.name}</span>
                </div>
              );
            })()}
          </div>
        )}
        {/* Imperial Poets section */}
        {resData?.imperialPoetsWinnerId && resData.imperialPoetsVP > 0 && (
          <div style={{ margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>
              Poetas Imperiales
            </p>
            {(() => {
              const poetsPlayer = gameState.players.find(p => p.id === resData.imperialPoetsWinnerId);
              const poetsClan = poetsPlayer ? CLANS.find(c => c.id === poetsPlayer.clanId) : null;
              const seppukuDeaths = resData.seppukuAccepted ? resData.seppukuKillCount : 0;
              const battleDeaths = resData.battleDeathCount;
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                    <ClanShield clanId={poetsPlayer?.clanId || ''} size={18} />
                    <span style={{ color: poetsClan?.color, fontWeight: 'bold' }}>{poetsPlayer?.name}</span>
                    <span style={{ opacity: 0.8 }}>ha ganado</span>
                    <VPIcon size={16} color="#f5c842" />
                    <span style={{ color: '#f5c842', fontWeight: 'bold' }}>{resData.imperialPoetsVP}</span>
                  </div>
                  <div style={{ fontSize: '0.85em', opacity: 0.8, paddingLeft: '0.5rem' }}>
                    {(seppukuDeaths > 0 || battleDeaths > 0) && (
                      <p style={{ margin: '0.1rem 0' }}>{seppukuDeaths} muertos por Seppuku y {battleDeaths} muertos en Batalla</p>
                    )}
                    {resData.phoenixDiedInSeppuku && resData.phoenixDiedInBattle && (
                      <p style={{ margin: '0.1rem 0', color: '#f5c842' }}>Phoenix murio en seppuku y en batalla (2 muertes)</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {battleLogs.length > 0 && !resData && (
          <div style={{ textAlign: 'left', margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.9em' }}>
            {battleLogs.map((entry, i) => (
              <p key={i} style={{ margin: '0.2rem 0' }}>{renderBattleLogEntry(entry, gameState.players)}</p>
            ))}
          </div>
        )}
        {mode === 'online' && localPlayerId && (battleResultReadyPlayers || []).includes(localPlayerId) ? (
          <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
            {(battleResultReadyPlayers || []).length}/{gameState.players.length} listos
          </p>
        ) : (
          <button className="btn-primary battle-popup-accept" onClick={onAccept}>
            {t('battle.continue')}
          </button>
        )}
      </div>
    </div>
  );
}

export const BattlePanel = () => {
  const {
    gameState,
    localPlayerId,
    doSubmitWarTacticBids,
    doAdvancePhase,
    battleStepPhase,
    battleCurrentBiddingIndex,
    battleResolutionData,
    selectedHostageTarget,
    doAcceptBattlePopup,
    doSeppukuDecision,
    doSeppukuResultAccept,
    doHostageSelect,
    doHostageConfirm,
    doHostageSkip,
    doRoninResultAccept,
    doCoinDistributionChoice,
    doCoinDistributionDismiss,
    biddingMapPeek,
    setBiddingMapPeek,
    warPhasePopupVisible,
    warSummaryVisible,
  } = useGameStore();
  const t = useT();

  if (!gameState) return null;

  // --- ZORRO PLACEMENT: suppress battle popups while Zorro is placing bushi ---
  if (gameState.zorroPlacementActive) {
    return (
      <div className="betray-active" style={{ padding: '1rem' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--accent-gold)' }}>GUERRA</p>
        <p style={{ margin: '8px 0', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          El clan Zorro esta colocando Bushi en provincias de batalla...
        </p>
      </div>
    );
  }

  // --- WAR PHASE POPUP: suppress battle popups while war summary is visible ---
  if (warPhasePopupVisible) return null;

  // --- DAIKAIJU: suppress battle popups while Daikaiju placement/summary is active ---
  if (gameState.daikaijuPlacementActive || gameState.daikaijuSummaryVisible) return null;
  if (gameState.pendingNureOnnaDecision || gameState.pendingBattleCardDecision || gameState.pendingMonsterEnterDecision || gameState.pendingBattleMercyDecision || gameState.pendingNinjaDecision || (gameState.pendingRuleNotices?.length || 0) > 0) return null;

  // --- WAR SUMMARY POPUP: suppress battle popups while war summary is visible ---
  if (warSummaryVisible) return null;

  // --- COIN DISTRIBUTION POPUP: show when winner must allocate remainder coins ---
  if (SHOW_COIN_DISTRIBUTION_POPUP && gameState.coinDistributionPending) {
    // If map peek is active, hide the popup so the map is visible
    if (biddingMapPeek) return null;

    const pending = gameState.coinDistributionPending;
    const winner = gameState.players.find(p => p.id === pending.winnerId);
    const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
    const province = gameState.provinces[pending.battleProvinceId];

    // Online mode: only show interactive distribution to the winner; others see waiting message
    if (gameState.mode === 'online' && pending.remainder > 0 && localPlayerId !== pending.winnerId) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card">
            <h3 className="battle-popup-title">{t('battle.coinDistributionTitle')}</h3>
            <p style={{ fontSize: '0.95em', marginBottom: '0.5rem', color: PROVINCE_COLORS[pending.battleProvinceId] || '#fff', fontWeight: 'bold' }}>
              {province?.name || pending.battleProvinceId}
            </p>
            {winner && winnerClan && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ClanShield clanId={winner.clanId} size={28} />
                <span style={{ color: winnerClan.color, fontWeight: 'bold' }}>
                  {winner.name}
                </span>
              </div>
            )}
            <p style={{ margin: '0.5rem 0', fontSize: '0.95em', opacity: 0.8 }}>
              Esperando reparto de monedas...
            </p>
          </div>
        </div>,
        document.body
      );
    }

    // If no remainder, show informational popup only
    if (pending.remainder === 0) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card">
            <h3 className="battle-popup-title">{t('battle.coinDistributionTitle')}</h3>
            <p style={{ fontSize: '0.95em', marginBottom: '0.5rem', color: PROVINCE_COLORS[pending.battleProvinceId] || '#fff', fontWeight: 'bold' }}>
              {province?.name || pending.battleProvinceId}
            </p>
            {winner && winnerClan && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ClanShield clanId={winner.clanId} size={28} />
                <span style={{ color: winnerClan.color, fontWeight: 'bold' }}>
                  {winner.name}
                </span>
              </div>
            )}
            <p style={{ margin: '0.5rem 0', fontSize: '0.95em' }}>
              {t('battle.coinDistributionInfo', { amount: pending.sharePerLoser })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
              {pending.losers.map(loserId => {
                const loser = gameState.players.find(p => p.id === loserId);
                const loserClan = loser ? CLANS.find(c => c.id === loser.clanId) : null;
                return (
                  <div key={loserId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <ClanShield clanId={loser?.clanId || ''} size={20} />
                    <span style={{ color: loserClan?.color, fontWeight: 'bold' }}>{loser?.name}</span>
                    <CoinIcon size={14} color="#FFD700" />
                    <span style={{ color: '#FFD700', fontWeight: 'bold' }}>+{pending.sharePerLoser}</span>
                  </div>
                );
              })}
            </div>
            {gameState.mode === 'online' && localPlayerId && (gameState.coinDistributionReadyPlayers || []).includes(localPlayerId) ? (
              <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                {(gameState.coinDistributionReadyPlayers || []).length}/{gameState.players.length} listos
              </p>
            ) : (
              <button className="btn-primary battle-popup-accept" onClick={doCoinDistributionDismiss}>
                {t('battle.continue')}
              </button>
            )}
          </div>
        </div>,
        document.body
      );
    }

    // Remainder > 0: show choice selector
    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <h3 className="battle-popup-title" style={{ margin: 0 }}>{t('battle.coinDistributionTitle')}</h3>
            <button
              className="bidding-peek-map-btn"
              onClick={() => setBiddingMapPeek(true)}
              title="Ver Mapa"
              style={{ background: 'rgba(30,50,80,0.8)', border: '1px solid var(--border-gold)', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)', fontSize: '0.8em' }}
            >
              <span style={{ fontSize: '1.1em' }}>&#128065;</span>
              <span>Ver Mapa</span>
            </button>
          </div>
          <p style={{ fontSize: '0.95em', marginBottom: '0.5rem', color: PROVINCE_COLORS[pending.battleProvinceId] || '#fff', fontWeight: 'bold' }}>
            {province?.name || pending.battleProvinceId}
          </p>
          {winner && winnerClan && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ClanShield clanId={winner.clanId} size={28} />
              <span style={{ color: winnerClan.color, fontWeight: 'bold' }}>
                {winner.name}
              </span>
            </div>
          )}
          {pending.sharePerLoser > 0 && (
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.9em', opacity: 0.8 }}>
              {t('battle.coinDistributionInfo', { amount: pending.sharePerLoser })}
            </p>
          )}
          <p style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
            <CoinIcon size={16} color="#FFD700" />
            <span style={{ fontWeight: 'bold', color: '#FFD700' }}>{pending.remainder}</span>
            {' '}{t('battle.coinDistributionRemaining')}
          </p>
          <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.9em', opacity: 0.8 }}>
            {t('battle.coinDistributionInstruction')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pending.losers.map(loserId => {
              const loser = gameState.players.find(p => p.id === loserId);
              const loserClan = loser ? CLANS.find(c => c.id === loser.clanId) : null;
              return (
                <button
                  key={loserId}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(30,50,80,0.9)', border: '1px solid var(--border-gold)', color: 'var(--text-primary)' }}
                  onClick={() => doCoinDistributionChoice(loserId)}
                >
                  <ClanShield clanId={loser?.clanId || ''} size={20} />
                  <span style={{ color: loserClan?.color, fontWeight: 'bold' }}>{loser?.name}</span>
                  <CoinIcon size={14} color="#FFD700" />
                  <span>+1</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const allBattles = gameState.activeBattles;

  // --- SEPPUKU DECISION POPUP ---
  if (battleStepPhase === 'seppuku-decision' && battleResolutionData?.seppukuWinnerId) {
    const seppukuPlayer = gameState.players.find(p => p.id === battleResolutionData.seppukuWinnerId);
    const seppukuClan = seppukuPlayer ? CLANS.find(c => c.id === seppukuPlayer.clanId) : null;

    // In online mode, only show interactive popup to the seppuku winner
    if (gameState.mode === 'online' && localPlayerId !== battleResolutionData.seppukuWinnerId) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ borderColor: seppukuClan?.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ClanShield clanId={seppukuPlayer?.clanId || ''} size={36} />
              <span style={{ color: seppukuClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
                {seppukuPlayer?.name}
              </span>
            </div>
            <p style={{ fontSize: '1em', margin: '0.5rem 0', textAlign: 'center', opacity: 0.8 }}>
              Decidiendo Seppuku... [ESPERANDO]
            </p>
          </div>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card" style={{ borderColor: seppukuClan?.color }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ClanShield clanId={seppukuPlayer?.clanId || ''} size={36} />
            <span style={{ color: seppukuClan?.color, fontWeight: 'bold', fontSize: '1.2em' }}>
              {seppukuPlayer?.name}
            </span>
          </div>
          <p style={{ fontSize: '1.1em', margin: '0.5rem 0 1rem', textAlign: 'center' }}>
            Quieres sacrificar TODAS tus tropas?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{ background: 'rgba(200, 50, 50, 0.8)', border: '1px solid #e74c3c' }}
              onClick={() => doSeppukuDecision(true)}
            >
              Si, sacrifico TODAS
            </button>
            <button
              className="btn-primary"
              style={{ background: 'rgba(60, 60, 80, 0.8)', border: '1px solid rgba(255,255,255,0.3)' }}
              onClick={() => doSeppukuDecision(false)}
            >
              No las sacrifico
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // --- SEPPUKU RESULT POPUP ---
  if (battleStepPhase === 'seppuku-result' && battleResolutionData?.seppukuWinnerId) {
    const seppukuPlayer = gameState.players.find(p => p.id === battleResolutionData.seppukuWinnerId);
    const seppukuClan = seppukuPlayer ? CLANS.find(c => c.id === seppukuPlayer.clanId) : null;
    const killCount = battleResolutionData.seppukuKillCount;

    // In online mode, only show to the seppuku winner
    if (gameState.mode === 'online' && localPlayerId !== battleResolutionData.seppukuWinnerId) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ borderColor: seppukuClan?.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ClanShield clanId={seppukuPlayer?.clanId || ''} size={36} />
              <span style={{ color: seppukuClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
                {seppukuPlayer?.name}
              </span>
            </div>
            <p style={{ fontSize: '1em', margin: '0.5rem 0', textAlign: 'center', opacity: 0.8 }}>
              Turno de {seppukuPlayer?.name} [ESPERANDO]
            </p>
          </div>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card" style={{ borderColor: seppukuClan?.color }}>
          <h3 style={{ color: '#f5c842', textAlign: 'center', marginBottom: '0.5rem', marginTop: 0 }}>Has ganado Seppuku!</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={seppukuPlayer?.clanId || ''} size={36} />
            <span style={{ color: seppukuClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {seppukuPlayer?.name}
            </span>
          </div>
          <p style={{ fontSize: '1em', margin: '0.5rem 0', textAlign: 'center', color: seppukuClan?.color }}>
            has sacrificado tus tropas
          </p>
          <div style={{ margin: '0.75rem 0', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold', fontSize: '0.95em' }}>Has obtenido:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.3rem 0', flexWrap: 'wrap', justifyContent: 'center' }}>
              <VPIcon size={28} color="#f5c842" />
              <span style={{ color: '#f5c842', fontWeight: 'bold' }}>{killCount}</span>
              <span>y has subido</span>
              <HonorIcon size={28} color="#9b59b6" />
              <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>{killCount}</span>
              <span>posiciones</span>
            </div>
          </div>
          {battleResolutionData.seppukuFigures && battleResolutionData.seppukuFigures.length > 0 && (
            <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold', fontSize: '0.9em', opacity: 0.9 }}>Tropas sacrificadas:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {battleResolutionData.seppukuFigures.map((entry, i) => {
                  const clanColor = seppukuClan?.color || '#fff';
                  let icon: ReactNode;
                  switch (entry.type) {
                    case 'bushi':
                      icon = <BushiIcon size={28} color={clanColor} />;
                      break;
                    case 'shinto':
                      icon = <ShintoIcon size={28} color={clanColor} />;
                      break;
                    case 'daimyo':
                      icon = <DaimyoIcon size={28} color={clanColor} />;
                      break;
                    case 'monster':
                      icon = <MonsterIcon size={28} color={clanColor} />;
                      break;
                    default:
                      icon = <FigureTypeIcon figureType={entry.type} size={28} />;
                  }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {icon}
                      <span style={{ fontWeight: 'bold' }}>{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button className="btn-primary battle-popup-accept" onClick={doSeppukuResultAccept}>
            {t('battle.continue')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // --- HOSTAGE SELECTION POPUP ---
  if (battleStepPhase === 'hostage-selection' && battleResolutionData?.hostageWinnerId) {
    const hostagePlayer = gameState.players.find(p => p.id === battleResolutionData.hostageWinnerId);
    const hostageClan = hostagePlayer ? CLANS.find(c => c.id === hostagePlayer.clanId) : null;

    // In online mode, only show to the hostage winner
    if (gameState.mode === 'online' && localPlayerId !== battleResolutionData.hostageWinnerId) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ borderColor: hostageClan?.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ClanShield clanId={hostagePlayer?.clanId || ''} size={36} />
              <span style={{ color: hostageClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
                {hostagePlayer?.name}
              </span>
            </div>
            <p style={{ fontSize: '1em', margin: '0.5rem 0', textAlign: 'center', opacity: 0.8 }}>
              Eligiendo rehen... [ESPERANDO]
            </p>
          </div>
        </div>,
        document.body
      );
    }

    const unresolvedBattle = allBattles.find(b => !b.resolved && !b.uncontested);
    const province = unresolvedBattle ? gameState.provinces[unresolvedBattle.provinceId] : null;

    // Get capturable enemy figures: bushi, shinto, named monsters (NOT daimyo, NOT daimyo-type monsters)
    const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
    const capturableFigures = province ? province.figures.filter(f => {
      if (f.owner === battleResolutionData.hostageWinnerId) return false;
      if (hostagePlayer?.allies.includes(f.owner)) return false;
      // Only allow capturing figures from battle participants
      if (unresolvedBattle && !unresolvedBattle.participants.includes(f.owner)) return false;
      if (f.type === 'daimyo') return false;
      if (f.type === 'fortress') return false;
      if (f.type === 'monster' && f.monsterCardId && DAIMYO_MONSTER_IDS.includes(f.monsterCardId)) return false;
      if (f.type === 'bushi' || f.type === 'shinto' || f.type === 'monster') return true;
      return false;
    }) : [];

    // If no capturable figures, show info popup and skip
    if (capturableFigures.length === 0) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ borderColor: hostageClan?.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ClanShield clanId={hostagePlayer?.clanId || ''} size={36} />
              <span style={{ color: hostageClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
                {hostagePlayer?.name}
              </span>
            </div>
            <p style={{ fontSize: '1em', margin: '0.5rem 0 0.75rem', textAlign: 'center', opacity: 0.8 }}>
              No hay tropas capturables
            </p>
            <button className="btn-primary battle-popup-accept" onClick={doHostageSkip}>
              {t('battle.continue')}
            </button>
          </div>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card" style={{ borderColor: hostageClan?.color, maxHeight: '80vh', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={hostagePlayer?.clanId || ''} size={36} />
            <span style={{ color: hostageClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {hostagePlayer?.name}
            </span>
          </div>
          <p style={{ fontSize: '1em', margin: '0.5rem 0 0.75rem', textAlign: 'center' }}>
            Elige a quien capturar ({(battleResolutionData.hostagesTaken || 0) + 1}/{battleResolutionData.hostageLimit || 1})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {capturableFigures.map(fig => {
              const figOwner = gameState.players.find(p => p.id === fig.owner);
              const figClan = figOwner ? CLANS.find(c => c.id === figOwner.clanId) : null;
              let figName = fig.type === 'bushi' ? 'Bushi' : fig.type === 'shinto' ? 'Shinto' : '';
              if (fig.type === 'monster' && fig.monsterCardId) {
                const card = SEASON_CARDS_DATA.find(c => c.id === fig.monsterCardId);
                figName = card?.name || fig.monsterCardId;
              }
              const isSelected = selectedHostageTarget?.figureId === fig.id;
              return (
                <div
                  key={fig.id}
                  onClick={() => doHostageSelect(fig.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: isSelected ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <ClanShield clanId={figOwner?.clanId || ''} size={20} />
                  <span style={{ color: figClan?.color, fontWeight: 'bold' }}>{figName}</span>
                </div>
              );
            })}
          </div>
          <button
            className="btn-primary battle-popup-accept"
            disabled={!selectedHostageTarget}
            style={{ opacity: selectedHostageTarget ? 1 : 0.5 }}
            onClick={doHostageConfirm}
          >
            Capturar
          </button>
          {(battleResolutionData.hostagesTaken || 0) > 0 && (
            <button className="btn-secondary battle-popup-accept" onClick={doHostageSkip}>
              Terminar
            </button>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // --- RONIN RESULT POPUP ---
  if (battleStepPhase === 'ronin-result' && battleResolutionData?.roninWinnerId) {
    const roninPlayer = gameState.players.find(p => p.id === battleResolutionData.roninWinnerId);
    const roninClan = roninPlayer ? CLANS.find(c => c.id === roninPlayer.clanId) : null;

    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card" style={{ borderColor: roninClan?.color }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={roninPlayer?.clanId || ''} size={36} />
            <span style={{ color: roninClan?.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {roninPlayer?.name}
            </span>
          </div>
          <p style={{ fontSize: '1em', margin: '0.5rem 0', textAlign: 'center' }}>
            Ha contratado Ronin <RoninIcon size={20} color="#e74c3c" />
          </p>
          <button className="btn-primary battle-popup-accept" onClick={doRoninResultAccept}>
            {t('battle.accept')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Step-by-step battle flow:
  // Find first battle with resolved === false. That's what we display.
  // If uncontested -> show popup. If contested -> show bidding flow. If all resolved -> war complete.
  const currentBattleIndex = allBattles.findIndex(b => !b.resolved);

  // Show battle result popup BEFORE showing "war complete" — even if all battles are resolved
  if (battleStepPhase === 'result') {
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return createPortal(
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
          resolutionData={battleResolutionData}
          localPlayerId={localPlayerId}
          battleResultReadyPlayers={gameState.battleResultReadyPlayers}
          mode={gameState.mode}
        />,
        document.body
      );
    }
  }

  // All battles resolved - war complete
  if (currentBattleIndex === -1) {
    // In online mode, the war summary popup handles the end of war flow
    if (gameState.mode === 'online') return null;
    return (
      <div className="battle-panel">
        <h3>{t('battle.warComplete')}</h3>
        <div className="resolved-battles">
          <h4>{t('battle.results')}</h4>
          {allBattles.map((b, i) => {
            const w = b.winner ? gameState.players.find(p => p.id === b.winner) : null;
            const wClan = w ? CLANS.find(c => c.id === w.clanId) : null;
            const prov = gameState.provinces[b.provinceId];
            return (
              <div key={i} className="battle-result">
                <span className="battle-region">{prov?.name || b.provinceId}</span>
                <span className="battle-winner">
                  {w ? <>{t('battle.winner')} <span style={{ color: wClan?.color, fontWeight: 'bold' }}>{w.name}</span></> : t('battle.discarded')}
                </span>
              </div>
            );
          })}
        </div>
        <button className="btn-primary advance-btn" onClick={doAdvancePhase}>{t('battle.endWar')}</button>
      </div>
    );
  }

  const battle = allBattles[currentBattleIndex];
  const province = gameState.provinces[battle.provinceId];
  const battleNumber = currentBattleIndex + 1;

  // --- UNCONTESTED BATTLE: show popup ---
  if (battle.uncontested) {
    const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
    const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;

    // Case 1: Empty province (no participants, no winner) - token discarded
    if (battle.participants.length === 0 && !winner) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card">
            <h3 className="battle-popup-title">{t('battle.battleNumber', { number: battleNumber })}</h3>
            <p className="battle-uncontested-province" style={{ color: PROVINCE_COLORS[battle.provinceId] || '#fff' }}>
              {province?.name || battle.provinceId}
            </p>
            <p className="battle-popup-message" style={{ opacity: 0.8 }}>
              {t('battle.uncontestedTokenDiscarded')}
            </p>
            {gameState.mode === 'online' && localPlayerId && (gameState.battleResultReadyPlayers || []).includes(localPlayerId) ? (
              <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                Listo {(gameState.battleResultReadyPlayers || []).length}/{gameState.players.length}
              </p>
            ) : (
              <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
                {t('battle.accept')}
              </button>
            )}
          </div>
        </div>,
        document.body
      );
    }

    // Case 2: Allied province (2 participants who are allies, winner determined by force)
    if (battle.participants.length === 2 && winner) {
      const participants = battle.participants.map(pid => {
        const p = gameState.players.find(x => x.id === pid)!;
        const clan = CLANS.find(c => c.id === p.clanId);
        const force = province ? calculateForce(province, pid, gameState) : 0;
        return { player: p, clan, force, isWinner: pid === winner.id };
      });

      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card">
            <h3 className="battle-popup-title">{t('battle.battleNumber', { number: battleNumber })}</h3>
            <p className="battle-uncontested-province" style={{ color: PROVINCE_COLORS[battle.provinceId] || '#fff' }}>
              {province?.name || battle.provinceId}
            </p>
            <p style={{ fontSize: '0.9em', opacity: 0.8, marginBottom: '0.75rem' }}>
              {t('battle.uncontestedAllied')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {participants.map(({ player: p, clan, force, isWinner }) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: isWinner ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '6px',
                    border: isWinner ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <ClanShield clanId={p.clanId} size={isWinner ? 32 : 24} />
                  <span style={{ color: clan?.color, fontWeight: 'bold', flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: '0.9em', opacity: 0.9 }}>
                    {t('battle.forceTotal', { force })}
                  </span>
                  {isWinner && (
                    <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '0.85em' }}>&#9733;</span>
                  )}
                </div>
              ))}
            </div>
            <div className="battle-uncontested-award" style={{ color: winnerClan?.color }}>
              <ClanShield clanId={winner.clanId} size={28} />
              <span>
                {t('battle.winsProvinceToken', { name: winner.name })}
              </span>
            </div>
            {gameState.mode === 'online' && localPlayerId && (gameState.battleResultReadyPlayers || []).includes(localPlayerId) ? (
              <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                Listo {(gameState.battleResultReadyPlayers || []).length}/{gameState.players.length}
              </p>
            ) : (
              <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
                {t('battle.accept')}
              </button>
            )}
          </div>
        </div>,
        document.body
      );
    }

    // Case 3: Single player (1 participant, wins without opposition)
    if (battle.participants.length === 1 && winner) {
      return createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card">
            <h3 className="battle-popup-title">{t('battle.battleNumber', { number: battleNumber })}</h3>
            <p className="battle-uncontested-province" style={{ color: PROVINCE_COLORS[battle.provinceId] || '#fff' }}>
              {province?.name || battle.provinceId}
            </p>
            <div className="battle-uncontested-participant">
              <ClanShield clanId={winner.clanId} size={36} />
              <span style={{ color: winnerClan?.color }}>
                {t('battle.uncontestedNoOpposition', { name: winner.name })}
              </span>
            </div>
            <div className="battle-uncontested-award" style={{ color: winnerClan?.color }}>
              <ClanShield clanId={winner.clanId} size={28} />
              <span>{t('battle.winsProvinceToken', { name: winner.name })}</span>
            </div>
            {gameState.mode === 'online' && localPlayerId && (gameState.battleResultReadyPlayers || []).includes(localPlayerId) ? (
              <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                Listo {(gameState.battleResultReadyPlayers || []).length}/{gameState.players.length}
              </p>
            ) : (
              <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
                {t('battle.accept')}
              </button>
            )}
          </div>
        </div>,
        document.body
      );
    }

    // Fallback (should not normally reach here)
    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card">
          <h3 className="battle-popup-title">{t('battle.battleNumber', { number: battleNumber })}</h3>
          {winner ? (
            <p className="battle-popup-message" style={{ color: winnerClan?.color }}>
              {t('battle.uncontestedWin', { name: winner.name, region: province?.name || battle.provinceId })}
            </p>
          ) : (
            <p className="battle-popup-message">{t('battle.discarded')}</p>
          )}
          <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
            {t('battle.accept')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // --- CONTESTED BATTLE ---
  const isHotseat = gameState.mode === 'hotseat';

  // In hotseat mode: if battleStepPhase is null but we have a contested battle, treat as popup phase.
  // This is a safety fallback in case battleStepPhase was not properly initialized.
  const effectiveBattleStepPhase = (isHotseat && battleStepPhase === null) ? 'popup' : battleStepPhase;

  // In hotseat mode with popup phase: show "[Player] tiene que apostar" popup
  if (isHotseat && effectiveBattleStepPhase === 'popup') {
    const currentParticipant = battle.participants[battleCurrentBiddingIndex];
    const player = gameState.players.find(p => p.id === currentParticipant);
    const playerClan = player ? CLANS.find(c => c.id === player.clanId) : null;

    return createPortal(
      <div className="battle-popup-overlay">
        <div className="battle-popup-card" style={{ borderColor: playerClan?.color }}>
          <h3 className="battle-popup-title">
            {t('battle.battleNumber', { number: battleNumber })}: <span style={{ color: PROVINCE_COLORS[battle.provinceId] || '#fff' }}>{province?.name || battle.provinceId}</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={player?.clanId || ''} size={36} />
            <p className="battle-popup-message" style={{ color: playerClan?.color, margin: 0 }}>
              {t('battle.playerMustBet', { name: player?.name || '' })}
            </p>
          </div>
          <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
            {t('battle.accept')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // In hotseat mode with result phase: show battle result summary
  if (isHotseat && effectiveBattleStepPhase === 'result') {
    // Find the most recently resolved battle (the one just resolved)
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return createPortal(
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
          resolutionData={battleResolutionData}
          localPlayerId={localPlayerId}
          battleResultReadyPlayers={gameState.battleResultReadyPlayers}
          mode={gameState.mode}
        />,
        document.body
      );
    }
  }

  // In hotseat mode with bidding phase: show bidding UI for current participant
  if (isHotseat && effectiveBattleStepPhase === 'bidding') {
    // If map peek is active, hide the overlay
    if (biddingMapPeek) return null;

    const currentParticipant = battle.participants[battleCurrentBiddingIndex];
    const player = gameState.players.find(p => p.id === currentParticipant);
    const playerClan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const maxCoins = player?.coins || 0;

    // Calculate battle count for current player
    const playerBattles = allBattles.filter(b => b.participants.includes(currentParticipant));
    const playerBattleIndex = playerBattles.findIndex(b => b.provinceId === battle.provinceId) + 1;
    const playerTotalBattles = playerBattles.length;

    const combatants: BattleCombatant[] = battle.participants.map(pid => {
      const p = gameState.players.find(x => x.id === pid)!;
      const force = province ? calculateForce(province, pid, gameState) : 0;
      return {
        playerId: pid,
        playerName: p.name,
        clanId: p.clanId,
        force,
        ronin: p.clanId === 'koi' ? p.coins : p.ronin,
      };
    });

    const handleOverlayConfirm = (bidValues: Record<string, number>) => {
      if (!currentParticipant) return;
      doSubmitWarTacticBids(battle.provinceId, bidValues);
    };

    return createPortal(
      <BattleBiddingOverlay
        playerName={player?.name || ''}
        playerClanColor={playerClan?.color || '#fff'}
        playerClanId={player?.clanId || ''}
        maxCoins={maxCoins}
        playerRonin={player ? (player.clanId === 'koi' ? player.coins : player.ronin) : 0}
        playerVP={player?.victoryPoints || 0}
        provinceName={province?.name || battle.provinceId}
        provinceColor={PROVINCE_COLORS[battle.provinceId]}
        battleNumber={battleNumber}
        isLastBattle={battleNumber === allBattles.length}
        currentPlayerId={currentParticipant}
        onConfirm={handleOverlayConfirm}
        combatants={combatants}
        playerBattleIndex={playerBattleIndex}
        playerTotalBattles={playerTotalBattles}
        onPeekMap={() => setBiddingMapPeek(true)}
      />,
      document.body
    );
  }

  // --- ONLINE MODE or fallback: show result popup for online mode ---
  if (!isHotseat && effectiveBattleStepPhase === 'result') {
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return createPortal(
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
          resolutionData={battleResolutionData}
          localPlayerId={localPlayerId}
          battleResultReadyPlayers={gameState.battleResultReadyPlayers}
          mode={gameState.mode}
        />,
        document.body
      );
    }
  }

  // --- ONLINE MODE or fallback: show bidding UI for local player simultaneously ---
  const apid = localPlayerId;
  const isPart = apid ? battle.participants.includes(apid) : false;
  const hasBid = apid ? battle.warTacticBids[apid] !== undefined : false;
  const maxCoins = apid ? (gameState.players.find(p => p.id === apid)?.coins || 0) : 0;

  return (
    <div className="battle-panel">
      <h3>{t('battle.battleNumber', { number: battleNumber })}: {t('battle.battleIn', { name: province?.name || battle.provinceId })}</h3>

      <div className="battle-info">
        <h4>{t('battle.combatants')}</h4>
        {battle.participants.map(pid => {
          const p = gameState.players.find(x => x.id === pid);
          const clan = p ? CLANS.find(c => c.id === p.clanId) : null;
          const force = province ? calculateForce(province, pid, gameState) : 0;
          return (
            <div key={pid} className="battle-combatant" style={{ borderColor: clan?.color }}>
              <span className="combatant-name" style={{ color: clan?.color }}>{p?.name}</span>
              <span className="combatant-forces">{t('battle.force')}: {force}</span>
              <span className="combatant-bid-status">
                {battle.warTacticBids[pid] !== undefined ? t('battle.bidsPlaced') : t('battle.waiting')}
              </span>
            </div>
          );
        })}
      </div>

      {isPart && !hasBid && !biddingMapPeek && createPortal(
        <BattleBiddingOverlay
          playerName={gameState.players.find(p => p.id === apid)?.name || ''}
          playerClanColor={CLANS.find(c => c.id === gameState.players.find(p => p.id === apid)?.clanId)?.color || '#fff'}
          playerClanId={gameState.players.find(p => p.id === apid)?.clanId || ''}
          maxCoins={maxCoins}
          playerRonin={(() => { const p = gameState.players.find(x => x.id === apid); return p ? (p.clanId === 'koi' ? p.coins : p.ronin) : 0; })()}
          playerVP={gameState.players.find(p => p.id === apid)?.victoryPoints || 0}
          provinceName={province?.name || battle.provinceId}
          provinceColor={PROVINCE_COLORS[battle.provinceId]}
          battleNumber={battleNumber}
          onConfirm={(bidValues) => {
            if (!apid) return;
            doSubmitWarTacticBids(battle.provinceId, bidValues);
          }}
          combatants={battle.participants.map(pid => {
            const p = gameState.players.find(x => x.id === pid)!;
            const force = province ? calculateForce(province, pid, gameState) : 0;
            return {
              playerId: pid,
              playerName: p.name,
              clanId: p.clanId,
              force,
              ronin: p.clanId === 'koi' ? p.coins : p.ronin,
            };
          })}
          playerBattleIndex={(() => { const pb = allBattles.filter(b => b.participants.includes(apid!)); return pb.findIndex(b => b.provinceId === battle.provinceId) + 1; })()}
          playerTotalBattles={allBattles.filter(b => b.participants.includes(apid!)).length}
          isLastBattle={battleNumber === allBattles.length}
          currentPlayerId={apid || undefined}
          onPeekMap={() => setBiddingMapPeek(true)}
        />,
        document.body
      )}

      {isPart && hasBid && (
        <div className="bid-waiting">
          <p>{t('battle.bidsSubmitted')}</p>
        </div>
      )}

      {!isPart && (
        <div className="bid-spectator">
          <p>{t('battle.notPart')}</p>
        </div>
      )}
    </div>
  );
};
