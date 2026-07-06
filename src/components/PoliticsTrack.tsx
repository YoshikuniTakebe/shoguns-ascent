import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';
import { SeasonCardsModal } from './SeasonCardsModal';

import RecruitImg from '../img/Recruit.png';
import TrainImg from '../img/Train.png';
import HarvestImg from '../img/Harvest.png';
import MarshalImg from '../img/Marshal.png';
import BetrayImg from '../img/Betray.png';
import SecretLotusImg from '../img/Secret_Lotus.png';

const MANDATE_LABELS: Record<MandateType, string> = {
  train: 'Entrenamiento',
  recruit: 'Reclutar',
  harvest: 'Cosechar',
  marshal: 'Movilizar',
  betray: 'Traicionar',
};

const MANDATE_COLORS: Record<MandateType, string> = {
  train: '#8B4513',     // Brown / Marron
  recruit: '#87CEEB',   // Light blue / Celeste
  harvest: '#2E8B57',   // Green / Verde
  marshal: '#808080',   // Gray / Gris
  betray: '#DC143C',    // Red / Rojo
};

const MANDATE_IMAGES: Record<MandateType, string> = {
  train: TrainImg,
  recruit: RecruitImg,
  harvest: HarvestImg,
  marshal: MarshalImg,
  betray: BetrayImg,
};

/** Mandate tile image for each mandate type, using actual PNG images (small version for exhausted list) - hidden for now */

/**
 * PoliticsTrack - Shows the flow of a season:
 * Tea Ceremony -> 3 mandate slots -> Kami turn -> 2 mandate slots -> Kami turn -> 2 mandate slots -> War
 * Mandate slots fill left-to-right as players choose mandates.
 * Each mandate tile has a feudal Japanese illustration style.
 */
export const PoliticsTrack = () => {
  const { gameState, showTrainModal, setShowTrainModal, monsterPlacementPopupVisible, monsterPlacementMode, komainuChoiceVisible, monsterNoPlacementPopupVisible, localPlayerId } = useGameStore();
  const [showSeasonCards, setShowSeasonCards] = useState(false);

  // Auto-open the season cards modal when trainMandateActive becomes true
  // In online mode, only open for the current train resolution player
  useEffect(() => {
    if (gameState?.trainMandateActive) {
      if (gameState.mode === 'online') {
        const currentResolutionPlayer = gameState.trainResolutionOrder?.[gameState.trainResolutionIndex];
        if (currentResolutionPlayer === localPlayerId) {
          setShowSeasonCards(true);
        } else {
          // Not this player's turn - close if open
          setShowSeasonCards(false);
        }
      } else {
        // Hotseat mode - keep existing behavior
        setShowSeasonCards(true);
      }
    } else if (gameState?.ryujinBuyActive && gameState?.kamiResolutionStep === 'interactive') {
      // Only open for Ryujin when in interactive step (not while showing popup)
      setShowSeasonCards(true);
    } else {
      // Auto-close when train mandate completes
      setShowSeasonCards(false);
    }
  }, [gameState?.trainMandateActive, gameState?.ryujinBuyActive, gameState?.kamiResolutionStep, gameState?.trainResolutionIndex, gameState?.mode, localPlayerId]);

  // Close the modal when monster placement is active
  useEffect(() => {
    if (monsterPlacementPopupVisible || monsterPlacementMode || komainuChoiceVisible || monsterNoPlacementPopupVisible) {
      setShowSeasonCards(false);
    }
  }, [monsterPlacementPopupVisible, monsterPlacementMode, komainuChoiceVisible, monsterNoPlacementPopupVisible]);

  // Also open when triggered from outside (e.g. ActionPanel button)
  useEffect(() => {
    if (showTrainModal) {
      setShowSeasonCards(true);
      setShowTrainModal(false);
    }
  }, [showTrainModal, setShowTrainModal]);

  if (!gameState) return null;

  const mandates = gameState.mandatesThisTurn;
  const mandateCount = gameState.politicsMandateCount;

  // Count how many times each mandate type has been played this season
  const mandateCounts: Record<MandateType, number> = {
    recruit: 0,
    marshal: 0,
    train: 0,
    harvest: 0,
    betray: 0,
  };
  for (const m of mandates) {
    if (!m.hidden) {
      mandateCounts[m.type]++;
    }
  }

  // Exhausted mandates (played 2 times already) - currently hidden
  // const exhaustedMandates = (Object.keys(mandateCounts) as MandateType[]).filter(
  //   (t) => mandateCounts[t] >= 2
  // );

  const renderSlot = (slotIndex: number) => {
    const mandate = slotIndex < mandates.length ? mandates[slotIndex] : null;
    const isCurrent = slotIndex === mandateCount && gameState.currentPhase === 'politics';

    if (mandate) {
      const player = gameState.players.find(p => p.id === mandate.issuer);
      const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
      const clanColor = clan?.color || '#888';
      const playerName = player?.name;

      // Loto clan power: mandate tile is face down (hidden from other players)
      if (mandate.hidden) {
        return (
          <div
            key={`slot-${slotIndex}`}
            className="politics-track-slot filled hidden-mandate"
            style={{
              borderColor: MANDATE_COLORS[mandate.type],
              backgroundImage: `url(${SecretLotusImg})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
            title={`Mandato secreto - ${clan?.name || 'Loto'}`}
          >
            {playerName && (
              <span className="slot-player-name" style={{ color: clanColor }}>
                {playerName}
              </span>
            )}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: MANDATE_COLORS[mandate.type],
              border: '1px solid rgba(255,255,255,0.3)'
            }} />
          </div>
        );
      }

      return (
        <div
          key={`slot-${slotIndex}`}
          className="politics-track-slot filled"
          style={{
            borderColor: MANDATE_COLORS[mandate.type],
            backgroundImage: `url(${MANDATE_IMAGES[mandate.type]})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          title={`${MANDATE_LABELS[mandate.type]} - ${clan?.name || 'Unknown'}`}
        >
          {playerName && (
            <span className="slot-player-name" style={{ color: clanColor }}>
              {playerName}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        key={`slot-${slotIndex}`}
        className={`politics-track-slot empty${isCurrent ? ' current' : ''}`}
      >
        <span className="slot-number">{slotIndex + 1}</span>
      </div>
    );
  };

  const renderKamiIcon = (key: string) => (
    <div key={key} className="politics-phase-wrapper">
      <div className={`politics-track-kami${gameState.kamiResolutionActive ? ' active' : ''}`}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          {/* Torii gate - spiritual gateway */}
          <path
            d="M4 6h16M5 6c0-1 2-3 7-3s7 2 7 3"
            stroke="var(--accent-gold)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M6 6v16M18 6v16"
            stroke="var(--accent-gold)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M6 11h12"
            stroke="var(--accent-gold)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
      <span className="politics-phase-tooltip">Turno Kami</span>
    </div>
  );

  return (
    <div className="politics-track">
      {/* Tea Ceremony icon */}
      <div className="politics-phase-wrapper">
        <div className={`politics-track-phase-icon tea${gameState.currentPhase === 'tea' ? ' active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {/* Japanese teapot (kyusu) silhouette */}
            <path
              d="M6 11c0-2 1.5-4 6-4s6 2 6 4v3c0 3-2 5-6 5s-6-2-6-5v-3z"
              fill="var(--accent-cream)"
              opacity="0.85"
            />
            {/* Lid knob */}
            <circle cx="12" cy="6" r="1.5" fill="var(--accent-cream)" opacity="0.9" />
            {/* Lid */}
            <path
              d="M8 7.5h8"
              stroke="var(--accent-cream)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            {/* Handle on left side */}
            <path
              d="M6 10c-2 0-3.5 1-3.5 3s1.5 3 3.5 3"
              stroke="var(--accent-cream)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.8"
            />
            {/* Spout on right side */}
            <path
              d="M18 12l3-2"
              stroke="var(--accent-cream)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Steam wisps */}
            <path d="M10 4c0-1.5 1-2.5 1-3.5" stroke="var(--accent-cream)" strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />
            <path d="M14 4c0-1.5 1-2.5 1-3.5" stroke="var(--accent-cream)" strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="politics-phase-tooltip politics-phase-tooltip-tea" style={{ left: '150%' }}>Ceremonia del Té</span>
      </div>

      {/* First 3 mandate slots */}
      {renderSlot(0)}
      {renderSlot(1)}
      {renderSlot(2)}

      {/* Kami turn */}
      {renderKamiIcon('kami-1')}

      {/* Next 2 mandate slots */}
      {renderSlot(3)}
      {renderSlot(4)}

      {/* Kami turn */}
      {renderKamiIcon('kami-2')}

      {/* Last 2 mandate slots */}
      {renderSlot(5)}
      {renderSlot(6)}

      {/* Kami turn */}
      {renderKamiIcon('kami-3')}

      {/* Vertical red separator between Kami and War */}
      <div style={{ margin: '0 0.65rem', display: 'flex', alignItems: 'center' }}>
        <svg width="10" height="42" viewBox="0 0 10 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="5" y1="0" x2="5" y2="16" stroke="var(--accent-red)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 16 L9 21 L5 26 L1 21 Z" fill="var(--accent-red)" opacity="0.85" />
          <line x1="5" y1="26" x2="5" y2="42" stroke="var(--accent-red)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* War phase icon */}
      <div className="politics-phase-wrapper">
        <div className={`politics-track-phase-icon war${gameState.currentPhase === 'war' ? ' active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {/* Crossed katanas */}
            <path
              d="M4 4l16 16"
              stroke="var(--accent-red)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M20 4l-16 16"
              stroke="var(--accent-red)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Katana guards (tsuba) */}
            <circle cx="8" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7" />
            <circle cx="16" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7" />
            {/* Blade tips */}
            <path d="M3 3l1.5 0.5L4 4" fill="var(--accent-red)" opacity="0.9" />
            <path d="M21 3l-1.5 0.5L20 4" fill="var(--accent-red)" opacity="0.9" />
            {/* Impact spark at center */}
            <circle cx="12" cy="12" r="1.5" fill="var(--accent-red)" opacity="0.6" />
            <path d="M12 9v-1.5M12 15v1.5M9 12h-1.5M15 12h1.5" stroke="var(--accent-red)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
        <span className="politics-phase-tooltip">Fase de Batallas</span>
      </div>

      {/* Exhausted mandates indicator - hidden for now */}

      {/* Season Cards Button */}
      <button
        className="season-cards-btn"
        onClick={() => setShowSeasonCards(true)}
        title="Cartas de Estacion"
      >
        <span className="season-cards-btn-kanji">旭</span>
        <span className="season-cards-btn-text">Cartas</span>
      </button>

      {/* Season Cards Modal */}
      <SeasonCardsModal open={showSeasonCards} onClose={() => setShowSeasonCards(false)} />
    </div>
  );
};
