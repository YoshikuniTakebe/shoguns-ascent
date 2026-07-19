import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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
import {
  formatFigureScale,
  getFigureSizeKey,
  getFigureSizeOverride,
} from '../utils/figureSizes';

type DioramaLine = 'back' | 'mid' | 'front';

interface DebugFigure {
  instanceId: string;
  label: string;
  figure: Figure;
  clanId: string;
  clanName: string;
  color: string;
}

interface FloatingPanelProps {
  title: string;
  className: string;
  initialSide: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
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

function FloatingPanel({
  title,
  className,
  initialSide,
  collapsed,
  onToggle,
  children,
}: FloatingPanelProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      setOffset({
        x: drag.current.originX + event.clientX - drag.current.x,
        y: drag.current.originY + event.clientY - drag.current.y,
      });
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag.current?.pointerId === event.pointerId) drag.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.preventDefault();
  };

  const style = {
    '--panel-x': `${offset.x}px`,
    '--panel-y': `${offset.y}px`,
  } as CSSProperties;

  return (
    <aside
      className={`admin-diorama-floating-panel ${className}${collapsed ? ' collapsed' : ''} admin-diorama-panel-${initialSide}`}
      style={style}
    >
      <div className="admin-diorama-panel-header" onPointerDown={startDrag}>
        <span className="admin-diorama-drag-grip" aria-hidden="true">⋮⋮</span>
        <strong>{title}</strong>
        <button
          type="button"
          className="admin-diorama-collapse"
          onPointerDown={event => event.stopPropagation()}
          onClick={onToggle}
          title={collapsed ? `Abrir ${title}` : `Plegar ${title}`}
          aria-label={collapsed ? `Abrir ${title}` : `Plegar ${title}`}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && <div className="admin-diorama-panel-body">{children}</div>}
    </aside>
  );
}

export const AdminDioramaModal = ({ onClose }: { onClose: () => void }) => {
  const {
    authUser,
    showFigureMeasurements,
    figureSizeOverrides,
    setFigureSizeOverride,
  } = useGameStore();
  const [selectedLine, setSelectedLine] = useState<DioramaLine>('front');
  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [linesCollapsed, setLinesCollapsed] = useState(false);
  const [scaleInputs, setScaleInputs] = useState<Record<string, string>>({});
  const [savingFigureId, setSavingFigureId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const sortFigures = (figures: DebugFigure[]) => [...figures].sort((a, b) =>
    FIGURE_PRIORITY[a.figure.type] - FIGURE_PRIORITY[b.figure.type]
  );

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

  const removeFigure = (lineId: DioramaLine, instanceId: string) => {
    setLines(current => ({
      ...current,
      [lineId]: current[lineId].filter(entry => entry.instanceId !== instanceId),
    }));
    setScaleInputs(current => {
      const next = { ...current };
      delete next[instanceId];
      return next;
    });
  };

  const parsePercentage = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    if (!/^[+-]\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  };

  const modifyFigureScale = async (entry: DebugFigure) => {
    const percentage = parsePercentage(scaleInputs[entry.instanceId] || '');
    if (percentage === null) return;
    const currentScale = getFigureSizeOverride(entry.figure, entry.clanId, figureSizeOverrides);
    const nextScale = Math.min(3, Math.max(0.2, currentScale * (1 + percentage / 100)));
    const key = getFigureSizeKey(entry.figure, entry.clanId);
    setSaveError(null);
    setSavingFigureId(entry.instanceId);
    try {
      await setFigureSizeOverride(key, nextScale);
      setScaleInputs(current => ({ ...current, [entry.instanceId]: '' }));
    } catch {
      setSaveError('No se ha podido guardar el tamaño.');
    } finally {
      setSavingFigureId(null);
    }
  };

  const getClanFigureScale = (clanId: string, type: 'bushi' | 'shinto' | 'daimyo') =>
    getFigureSizeOverride(
      { id: `scale-${type}-${clanId}`, owner: '', type },
      clanId,
      figureSizeOverrides,
    );

  const getMonsterScale = (card: SeasonCard) =>
    getFigureSizeOverride(
      { id: `scale-${card.id}`, owner: '', type: 'monster', monsterCardId: card.id },
      CLANS[0].id,
      figureSizeOverrides,
    );

  const renderLine = (lineId: DioramaLine) =>
    sortFigures(lines[lineId]).map(entry => (
      <DioramaFigure
        key={entry.instanceId}
        figure={entry.figure}
        ownerColor={entry.color}
        ownerClanId={entry.clanId}
        ownerName={entry.clanName}
        iconSize={100}
        showMeasurements={showFigureMeasurements}
        sizeOverrides={figureSizeOverrides}
        onClick={() => undefined}
      />
    ));

  return (
    <div className="admin-diorama-backdrop" onClick={onClose}>
      <div className="admin-diorama-modal" onClick={event => event.stopPropagation()}>
        <button className="region-diorama-close" onClick={onClose}>&times;</button>
        <header className="admin-diorama-header">
          <h2>Diorama</h2>
          <span>Herramienta de pulido de figuras</span>
        </header>

        <div className="admin-diorama-layout">
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

          <FloatingPanel
            title="Figuras"
            className="admin-diorama-catalog"
            initialSide="left"
            collapsed={catalogCollapsed}
            onToggle={() => setCatalogCollapsed(value => !value)}
          >
            <h3>Figuras de clan</h3>
            <div className="admin-diorama-clan-list">
              {CLANS.map(clan => (
                <div key={clan.id} className="admin-diorama-clan-row">
                  <div className="admin-diorama-clan-name" style={{ color: clan.color }}>
                    <ClanShield clanId={clan.id} size={22} />
                    <span>{clan.name}</span>
                  </div>
                  <div className="admin-diorama-clan-figures">
                    {(['bushi', 'shinto', 'daimyo'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => addClanFigure(clan.id, type)}
                        title={`Añadir ${type} ${clan.name}`}
                      >
                        <img
                          src={
                            type === 'bushi' ? getBushiImage(clan.id) || ''
                              : type === 'shinto' ? getShintoImage(clan.id) || ''
                                : getDaimyoImage(clan.id) || ''
                          }
                          alt=""
                        />
                        <span>
                          {type === 'bushi' ? 'Bushi' : type === 'shinto' ? 'Shinto' : 'Daimyo'}
                          {' '}({formatFigureScale(getClanFigureScale(clan.id, type))})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h3>Monstruos</h3>
            <div className="admin-diorama-monster-list">
              {monsters.map(card => (
                <button key={card.id} onClick={() => addMonster(card)} title={`Añadir ${card.name}`}>
                  <img src={getMonsterFigureImage(card.id) || TEMPLATE_FIGURE_IMG} alt="" />
                  <span>{card.name} ({formatFigureScale(getMonsterScale(card))})</span>
                </button>
              ))}
            </div>
          </FloatingPanel>

          <FloatingPanel
            title="Líneas y tamaños"
            className="admin-diorama-lines"
            initialSide="right"
            collapsed={linesCollapsed}
            onToggle={() => setLinesCollapsed(value => !value)}
          >
            {LINE_CONFIG.map(line => {
              const entries = sortFigures(lines[line.id]);
              return (
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
                      const entry = entries[index];
                      if (!entry) {
                        return <div key={index} className="admin-diorama-slot empty">{index + 1}</div>;
                      }
                      const currentScale = getFigureSizeOverride(entry.figure, entry.clanId, figureSizeOverrides);
                      const inputValue = scaleInputs[entry.instanceId] || '';
                      const canModify = parsePercentage(inputValue) !== null && savingFigureId === null;
                      return (
                        <div key={entry.instanceId} className="admin-diorama-slot filled">
                          <button
                            type="button"
                            className="admin-diorama-slot-remove"
                            onClick={() => removeFigure(line.id, entry.instanceId)}
                            title={`Quitar ${entry.label}`}
                            aria-label={`Quitar ${entry.label}`}
                          >
                            &times;
                          </button>
                          <div className="admin-diorama-slot-name">{entry.label}</div>
                          <div className="admin-diorama-slot-scale">({formatFigureScale(currentScale)})</div>
                          <input
                            value={inputValue}
                            onChange={event => setScaleInputs(current => ({
                              ...current,
                              [entry.instanceId]: event.target.value,
                            }))}
                            onKeyDown={event => {
                              if (event.key === 'Enter' && canModify) modifyFigureScale(entry);
                            }}
                            placeholder="+25 / -25"
                            inputMode="decimal"
                            aria-label={`Porcentaje para ${entry.label}`}
                          />
                          <button
                            type="button"
                            className="admin-diorama-modify"
                            disabled={!canModify}
                            onClick={() => modifyFigureScale(entry)}
                          >
                            {savingFigureId === entry.instanceId ? 'Guardando...' : 'Modificar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {saveError && <div className="admin-diorama-save-error">{saveError}</div>}
            <button
              className="btn-secondary admin-diorama-clear"
              onClick={() => setLines({ back: [], mid: [], front: [] })}
              disabled={!lines.back.length && !lines.mid.length && !lines.front.length}
            >
              Vaciar diorama
            </button>
          </FloatingPanel>
        </div>
      </div>
    </div>
  );
};
