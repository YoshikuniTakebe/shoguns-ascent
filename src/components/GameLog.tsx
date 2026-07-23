import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS, SEASON_CARDS_DATA } from '../types/game';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon, SpringIcon, SummerIcon, AutumnIcon, WinterIcon, BushiIcon, ShintoIcon, DaimyoIcon, FortressIcon, MonsterIcon } from './Icons';
import { ClanShield } from './ClanShields';

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
  type Segment = { type: 'text'; value: string } | { type: 'node'; value: ReactNode };

  // Start with the full string as one text segment
  let segments: Segment[] = [{ type: 'text', value: entry }];

  // Global counter for unique keys across all applyPattern calls within this entry
  let globalNodeCounter = 0;

  // Helper to split text segments by a pattern and replace matches with nodes
  function applyPattern(
    segs: Segment[],
    pattern: RegExp,
    replacer: (match: string, uniqueKey: string) => ReactNode
  ): Segment[] {
    const result: Segment[] = [];
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
        // Prevent infinite loops on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        if (match.index > lastIndex) {
          result.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        globalNodeCounter++;
        const key = `seg-${globalNodeCounter}`;
        result.push({ type: 'node', value: replacer(match[0], key) });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        result.push({ type: 'text', value: text.slice(lastIndex) });
      }
    }
    return result;
  }

  // 1. Replace player names (longest first to avoid partial matches)
  // Use lookbehind/lookahead to ensure we match the full name as an isolated token,
  // not as a substring within other text. This prevents false matches when player
  // names share prefixes or contain numbers that could match partial patterns.
  const sortedPlayers = [...players].sort((a, b) => b.name.length - a.name.length);
  for (const player of sortedPlayers) {
    if (!player.name) continue;
    const clan = CLANS.find(c => c.id === player.clanId);
    const escapedName = player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use negative lookbehind/lookahead for word characters (\w) to prevent matching
    // player names as substrings. This is stricter than \b for multi-word names with
    // digits (e.g., "Player 1" won't accidentally match within "Player 10" or similar).
    const namePattern = new RegExp(`(?<![\\w])${escapedName}(?![\\w])`, 'g');
    segments = applyPattern(segments, namePattern, (m, key) => (
      <span key={key} style={{ color: clan?.color || '#fff', fontWeight: 'bold' }}>{m}</span>
    ));
  }

  // 2. Replace mandate names
  const mandatePattern = /\b(Train|Recruit|Marshal|Harvest|Betray|Entrenar|Reclutar|Movilizar|Cosechar|Traicionar)\b/gi;
  segments = applyPattern(segments, mandatePattern, (m, key) => {
    const color = MANDATE_COLORS[m.toLowerCase()] || '#fff';
    return (
      <span key={key} style={{ color, fontWeight: 'bold', textTransform: 'uppercase' }}>{m}</span>
    );
  });

  // 3. Replace kami names with their colors
  const KAMI_LOG_COLORS: Record<string, string> = {
    amaterasu: '#FFD700',
    fujin: '#4ECDC4',
    raijin: '#9B59B6',
    ryujin: '#3498DB',
    hachiman: '#E74C3C',
    susanoo: '#E67E22',
    tsukuyomi: '#7F8C8D',
  };
  const kamiNames = ['Amaterasu', 'Fujin', 'Raijin', 'Ryujin', 'Hachiman', 'Susanoo', 'Tsukuyomi'];
  const kamiPattern = new RegExp(`(?<!\\w)(${kamiNames.join('|')})(?!\\w)`, 'gi');
  segments = applyPattern(segments, kamiPattern, (m, key) => {
    const color = KAMI_LOG_COLORS[m.toLowerCase()] || '#fff';
    return (
      <span key={key} style={{ color, fontWeight: 'bold' }}>{m}</span>
    );
  });

  // 4. Replace province names with colored styling
  const provincePattern = new RegExp(`\\b(${PROVINCE_NAMES.join('|')})\\b`, 'gi');
  segments = applyPattern(segments, provincePattern, (m, key) => {
    const color = PROVINCE_COLORS[m.toLowerCase()] || '#fff';
    return (
      <span key={key} style={{ fontWeight: 'bold', fontStyle: 'italic', color }}>{m}</span>
    );
  });

  // 5. Replace VP/PV keywords (and preceding number if present) with bold red + icon
  const vpPattern = /(\d+\s*)?\b(VP|PV)\b/gi;
  segments = applyPattern(segments, vpPattern, (m, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#E63946', fontWeight: 'bold' }}>{m}<VPIcon size={14} /></span>
  ));

  // 5.5. Replace troop type keywords with corresponding icons in clan color
  let troopIconColor = '#DAA520'; // fallback gold
  for (const p of players) {
    if (entry.includes(p.name)) {
      const clan = CLANS.find(c => c.id === p.clanId);
      if (clan) { troopIconColor = clan.color; break; }
    }
  }

  const troopTypeIconMap: Record<string, (props: { size?: number; color?: string }) => ReactNode> = {
    bushi: BushiIcon,
    shinto: ShintoIcon,
    daimyo: DaimyoIcon,
    fortress: FortressIcon,
    fortaleza: FortressIcon,
    monster: MonsterIcon,
    monstruo: MonsterIcon,
  };

  // Match monster(MonsterName) pattern first (from marshal move logs)
  const monsterNamePattern = /monster\(([^)]+)\)/gi;
  segments = applyPattern(segments, monsterNamePattern, (m, key) => {
    const nameMatch = /monster\(([^)]+)\)/i.exec(m);
    const monsterName = nameMatch ? nameMatch[1] : m;
    return (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{MonsterIcon({ size: 14, color: troopIconColor })}{monsterName}</span>
    );
  });

  const troopPattern = /\b(bushi|shinto|daimyo|fortress|fortaleza|monster|monstruo)\b/gi;
  segments = applyPattern(segments, troopPattern, (m, key) => {
    const IconComponent = troopTypeIconMap[m.toLowerCase()];
    return (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{m}{IconComponent && IconComponent({ size: 14, color: troopIconColor })}</span>
    );
  });

  // 6. Replace ronin keyword (and preceding number if present) with bold red + icon
  const roninPattern = /(\d+\s*)?\b(ronin|ronins)\b/gi;
  segments = applyPattern(segments, roninPattern, (m, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#E63946', fontWeight: 'bold' }}>{m}<RoninIcon size={14} color="#E63946" /></span>
  ));

  // 6.5. Replace {h} with just the HonorIcon (no text)
  const honorTokenPattern = /\{h\}/g;
  segments = applyPattern(segments, honorTokenPattern, (_m, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center' }}><HonorIcon size={14} color="#DAA520" /></span>
  ));

  // 6.6. Replace honor keyword with bold styling + HonorIcon
  const honorPattern = /\b(honor)\b/gi;
  segments = applyPattern(segments, honorPattern, (m, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#DAA520', fontWeight: 'bold' }}>{m}<HonorIcon size={14} /></span>
  ));

  // 7. Replace {coin} token followed by a number with CoinIcon + number (bold gold)
  const clanCoinTotalPattern = /\{clanCoins:([^:}]+):(\d+)\}/g;
  segments = applyPattern(segments, clanCoinTotalPattern, (m, key) => {
    const match = /\{clanCoins:([^:}]+):(\d+)\}/.exec(m);
    const clan = CLANS.find(item => item.id === match?.[1]);
    return (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: clan?.color || '#DAA520', fontWeight: 'bold' }}>
        <ClanShield clanId={match?.[1] || ''} size={16} /><CoinIcon size={14} color={clan?.color || '#DAA520'} />{match?.[2] || '0'}
      </span>
    );
  });

  const knownMonsterNames = SEASON_CARDS_DATA.filter(card => card.cardType === 'monster')
    .map(card => card.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  if (knownMonsterNames.length > 0) {
    const knownMonsterPattern = new RegExp(`(?<!\\w)(${knownMonsterNames.join('|')})(?!\\w)`, 'gi');
    segments = applyPattern(segments, knownMonsterPattern, (m, key) => (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: troopIconColor, fontWeight: 'bold' }}>
        <MonsterIcon size={14} color={troopIconColor} />{m}
      </span>
    ));
  }

  // 7. Replace {coin} token followed by a number with CoinIcon + number (bold gold)
  const coinTokenPattern = /\{coin\}\s*(\d+)/g;
  segments = applyPattern(segments, coinTokenPattern, (m, key) => {
    const numberMatch = m.match(/\d+/);
    const number = numberMatch ? numberMatch[0] : '';
    return (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#DAA520', fontWeight: 'bold' }}><CoinIcon size={14} />{number}</span>
    );
  });

  // 7.1. Replace standalone {coin} token (without number) with just CoinIcon
  const coinTokenStandalonePattern = /\{coin\}/g;
  segments = applyPattern(segments, coinTokenStandalonePattern, (_m, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center' }}><CoinIcon size={14} color="#DAA520" /></span>
  ));

  // 7.2. Replace moneda/monedas/coin/coins keyword (and preceding number if present) with bold gold + icon
  const coinPattern = /(\d+\s*)?\b(moneda|monedas|coin|coins)\b/gi;
  segments = applyPattern(segments, coinPattern, (m, key) => {
    const numberMatch = m.match(/\d+/);
    const number = numberMatch ? numberMatch[0] : '';
    return (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#DAA520', fontWeight: 'bold' }}><CoinIcon size={14} />{number}</span>
    );
  });

  // Convert segments to ReactNode array using positional index for keys
  return segments.map((seg, i) =>
    seg.type === 'text' ? <span key={`t${i}`}>{seg.value}</span> : <span key={`n${i}`}>{seg.value}</span>
  );
}

export const GameLog = () => {
  const { gameState, localPlayerId } = useGameStore();
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

  const seasonTabColors: Record<string, string> = {
    spring: '#FFB7C5',
    summer: '#FF6B35',
    autumn: '#D4A574',
    winter: '#A8C8E8',
  };

  const seasonIcons: Record<string, ReactNode> = {
    spring: <SpringIcon size={14} color="#1a1a2e" />,
    summer: <SummerIcon size={14} color="#1a1a2e" />,
    autumn: <AutumnIcon size={14} color="#1a1a2e" />,
    winter: <WinterIcon size={14} color="#1a1a2e" />,
  };

  // Determine which log to display
  const activeTab = selectedSeason ?? currentSeason;
  const publicDisplayLog =
    activeTab === currentSeason
      ? [...(logHistory[currentSeason] ?? []), ...gameState.log]
      : logHistory[activeTab] ?? [];
  const warStartIndex = publicDisplayLog.lastIndexOf('=== Comienza la Fase de Guerra ===');
  const currentWarComplete = gameState.activeBattles.length > 0
    && gameState.activeBattles.every(battle => battle.resolved || battle.uncontested);
  const concealCurrentWarTotals = activeTab === currentSeason
    && gameState.currentPhase === 'war'
    && !currentWarComplete
    && warStartIndex >= 0;
  const visiblePublicDisplayLog = concealCurrentWarTotals
    ? publicDisplayLog.map((entry, index) =>
        index >= warStartIndex ? entry.replace(/\s*\.?\s+Total\b.*$/i, '') : entry
      )
    : publicDisplayLog;
  const historyPrefixLength = activeTab === currentSeason ? (logHistory[currentSeason]?.length ?? 0) : 0;
  const privateEntries = (gameState.privateLogEntries || [])
    .filter(entry => entry.season === activeTab && (
      gameState.mode === 'hotseat' || (!!localPlayerId && entry.playerIds.includes(localPlayerId))
    ))
    .map(entry => ({
      ...entry,
      displayIndex: entry.logIndex + historyPrefixLength,
    }));
  const displayLog: string[] = [];
  for (let index = 0; index <= visiblePublicDisplayLog.length; index++) {
    privateEntries
      .filter(entry => entry.displayIndex === index)
      .forEach(entry => displayLog.push(entry.text));
    if (index < visiblePublicDisplayLog.length) displayLog.push(visiblePublicDisplayLog[index]);
  }

  const players = gameState.players;

  return (
    <div className="game-log">
      <h4>Game Log</h4>
      {availableSeasons.length > 1 && (
        <div className="log-season-tabs">
          {availableSeasons.map((season) => {
            const isActive = activeTab === season;
            const baseColor = seasonTabColors[season] || '#ccc';
            return (
              <button
                key={season}
                className={`log-season-tab ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: isActive ? baseColor : `${baseColor}55`,
                  borderColor: baseColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  ...(isActive ? { color: '#ffffff' } : {}),
                }}
                onClick={() => setSelectedSeason(season === currentSeason ? null : season)}
              >
                {seasonIcons[season]}
                {t(seasonTranslationKeys[season])}
              </button>
            );
          })}
        </div>
      )}
      <div className="log-entries" ref={ref}>
        {(() => {
          const entries = displayLog;
          const startIndex = 0;
          return entries.map((e, i) => (
            <div key={`${startIndex + i}-${e.slice(0, 30)}`} className="log-entry">{renderLogEntry(e, players)}</div>
          ));
        })()}
      </div>
    </div>
  );
};
