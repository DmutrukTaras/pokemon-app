export type Hero = {
  hp: number;
  maxHp: number;
};

export type EvolutionStage = 0 | 1 | 2;
export type PlayerSide = "player" | "ai";
export type GameStatus = "menu" | "loading" | "playing" | "gameOver";

export type Card = {
  id: string;
  pokemonId: number;
  speciesId: number;
  name: string;
  image: string;
  types: string[];
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  cost: number;
  currentHp?: number;
  canAttack?: boolean;
  evolutionStage: EvolutionStage;
  evolvesFromSpeciesId?: number;
  evolvesToSpeciesIds: number[];
  enteredTurn?: number;
};

export type EvolutionInfo = {
  speciesId: number;
  name: string;
  stage: EvolutionStage;
  evolvesFromSpeciesId?: number;
  evolvesToSpeciesIds: number[];
};

export type PlayerState = {
  hero: Hero;
  deck: Card[];
  hand: Card[];
  board: Card[];
  discardPile: Card[];
  energy: number;
  maxEnergy: number;
  hasPlayedCardThisTurn: boolean;
};

export type GameState = {
  status: GameStatus;
  currentTurn: PlayerSide;
  player: PlayerState;
  ai: PlayerState;
  selectedAttackerId: string | null;
  selectedEvolutionBaseId: string | null;
  winner: PlayerSide | null;
  log: string[];
};

export type CardTemplate = Omit<Card, "id" | "currentHp" | "canAttack" | "enteredTurn">;
export type EvolutionMap = Record<number, EvolutionInfo>;
export type CardCatalog = Record<number, CardTemplate>;
