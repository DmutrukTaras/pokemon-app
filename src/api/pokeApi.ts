const API_BASE = "https://pokeapi.co/api/v2";
const STORAGE_PREFIX = "pokemon-card-battler";
const memoryCache = new Map<string, unknown>();
let persistentCacheEnabled = true;
let legacyCachePruned = false;

type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

type FetchCacheOptions = {
  persist?: boolean;
};

type NamedResource = {
  name: string;
  url: string;
};

export type PokemonListResponse = {
  results: NamedResource[];
};

export type PokemonResponse = {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    other?: {
      ["official-artwork"]?: {
        front_default: string | null;
      };
    };
  };
  stats: Array<{
    base_stat: number;
    stat: NamedResource;
  }>;
  types: Array<{
    slot: number;
    type: NamedResource;
  }>;
  species: NamedResource;
};

export type PokemonSpeciesResponse = {
  id: number;
  name: string;
  evolves_from_species: NamedResource | null;
  evolution_chain: {
    url: string;
  };
};

export type EvolutionChainResponse = {
  chain: {
    species: NamedResource;
    evolves_to: EvolutionChainResponse["chain"][];
  };
};

function storageKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`;
}

function isQuotaExceeded(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function pruneLegacyResourceCache() {
  if (legacyCachePruned) {
    return;
  }

  legacyCachePruned = true;

  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key || !key.startsWith(`${STORAGE_PREFIX}:`)) {
        continue;
      }

      const cacheKey = key.slice(`${STORAGE_PREFIX}:`.length);
      const isLegacyResourceEntry =
        cacheKey.startsWith("pokemon-") ||
        cacheKey.startsWith("pokemon-species-") ||
        cacheKey.startsWith("evolution-chain-") ||
        cacheKey.startsWith("pokemon-list-");

      if (isLegacyResourceEntry) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    persistentCacheEnabled = false;
  }
}

function readLocalStorage<T>(key: string): T | null {
  if (!persistentCacheEnabled) {
    return null;
  }

  let cached: string | null = null;

  try {
    cached = localStorage.getItem(storageKey(key));
  } catch {
    persistentCacheEnabled = false;
    return null;
  }

  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as CacheEntry<T>;
    memoryCache.set(key, parsed.value);
    return parsed.value;
  } catch {
    localStorage.removeItem(storageKey(key));
    return null;
  }
}

function writeLocalStorage<T>(key: string, value: T) {
  memoryCache.set(key, value);

  if (!persistentCacheEnabled) {
    return;
  }

  const entry: CacheEntry<T> = {
    value,
    cachedAt: Date.now(),
  };

  const serialized = JSON.stringify(entry);

  try {
    localStorage.setItem(storageKey(key), serialized);
  } catch (error) {
    if (isQuotaExceeded(error)) {
      pruneLegacyResourceCache();

      try {
        localStorage.setItem(storageKey(key), serialized);
        return;
      } catch {
        persistentCacheEnabled = false;
        return;
      }
    }

    persistentCacheEnabled = false;
  }
}

async function fetchCachedJson<T>(
  key: string,
  url: string,
  options: FetchCacheOptions = {},
): Promise<T> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  const stored = options.persist ? readLocalStorage<T>(key) : null;

  if (stored) {
    return stored;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const data = (await response.json()) as T;

  if (options.persist) {
    writeLocalStorage(key, data);
  } else {
    memoryCache.set(key, data);
  }

  return data;
}

export function getPokemonList(limit = 151) {
  return fetchCachedJson<PokemonListResponse>(
    `pokemon-list-${limit}`,
    `${API_BASE}/pokemon?limit=${limit}`,
  );
}

export function getPokemon(id: number) {
  return fetchCachedJson<PokemonResponse>(
    `pokemon-${id}`,
    `${API_BASE}/pokemon/${id}`,
  );
}

export function getPokemonSpecies(id: number) {
  return fetchCachedJson<PokemonSpeciesResponse>(
    `pokemon-species-${id}`,
    `${API_BASE}/pokemon-species/${id}`,
  );
}

export function getEvolutionChain(chainUrl: string) {
  const chainId = chainUrl.split("/").filter(Boolean).at(-1) ?? chainUrl;
  return fetchCachedJson<EvolutionChainResponse>(
    `evolution-chain-${chainId}`,
    chainUrl,
  );
}

export function getCachedValue<T>(key: string): T | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  return readLocalStorage<T>(key);
}

export function setCachedValue<T>(key: string, value: T) {
  writeLocalStorage(key, value);
}
