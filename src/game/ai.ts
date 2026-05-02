import { getAttackCost, getEvolutionCost } from "./rules";
import type { Card, PlayerState } from "./types";

export function findBestEvolution(player: PlayerState) {
  const candidates = player.hand
    .filter((card) => card.evolutionStage > 0)
    .flatMap((evolutionCard) =>
      player.board
        .filter((boardCard) => boardCard.speciesId === evolutionCard.evolvesFromSpeciesId)
        .map((boardCard) => ({
          baseBoardCardId: boardCard.id,
          evolutionHandCardId: evolutionCard.id,
          score: evolutionCard.cost * 10 + evolutionCard.attack + evolutionCard.hp,
          cost: getEvolutionCost(evolutionCard),
          boardCard,
        })),
    )
    .filter((candidate) => candidate.boardCard.enteredTurn !== undefined)
    .sort((left, right) => right.score - left.score);

  return candidates.find((candidate) => candidate.cost <= player.energy);
}

export function getPlayableCardsSorted(player: PlayerState) {
  return [...player.hand]
    .filter((card) => card.evolutionStage === 0)
    .sort((left, right) => right.cost - left.cost || right.attack - left.attack);
}

export function getReadyAttackers(player: PlayerState) {
  return [...player.board]
    .filter((card) => card.canAttack && getAttackCost(card) <= player.energy)
    .sort((left, right) => right.attack - left.attack || right.speed - left.speed);
}

export function getWeakestBoardTarget(board: Card[]) {
  return [...board].sort(
    (left, right) =>
      (left.currentHp ?? left.hp) - (right.currentHp ?? right.hp) || left.defense - right.defense,
  )[0];
}
