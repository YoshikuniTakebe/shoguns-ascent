import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { VPIcon, CoinIcon, RoninIcon } from './Icons';

const MANDATE_COLORS: Record<string, string> = {
  train: '#8B4513',
  recruit: '#87CEEB',
  marshal: '#4CAF50',
  harvest: '#FFD700',
  betray: '#E63946',
  entrenar: '#8B4513',
  reclutar: '#87CEEB',
  movilizar: '#4CAF50',
  cosechar: '#FFD700',
  traicionar: '#E63946',
};

const PROVINCE_NAMES = ['Hokkaido', 'Oshu', 'Edo', 'Kanto', 'Kansai', 'Nagato', 'Shikoku', 'Kyushu'];

function renderLogEntry(entry: string, players: { name: string; clanId: string }[]): ReactNode {
  // Build a list of replacements to apply
  type Segment = { type: 'text'; value: string } | { type: 'node'; value: ReactNode; key: string };

  // Start with the full string as one text segment
  let segments: Segment[] = [{ type: 'text', value: entry }];

  // Helper to split text segments by a pattern and replace matches with nodes
  function applyPattern(
    segs: Segment[],
    pattern: RegExp,
    replacer: (match: string, idx: number) => ReactNode
  ): Segment[] {
    const result: Segment[] = [];
    let nodeCounter = 0;
    for (const seg of segs) {
      if (seg.type !== 'text') {
        result.push(seg);
        continue;
      }
      const text = seg.value;
      let lastIndex = 0;
      const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          result.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        nodeCounter++;
        result.push({ type: 'node', value: replacer(match[0], nodeCounter), key: `n${nodeCounter}` });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        result.push({ type: 'text', value: text.slice(lastIndex) });
      }
    }
    return result;
  }

  // 1. Replace player names (longest first to avoid partial matches)
  const sortedPlayers = [...players].sort((a, b) => b.name.length - a.name.length);
  for (const player of sortedPlayers) {
    if (!player.name) continue;
    const clan = CLANS.find(c => c.id === player.clanId);
    const escapedName = player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(`\\b${escapedName}\\b`, 'g');
    segments = applyPattern(segments, namePattern, (m, idx) => (
      <span key={`player-${player.name}-${idx}`} style={{ color: clan?.color || '#fff', fontWeight: 'bold' }}>{m}</span>
    ));
  }

  // 2. Replace mandate names
  const mandatePattern = /\b(Train|Recruit|Marshal|Harvest|Betray|Entrenar|Reclutar|Movilizar|Cosechar|Traicionar)\b/gi;
  segments = applyPattern(segments, mandatePattern, (m, idx) => {
    const color = MANDATE_COLORS[m.toLowerCase()] || '#fff';
    return (
      <span key={`mandate-${idx}`} style={{ color, fontWeight: 'bold', textTransform: 'uppercase' }}>{m}</span>
    );
  });

  // 3. Replace province names
  const provincePattern = new RegExp(`\\b(${PROVINCE_NAMES.join('|')})\\b`, 'gi');
  segments = applyPattern(segments, provincePattern, (m, idx) => (
    <span key={`prov-${idx}`} style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{m}</span>
  ));

  // 4. Replace VP/PV keywords with icon
  const vpPattern = /\b(VP|PV)\b/gi;
  segments = applyPattern(segments, vpPattern, (m, idx) => (
    <span key={`vp-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{m}<VPIcon size={14} /></span>
  ));

  // 5. Replace ronin keyword with icon
  const roninPattern = /\b(ronin|ronins)\b/gi;
  segments = applyPattern(segments, roninPattern, (m, idx) => (
    <span key={`ronin-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{m}<RoninIcon size={14} /></span>
  ));

  // 6. Replace moneda/monedas/coin/coins keyword with icon
  const coinPattern = /\b(moneda|monedas|coin|coins)\b/gi;
  segments = applyPattern(segments, coinPattern, (m, idx) => (
    <span key={`coin-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{m}<CoinIcon size={14} /></span>
  ));

  // Convert segments to ReactNode array
  return segments.map((seg, i) =>
    seg.type === 'text' ? <span key={`t${i}`}>{seg.value}</span> : <span key={seg.key}>{seg.value}</span>
  );
}

export const GameLog = () => {
  const { gameState } = useGameStore();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current && selectedSeason === null) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [gameState?.log, selectedSeason]);

  if (!gameState) return null;

  const currentSeason = gameState.currentSeason;
  const logHistory = gameState.logHistory ?? {};

  // Build the list of seasons that have logs (in order)
  const seasonOrder = ['spring', 'summer', 'autumn', 'winter'];
  const availableSeasons = seasonOrder.filter(
    (s) => s === currentSeason || logHistory[s]
  );

  const seasonTranslationKeys: Record<string, TranslationKey> = {
    spring: 'season.spring',
    summer: 'season.summer',
    autumn: 'season.autumn',
    winter: 'season.winter',
  };

  // Determine which log to display
  const activeTab = selectedSeason ?? currentSeason;
  const displayLog =
    activeTab === currentSeason
      ? gameState.log
      : logHistory[activeTab] ?? [];

  const players = gameState.players;

  return (
    <div className="game-log">
      <h4>Game Log</h4>
      {availableSeasons.length > 1 && (
        <div className="log-season-tabs">
          {availableSeasons.map((season) => (
            <button
              key={season}
              className={`log-season-tab ${activeTab === season ? 'active' : ''}`}
              onClick={() => setSelectedSeason(season === currentSeason ? null : season)}
            >
              {t(seasonTranslationKeys[season])}
            </button>
          ))}
        </div>
      )}
      <div className="log-entries" ref={ref}>
        {(activeTab === currentSeason ? displayLog.slice(-20) : displayLog).map((e, i) => (
          <div key={i} className="log-entry">{renderLogEntry(e, players)}</div>
        ))}
      </div>
    </div>
  );
};
