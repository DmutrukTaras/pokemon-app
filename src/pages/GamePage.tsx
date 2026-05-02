import { useEffect, useMemo } from "react";
import { Board } from "../components/Board/Board";
import { GameLog } from "../components/GameLog/GameLog";
import { Hand } from "../components/Hand/Hand";
import { Hero } from "../components/Hero/Hero";
import type { Card } from "../game/types";
import { getAttackCost, getEvolutionCost, getMatchupKind } from "../game/rules";
import { useGameStore } from "../store/gameStore";
import styles from "./GamePage.module.css";

function getPlayableHandIds(
  hand: Card[],
  boardSize: number,
  hasPlayedCardThisTurn: boolean,
) {
  return new Set(
    hand
      .filter((card) => card.evolutionStage === 0 && boardSize < 5 && !hasPlayedCardThisTurn)
      .map((card) => card.id),
  );
}

function getEvolvableBoardIds(
  board: Card[],
  hand: Card[],
  energy: number,
  turnNumber: number,
) {
  return new Set(
    board
      .filter(
        (boardCard) =>
          boardCard.enteredTurn !== turnNumber &&
          hand.some(
            (handCard) =>
              handCard.evolvesFromSpeciesId === boardCard.speciesId &&
              getEvolutionCost(handCard) <= energy,
          ),
      )
      .map((card) => card.id),
  );
}

function getEvolvableHandIds(
  hand: Card[],
  board: Card[],
  energy: number,
  turnNumber: number,
) {
  return new Set(
    hand
      .filter(
        (handCard) =>
          handCard.evolutionStage > 0 &&
          getEvolutionCost(handCard) <= energy &&
          board.some(
            (boardCard) =>
              boardCard.enteredTurn !== turnNumber &&
              handCard.evolvesFromSpeciesId === boardCard.speciesId,
          ),
      )
      .map((card) => card.id),
  );
}

export function GamePage() {
  const {
    status,
    currentTurn,
    player,
    ai,
    winner,
    log,
    aiProcessing,
    selectedAttackerId,
    selectedEvolutionBaseId,
    turnNumber,
    recentPlayedCardId,
    recentEvolvedCardId,
    recentAttackSourceId,
    recentAttackTargetId,
    playCard,
    evolveCard,
    selectAttacker,
    selectEvolutionBase,
    attackTarget,
    attackHero,
    endTurn,
    restartGame,
    runAiTurn,
  } = useGameStore();

  useEffect(() => {
    if (status === "playing" && currentTurn === "ai" && !aiProcessing && !winner) {
      void runAiTurn();
    }
  }, [aiProcessing, currentTurn, runAiTurn, status, winner]);

  const playableHandIds = useMemo(
    () => getPlayableHandIds(player.hand, player.board.length, player.hasPlayedCardThisTurn),
    [player.board.length, player.hand, player.hasPlayedCardThisTurn],
  );
  const evolvableBoardIds = useMemo(
    () => getEvolvableBoardIds(player.board, player.hand, player.energy, turnNumber),
    [player.board, player.energy, player.hand, turnNumber],
  );
  const evolvableHandIds = useMemo(
    () => getEvolvableHandIds(player.hand, player.board, player.energy, turnNumber),
    [player.board, player.energy, player.hand, turnNumber],
  );
  const attackableBoardIds = useMemo(
    () =>
      new Set(
        player.board
          .filter((card) => card.canAttack && getAttackCost(card) <= player.energy)
          .map((card) => card.id),
      ),
    [player.board, player.energy],
  );
  const enemyTargetIds = useMemo(
    () => (selectedAttackerId ? new Set(ai.board.map((card) => card.id)) : new Set<string>()),
    [ai.board, selectedAttackerId],
  );
  const selectedAttacker = player.board.find((card) => card.id === selectedAttackerId);
  const enemyMatchupHighlightMap = useMemo(() => {
    if (!selectedAttacker) {
      return {};
    }

    return ai.board.reduce<Record<string, "advantage" | "neutral" | "disadvantage">>(
      (accumulator, enemyCard) => {
        accumulator[enemyCard.id] = getMatchupKind(selectedAttacker.types, enemyCard.types);
        return accumulator;
      },
      {},
    );
  }, [ai.board, selectedAttacker]);
  const recentPlayedIds = useMemo(
    () => (recentPlayedCardId ? new Set([recentPlayedCardId]) : new Set<string>()),
    [recentPlayedCardId],
  );
  const recentEvolvedIds = useMemo(
    () => (recentEvolvedCardId ? new Set([recentEvolvedCardId]) : new Set<string>()),
    [recentEvolvedCardId],
  );
  const recentAttackSourceIds = useMemo(
    () => (recentAttackSourceId ? new Set([recentAttackSourceId]) : new Set<string>()),
    [recentAttackSourceId],
  );
  const recentAttackTargetIds = useMemo(
    () => (recentAttackTargetId ? new Set([recentAttackTargetId]) : new Set<string>()),
    [recentAttackTargetId],
  );

  const handlePlayerBoardClick = (card: Card) => {
    if (evolvableBoardIds.has(card.id)) {
      selectEvolutionBase(card.id);
    }

    if (card.canAttack && getAttackCost(card) <= player.energy) {
      selectAttacker(card.id);
    }
  };

  const handleHandClick = (card: Card) => {
    if (card.evolutionStage === 0) {
      playCard(card.id);
      return;
    }

    if (selectedEvolutionBaseId) {
      evolveCard(selectedEvolutionBaseId, card.id);
      return;
    }

    const fallbackBase = player.board.find(
      (boardCard) =>
        boardCard.enteredTurn !== turnNumber &&
        boardCard.speciesId === card.evolvesFromSpeciesId &&
        getEvolutionCost(card) <= player.energy,
    );

    if (fallbackBase) {
      evolveCard(fallbackBase.id, card.id);
    }
  };

  const canAttackHero = Boolean(
    selectedAttackerId &&
      selectedAttacker &&
      getAttackCost(selectedAttacker) <= player.energy &&
      ai.board.length === 0,
  );

  return (
    <main className={styles.page}>
      <section className={styles.topBar}>
        <div>
          <h1>Pokemon Card Battler</h1>
          <p>
            Turn: <strong>{currentTurn.toUpperCase()}</strong> | Energy:{" "}
            <strong>{player.energy}/{player.maxEnergy}</strong>
          </p>
          <p className={styles.turnMeta}>
            Free deploy: <strong>{player.hasPlayedCardThisTurn ? "used" : "ready"}</strong>
          </p>
        </div>
        <div className={styles.topActions}>
          {canAttackHero ? (
            <button className={styles.heroAttack} onClick={attackHero} type="button">
              Attack Hero
            </button>
          ) : null}
          <button
            className={styles.endTurn}
            disabled={currentTurn !== "player" || status !== "playing" || !!winner}
            onClick={endTurn}
            type="button"
          >
            End Turn
          </button>
          <button className={styles.restart} onClick={() => void restartGame()} type="button">
            Restart
          </button>
        </div>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Hero
            active={currentTurn === "ai" && !winner}
            hero={ai.hero}
            label="AI Hero"
            energy={ai.energy}
            maxEnergy={ai.maxEnergy}
          />
          <Board
            attackingIds={recentAttackSourceIds}
            cards={ai.board}
            enteringIds={recentPlayedIds}
            evolvingIds={recentEvolvedIds}
            highlightedIds={enemyTargetIds}
            matchupHighlightMap={enemyMatchupHighlightMap}
            onCardClick={(card) => attackTarget(card.id)}
            takingHitIds={recentAttackTargetIds}
            title="AI Board"
          />
          <div className={styles.battleZone}>
            <div>
              <strong>Battlefield</strong>
              <p>
                One Basic Pokemon can be deployed for free each turn. Energy is now spent on attacks and evolutions.
              </p>
              {selectedAttacker ? (
                <p className={styles.matchupHint}>
                  Target colors: <span className={styles.good}>green</span> strong,{" "}
                  <span className={styles.neutral}>gold</span> neutral,{" "}
                  <span className={styles.bad}>red</span> weak.
                </p>
              ) : null}
            </div>
            {winner ? (
              <div className={styles.winner}>
                {winner === "player" ? "You Win!" : "AI Wins"}
              </div>
            ) : (
              <div className={`${styles.statusPill} ${aiProcessing ? styles.thinking : ""}`}>
                {currentTurn === "player" ? "Your turn" : aiProcessing ? "AI is thinking..." : "AI turn"}
              </div>
            )}
          </div>
          <Board
            attackableIds={attackableBoardIds}
            attackingIds={recentAttackSourceIds}
            cards={player.board}
            evolvableIds={evolvableBoardIds}
            enteringIds={recentPlayedIds}
            evolvingIds={recentEvolvedIds}
            onCardClick={handlePlayerBoardClick}
            selectedAttackerId={selectedAttackerId}
            selectedEvolutionBaseId={selectedEvolutionBaseId}
            takingHitIds={recentAttackTargetIds}
            title="Player Board"
          />
          <Hero
            active={currentTurn === "player" && !winner}
            hero={player.hero}
            label="Player Hero"
            energy={player.energy}
            maxEnergy={player.maxEnergy}
          />
          <Hand
            cards={player.hand}
            disabledIds={new Set(
              player.hand
                .filter(
                  (card) =>
                    !playableHandIds.has(card.id) &&
                    !evolvableHandIds.has(card.id),
                )
                .map((card) => card.id),
            )}
            evolvableIds={evolvableHandIds}
            onCardClick={handleHandClick}
            playableIds={playableHandIds}
          />
        </div>

        <GameLog entries={log} />
      </div>
    </main>
  );
}
