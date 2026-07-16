import { useMemo, useState } from 'react';
import { CLANS, SEASON_CARDS_DATA } from '../types/game';
import type { Figure, FigureType, SeasonCard } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { ClanShield } from './ClanShields';
import { DioramaFigure } from './RegionDetailModal';
import {
  getBushiImage,
  getDaimyoImage,
  getMonsterFigureImage,
  getRegionBackground,
  getShintoImage,
  TEMPLATE_FIGURE_IMG,
} from '../utils/figureImages';

type DioramaLine = 'back' | 'mid' | 'front';

interface DebugFigure {
  instanceId: string;
  label: string;
  figure: Figure;
  clanId: string;
  clanName: string;
  color: string;
}

const LINE_CONFIG: Array<{ id: DioramaLine; label: string; capacity: number }> = [
  { id: 'back', label: 'Línea Trasera', capacity: 6 },
  { id: 'mid', label: 'Línea Media', capacity: 5 },
  { id: 'front', label: 'Línea Frontal', capacity: 4 },
];

const FIGURE_PRIORITY: Record<FigureType, number> = {
  monster: 0,
  daimyo: 1,
  bushi: 2,
  shinto: 3,
  fortress: 4,
  kami: 5,
};

export const AdminDioramaModal = ({ onClose }: { onClose: () => void }) => {
  const { authUser, showFigureMeasurements } = useGameStore();
  const [selectedLine, setSelectedLine] = useState<DioramaLine>('front');
  const [lines, setLines] = useState<Record<DioramaLine, DebugFigure[]>>({
    back: [],
    mid: [],
    front: [],
  });

  const monsters = useMemo(() => {
    const byName = new Map<string, SeasonCard>();
    SEASON_CARDS_DATA
      .filter(card => card.cardType === 'monster')
      .forEach(card => {
        if (!byName.has(card.name)) byName.set(card.name, card);
      });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  if (!authUser?.isAdmin) return null;

  const addFigure = (figure: Omit<DebugFigure, 'instanceId'>) => {
    const config = LINE_CONFIG.find(line => line.id === selectedLine)!;
    setLines(current => {
      if (current[selectedLine].length >= config.capacity) return current;
      return {
        ...current,
        [selectedLine]: [
          ...current[selectedLine],
          { ...figure, instanceId: crypto.randomUUID() },
        ],
      };
    });
  };

  const addClanFigure = (clanId: string, type: 'bushi' | 'shinto' | 'daimyo') => {
    const clan = CLANS.find(item => item.id === clanId);
    if (!clan) return;
    addFigure({
      label: `${type === 'bushi' ? 'Bushi' : type === 'shinto' ? 'Shinto' : 'Daimyo'} ${clan.name}`,
      figure: { id: `debug-${type}-${clanId}`, owner: `debug-${clanId}`, type },
      clanId,
      clanName: clan.name,
      color: clan.color,
    });
  };

  const addMonster = (card: SeasonCard) => {
    const clan = CLANS[0];
    addFigure({
      label: card.name,
      figure: {
        id: `debug-monster-${card.id}`,
        owner: 'debug-monster',
        type: 'monster',
        monsterCardId: card.id,
      },
      clanId: clan.id,
      clanName: clan.name,
      color: clan.color,
    });
  };

  const removeFigure = (lineId: DioramaLine, index: number) => {
    setLines(current => ({
      ...current,
      [lineId]: current[lineId].filter((_, figureIndex) => figureIndex !== index),
    }));
  };

  const renderLine = (lineId: DioramaLine) => {
    const sorted = [...lines[lineId]].sort((a, b) =>
      FIGURE_PRIORITY[a.figure.type] - FIGURE_PRIORITY[b.figure.type]
    );
    return sorted.map(entry => (
      <DioramaFigure
        key={entry.instanceId}
        figure={entry.figure}
        ownerColor={entry.color}
        ownerClanId={entry.clanId}
        ownerName={entry.clanName}
        iconSize={100}
        showMeasurements={showFigureMeasurements}
        onClick={() => undefined}
      />
    ));
  };

  return (
    <div className="admin-diorama-backdrop" onClick={onClose}>
      <div className="admin-diorama-modal" onClick={event => event.stopPropagation()}>
        <button className="region-diorama-close" onClick={onClose}>&times;</button>
        <header className="admin-diorama-header">
          <h2>Diorama</h2>
          <span>Herramienta de pulido de figuras</span>
        </header>

        <div className="admin-diorama-layout">
          <aside className="admin-diorama-catalog">
            <h3>Figuras de clan</h3>
            <div className="admin-diorama-clan-list">
              {CLANS.map(clan => (
                <div key={clan.id} className="admin-diorama-clan-row">
                  <div className="admin-diorama-clan-name" style={{ color: clan.color }}>
                    <ClanShield clanId={clan.id} size={22} />
                    <span>{clan.name}</span>
                  </div>
                  <div className="admin-diorama-clan-figures">
                    <button onClick={() => addClanFigure(clan.id, 'bushi')} title={`Añadir Bushi ${clan.name}`}>
                      <img src={getBushiImage(clan.id) || ''} alt="" />
                      <span>Bushi</span>
                    </button>
                    <button onClick={() => addClanFigure(clan.id, 'shinto')} title={`Añadir Shinto ${clan.name}`}>
                      <img src={getShintoImage(clan.id) || ''} alt="" />
                      <span>Shinto</span>
                    </button>
                    <button onClick={() => addClanFigure(clan.id, 'daimyo')} title={`Añadir Daimyo ${clan.name}`}>
                      <img src={getDaimyoImage(clan.id) || ''} alt="" />
                      <span>Daimyo</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h3>Monstruos</h3>
            <div className="admin-diorama-monster-list">
              {monsters.map(card => (
                <button key={card.id} onClick={() => addMonster(card)} title={`Añadir ${card.name}`}>
                  <img src={getMonsterFigureImage(card.id) || TEMPLATE_FIGURE_IMG} alt="" />
                  <span>{card.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <main
            className="admin-diorama-stage"
            style={{ backgroundImage: `url(${getRegionBackground('nagato') || ''})` }}
          >
            <div className="admin-diorama-stage-shade" />
            <div className="admin-diorama-stage-title">Nagato</div>
            <div className="admin-diorama-figures admin-diorama-figures-back">{renderLine('back')}</div>
            <div className="admin-diorama-figures admin-diorama-figures-mid">{renderLine('mid')}</div>
            <div className="admin-diorama-figures admin-diorama-figures-front">{renderLine('front')}</div>
          </main>

          <aside className="admin-diorama-lines">
            {LINE_CONFIG.map(line => (
              <section key={line.id} className={`admin-diorama-line${selectedLine === line.id ? ' active' : ''}`}>
                <button
                  className="admin-diorama-line-switch"
                  onClick={() => setSelectedLine(line.id)}
                  aria-pressed={selectedLine === line.id}
                >
                  <span className="layer-toggle-indicator" />
                  {line.label}
                </button>
                <div className={`admin-diorama-slots admin-diorama-slots-${line.id}`}>
                  {Array.from({ length: line.capacity }, (_, index) => {
                    const entry = lines[line.id][index];
                    return (
                      <button
                        key={index}
                        className={`admin-diorama-slot${entry ? ' filled' : ''}`}
                        onClick={() => entry && removeFigure(line.id, index)}
                        title={entry ? `Quitar ${entry.label}` : 'Hueco vacío'}
                        disabled={!entry}
                      >
                        {entry?.label || index + 1}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <button
              className="btn-secondary admin-diorama-clear"
              onClick={() => setLines({ back: [], mid: [], front: [] })}
              disabled={!lines.back.length && !lines.mid.length && !lines.front.length}
            >
              Vaciar diorama
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};
