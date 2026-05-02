import { getCachedValue, getPokemon, getPokemonList, setCachedValue } from "../api/pokeApi";
import type { Card, CardCatalog, CardTemplate, EvolutionMap } from "./types";
import { buildEvolutionMap } from "./evolution";

const CARD_CATALOG_CACHE_KEY = "card-catalog-v3";

const PLAYER_ROOTS = [1, 4, 7, 16, 43, 60];
const AI_ROOTS = [10, 13, 29, 32, 66, 69];

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function extractStat(stats: Awaited<ReturnType<typeof getPokemon>>["stats"], statName: string) {
  return stats.find((stat) => stat.stat.name === statName)?.base_stat ?? 0;
}

function buildCardTemplate(
  pokemon: Awaited<ReturnType<typeof getPokemon>>,
  evolutionMap: EvolutionMap,
): CardTemplate {
  const baseHp = extractStat(pokemon.stats, "hp");
  const baseAttack = extractStat(pokemon.stats, "attack");
  const baseDefense = extractStat(pokemon.stats, "defense");
  const baseSpeed = extractStat(pokemon.stats, "speed");
  const evolutionInfo = evolutionMap[pokemon.id];

  const hp = Math.round(baseHp / 3) + 5;
  const attack = Math.round(baseAttack / 6) + 1;
  const defense = Math.round(baseDefense / 10);
  const cost = Math.min(10, Math.max(1, Math.round((hp + attack + defense) / 6)));

  return {
    pokemonId: pokemon.id,
    speciesId: pokemon.id,
    name: pokemon.name,
    image:
      pokemon.sprites.other?.["official-artwork"]?.front_default ??
      pokemon.sprites.front_default ??
      "",
    types: pokemon.types
      .sort((left, right) => left.slot - right.slot)
      .map((entry) => entry.type.name),
    hp,
    attack,
    defense,
    speed: baseSpeed,
    cost,
    evolutionStage: evolutionInfo?.stage ?? 0,
    evolvesFromSpeciesId: evolutionInfo?.evolvesFromSpeciesId,
    evolvesToSpeciesIds: evolutionInfo?.evolvesToSpeciesIds ?? [],
  };
}

function collectFamilySpeciesIds(
  rootSpeciesId: number,
  evolutionMap: EvolutionMap,
  visited = new Set<number>(),
): number[] {
  if (visited.has(rootSpeciesId)) {
    return [];
  }

  visited.add(rootSpeciesId);

  const nextSpeciesIds = evolutionMap[rootSpeciesId]?.evolvesToSpeciesIds ?? [];
  const descendants: number[] = nextSpeciesIds.flatMap((speciesId) =>
    collectFamilySpeciesIds(speciesId, evolutionMap, visited),
  );

  return [rootSpeciesId, ...descendants];
}

function instantiateCard(template: CardTemplate, copyIndex: number): Card {
  return {
    ...template,
    id: `${template.speciesId}-${copyIndex}-${Math.random().toString(36).slice(2, 8)}`,
    currentHp: template.hp,
    canAttack: false,
  };
}

function buildDeckFromRoots(
  roots: number[],
  catalog: CardCatalog,
  evolutionMap: EvolutionMap,
): Card[] {
  const speciesIds = roots.flatMap((root) => collectFamilySpeciesIds(root, evolutionMap));
  const duplicates = roots;
  const finalSpeciesIds = [...speciesIds, ...duplicates].slice(0, 24);

  return shuffle(
    finalSpeciesIds.map((speciesId, index) => {
      const template = catalog[speciesId];

      if (!template) {
        throw new Error(`Missing card template for species ${speciesId}`);
      }

      return instantiateCard(template, index);
    }),
  );
}

function isValidCardTemplate(template: CardTemplate | undefined) {
  return Boolean(
    template &&
      typeof template.speciesId === "number" &&
      typeof template.pokemonId === "number" &&
      typeof template.name === "string" &&
      typeof template.hp === "number" &&
      typeof template.attack === "number" &&
      typeof template.defense === "number" &&
      Array.isArray(template.types) &&
      Array.isArray(template.evolvesToSpeciesIds),
  );
}

function isValidCardCatalog(catalog: CardCatalog | null): catalog is CardCatalog {
  if (!catalog || typeof catalog !== "object") {
    return false;
  }

  return isValidCardTemplate(catalog[1]) && isValidCardTemplate(catalog[25]) && isValidCardTemplate(catalog[150]);
}

export async function loadCardCatalog() {
  const cachedCatalog = getCachedValue<CardCatalog>(CARD_CATALOG_CACHE_KEY);
  const cachedEvolutionMap = getCachedValue<EvolutionMap>("evolution-map-v3");

  if (isValidCardCatalog(cachedCatalog) && cachedEvolutionMap) {
    return {
      catalog: cachedCatalog,
      evolutionMap: cachedEvolutionMap,
    };
  }

  await getPokemonList(151);
  const evolutionMap = await buildEvolutionMap();
  const pokemonResponses = await Promise.all(
    Array.from({ length: 151 }, (_, index) => getPokemon(index + 1)),
  );

  const catalog = pokemonResponses.reduce<CardCatalog>((accumulator, pokemon) => {
    accumulator[pokemon.id] = buildCardTemplate(pokemon, evolutionMap);
    return accumulator;
  }, {});

  setCachedValue(CARD_CATALOG_CACHE_KEY, catalog);

  return {
    catalog,
    evolutionMap,
  };
}

export function buildInitialDecks(catalog: CardCatalog, evolutionMap: EvolutionMap) {
  return {
    playerDeck: buildDeckFromRoots(PLAYER_ROOTS, catalog, evolutionMap),
    aiDeck: buildDeckFromRoots(AI_ROOTS, catalog, evolutionMap),
  };
}
