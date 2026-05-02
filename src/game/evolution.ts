import {
  getCachedValue,
  getEvolutionChain as fetchEvolutionChain,
  getPokemonSpecies as fetchPokemonSpecies,
  setCachedValue,
} from "../api/pokeApi";
import type { EvolutionInfo, EvolutionMap } from "./types";

const EVOLUTION_CACHE_KEY = "evolution-map-v3";
const MAX_POKEMON_ID = 151;

export const getPokemonSpecies = fetchPokemonSpecies;
export const getEvolutionChain = fetchEvolutionChain;

type EvolutionChainNode = {
  species: { name: string; url: string };
  evolves_to: EvolutionChainNode[];
};

function parseSpeciesId(url: string) {
  const id = Number(url.split("/").filter(Boolean).at(-1));
  return Number.isNaN(id) ? 0 : id;
}

function isValidEvolutionMap(value: EvolutionMap | null): value is EvolutionMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bulbasaur = value[1];
  const pikachu = value[25];

  return Boolean(
    bulbasaur &&
      bulbasaur.speciesId === 1 &&
      Array.isArray(bulbasaur.evolvesToSpeciesIds) &&
      pikachu &&
      pikachu.speciesId === 25 &&
      Array.isArray(pikachu.evolvesToSpeciesIds),
  );
}

function walkChain(
  node: EvolutionChainNode,
  stage: 0 | 1 | 2,
  evolvesFromSpeciesId: number | undefined,
  evolutionMap: EvolutionMap,
) {
  const speciesId = parseSpeciesId(node.species.url);
  const evolvesToSpeciesIds = node.evolves_to
    .map((entry) => parseSpeciesId(entry.species.url))
    .filter((nextSpeciesId) => nextSpeciesId <= MAX_POKEMON_ID);

  if (speciesId <= MAX_POKEMON_ID) {
    evolutionMap[speciesId] = {
      speciesId,
      name: node.species.name,
      stage,
      evolvesFromSpeciesId:
        evolvesFromSpeciesId && evolvesFromSpeciesId <= MAX_POKEMON_ID
          ? evolvesFromSpeciesId
          : undefined,
      evolvesToSpeciesIds,
    };
  }

  for (const child of node.evolves_to) {
    walkChain(
      child,
      Math.min(2, stage + 1) as 0 | 1 | 2,
      speciesId,
      evolutionMap,
    );
  }
}

export async function buildEvolutionMap(): Promise<EvolutionMap> {
  const cached = getCachedValue<EvolutionMap>(EVOLUTION_CACHE_KEY);

  if (isValidEvolutionMap(cached)) {
    return cached;
  }

  const speciesResponses = await Promise.all(
    Array.from({ length: MAX_POKEMON_ID }, (_, index) => getPokemonSpecies(index + 1)),
  );

  const uniqueChainUrls = [...new Set(speciesResponses.map((species) => species.evolution_chain.url))];
  const chains = await Promise.all(uniqueChainUrls.map((url) => getEvolutionChain(url)));

  const evolutionMap: EvolutionMap = {};

  for (const chain of chains) {
    walkChain(chain.chain, 0, undefined, evolutionMap);
  }

  setCachedValue(EVOLUTION_CACHE_KEY, evolutionMap);
  return evolutionMap;
}
