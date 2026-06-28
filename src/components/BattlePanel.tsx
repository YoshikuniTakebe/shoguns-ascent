import { type ReactNode } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import type { Battle, GameState } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';
import { useT } from '../i18n';
import { calculateForce } from '../utils/gameLogic';
import { BattleBiddingOverlay } from './BattleBiddingOverlay';

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

  return segments.map((seg, i) =>
    seg.type === 'text' ? <span key={`t${i}`}>{seg.value}</span> : <span key={`n${i}`}>{seg.value}</span>
  );
}

/**
 * Shared battle result popup content used by both hotseat and online modes.
 */
function BattleResultPopup({
  battle,
  gameState,
  onAccept,
  t,
}: {
  battle: Battle;
  gameState: GameState;
  onAccept: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const resProvince = gameState.provinces[battle.provinceId];
  const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
  const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
  const battleLogs = extractBattleLogs(gameState.log, battle);

  return (
    <div className="battle-popup-overlay">
      <div className="battle-popup-card">
        <h3 className="battle-popup-title">{t('battle.resultTitle')}</h3>
        <p className="battle-popup-message" style={{ fontSize: '1.1em', marginBottom: '0.5rem' }}>
          {resProvince?.name || battle.provinceId}
        </p>
        {winner && winnerClan && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={winner.clanId} size={28} />
            <span style={{ color: winnerClan.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {t('battle.resultWinner', { name: winner.name })}
            </span>
          </div>
        )}
        {winner && (
          <p style={{ color: winnerClan?.color, margin: '0.25rem 0' }}>
            {t('battle.resultWarToken', { province: resProvince?.name || battle.provinceId })}
          </p>
        )}
        {battleLogs.length > 0 && (
          <div style={{ textAlign: 'left', margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.9em' }}>
            {battleLogs.map((entry, i) => (
              <p key={i} style={{ margin: '0.2rem 0' }}>{renderBattleLogEntry(entry, gameState.players)}</p>
            ))}
          </div>
        )}
        <button className="btn-primary battle-popup-accept" onClick={onAccept}>
          {t('battle.continue')}
        </button>
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
    doAcceptBattlePopup,
    doCoinDistributionChoice,
  } = useGameStore();
  const t = useT();

  if (!gameState) return null;

  // --- COIN DISTRIBUTION POPUP: show when winner must allocate remainder coins ---
  if (gameState.coinDistributionPending) {
    const pending = gameState.coinDistributionPending;
    const winner = gameState.players.find(p => p.id === pending.winnerId);
    const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
    const province = gameState.provinces[pending.battleProvinceId];

    return (
      <div className="battle-popup-overlay">
        <div className="battle-popup-card">
          <h3 className="battle-popup-title">{t('battle.coinDistributionTitle')}</h3>
          <p style={{ fontSize: '0.95em', marginBottom: '0.5rem' }}>
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
      </div>
    );
  }

  const allBattles = gameState.activeBattles;

  // Step-by-step battle flow:
  // Find first battle with resolved === false. That's what we display.
  // If uncontested -> show popup. If contested -> show bidding flow. If all resolved -> war complete.
  const currentBattleIndex = allBattles.findIndex(b => !b.resolved);

  // All battles resolved - war complete
  if (currentBattleIndex === -1) {
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

    return (
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
      </div>
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

    return (
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
      </div>
    );
  }

  // In hotseat mode with result phase: show battle result summary
  if (isHotseat && effectiveBattleStepPhase === 'result') {
    // Find the most recently resolved battle (the one just resolved)
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return (
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
        />
      );
    }
  }

  // In hotseat mode with bidding phase: show bidding UI for current participant
  if (isHotseat && effectiveBattleStepPhase === 'bidding') {
    const currentParticipant = battle.participants[battleCurrentBiddingIndex];
    const player = gameState.players.find(p => p.id === currentParticipant);
    const playerClan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const maxCoins = player?.coins || 0;

    const handleOverlayConfirm = (bidValues: Record<string, number>) => {
      if (!currentParticipant) return;
      doSubmitWarTacticBids(battle.provinceId, bidValues);
    };

    return (
      <BattleBiddingOverlay
        playerName={player?.name || ''}
        playerClanColor={playerClan?.color || '#fff'}
        maxCoins={maxCoins}
        provinceName={province?.name || battle.provinceId}
        battleNumber={battleNumber}
        onConfirm={handleOverlayConfirm}
      />
    );
  }

  // --- ONLINE MODE or fallback: show result popup for online mode ---
  if (!isHotseat && effectiveBattleStepPhase === 'result') {
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return (
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
        />
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

      {isPart && !hasBid && (
        <BattleBiddingOverlay
          playerName={gameState.players.find(p => p.id === apid)?.name || ''}
          playerClanColor={CLANS.find(c => c.id === gameState.players.find(p => p.id === apid)?.clanId)?.color || '#fff'}
          maxCoins={maxCoins}
          provinceName={province?.name || battle.provinceId}
          battleNumber={battleNumber}
          onConfirm={(bidValues) => {
            if (!apid) return;
            doSubmitWarTacticBids(battle.provinceId, bidValues);
          }}
        />
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
