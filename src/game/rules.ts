import type { Card } from "./types";

export type MatchupKind = "advantage" | "neutral" | "disadvantage";

export const typeAdvantages: Record<string, string[]> = {
  fire: ["grass", "bug", "ice", "steel"],
  water: ["fire", "rock", "ground"],
  grass: ["water", "rock", "ground"],
  electric: ["water", "flying"],
  psychic: ["fighting", "poison"],
  fighting: ["normal", "rock", "steel", "ice", "dark"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  rock: ["fire", "ice", "flying", "bug"],
  ice: ["grass", "ground", "flying", "dragon"],
  dragon: ["dragon"],
  dark: ["psychic", "ghost"],
  ghost: ["psychic", "ghost"],
  fairy: ["dragon", "fighting", "dark"],
};

export function getTypeMultiplier(attackerTypes: string[], targetTypes: string[]) {
  const hasAdvantage = attackerTypes.some((attackerType) =>
    targetTypes.some((targetType) =>
      (typeAdvantages[attackerType] ?? []).includes(targetType),
    ),
  );

  const hasDisadvantage = targetTypes.some((targetType) =>
    attackerTypes.some((attackerType) =>
      (typeAdvantages[targetType] ?? []).includes(attackerType),
    ),
  );

  let multiplier = 1;

  if (hasAdvantage) {
    multiplier *= 1.5;
  }

  if (hasDisadvantage) {
    multiplier /= 1.5;
  }

  return multiplier;
}

export function getMatchupKind(attackerTypes: string[], targetTypes: string[]): MatchupKind {
  const multiplier = getTypeMultiplier(attackerTypes, targetTypes);

  if (multiplier > 1) {
    return "advantage";
  }

  if (multiplier < 1) {
    return "disadvantage";
  }

  return "neutral";
}

function applyTypeMultiplier(baseDamage: number, multiplier: number) {
  if (multiplier >= 1) {
    return Math.max(1, Math.ceil(baseDamage * multiplier));
  }

  return Math.max(1, Math.floor(baseDamage * multiplier));
}

export function calculateBoardDamage(attacker: Card, target: Card) {
  const baseDamage = Math.max(
    1,
    attacker.attack - Math.floor(target.defense / 2),
  );

  return applyTypeMultiplier(
    baseDamage,
    getTypeMultiplier(attacker.types, target.types),
  );
}

export function calculateCounterDamage(attacker: Card, target: Card) {
  const baseDamage = Math.max(1, target.attack - Math.floor(attacker.defense / 2));

  return applyTypeMultiplier(
    baseDamage,
    getTypeMultiplier(target.types, attacker.types),
  );
}

export function calculateHeroDamage(attacker: Card) {
  return Math.max(1, attacker.attack);
}

export function getAttackCost(card: Card) {
  return Math.max(1, Math.ceil(card.cost / 2));
}

export function getEvolutionCost(card: Card) {
  return Math.max(1, card.cost - 1);
}
