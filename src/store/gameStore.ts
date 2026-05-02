import { create } from "zustand";
import { buildInitialDecks, loadCardCatalog } from "../game/deck";
import { findBestEvolution, getPlayableCardsSorted, getReadyAttackers, getWeakestBoardTarget } from "../game/ai";
import { calculateBoardDamage, calculateCounterDamage, calculateHeroDamage, getAttackCost, getEvolutionCost } from "../game/rules";
import type { Card, CardCatalog, EvolutionMap, GameState, PlayerSide, PlayerState } from "../game/types";

type StoreState = GameState & {
  turnNumber: number;
  aiProcessing: boolean;
  loadingMessage: string;
  errorMessage: string | null;
  catalog: CardCatalog | null;
  evolutionMap: EvolutionMap | null;
  recentPlayedCardId: string | null;
  recentEvolvedCardId: string | null;
  recentAttackSourceId: string | null;
  recentAttackTargetId: string | null;
  startGame: () => Promise<void>;
  drawCard: () => void;
  playCard: (cardId: string) => void;
  evolveCard: (baseBoardCardId: string, evolutionHandCardId: string) => void;
  selectAttacker: (cardId: string | null) => void;
  selectEvolutionBase: (cardId: string | null) => void;
  attackTarget: (targetId: string) => void;
  attackHero: () => void;
  endTurn: () => void;
  runAiTurn: () => Promise<void>;
  restartGame: () => Promise<void>;
};

const MAX_BOARD_SIZE = 5;
const MAX_HAND_SIZE = 10;
const MAX_LOG_ENTRIES = 14;

const INITIAL_HERO = {
  hp: 30,
  maxHp: 30,
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const randomDelay = () => 500 + Math.floor(Math.random() * 301);

function createEmptyPlayerState(): PlayerState {
  return {
    hero: { ...INITIAL_HERO },
    deck: [],
    hand: [],
    board: [],
    discardPile: [],
    energy: 0,
    maxEnergy: 0,
    hasPlayedCardThisTurn: false,
  };
}

function createInitialState(): Omit<
  StoreState,
  | "startGame"
  | "drawCard"
  | "playCard"
  | "evolveCard"
  | "selectAttacker"
  | "selectEvolutionBase"
  | "attackTarget"
  | "attackHero"
  | "endTurn"
  | "runAiTurn"
  | "restartGame"
> {
  return {
    status: "menu",
    currentTurn: "player",
    player: createEmptyPlayerState(),
    ai: createEmptyPlayerState(),
    selectedAttackerId: null,
    selectedEvolutionBaseId: null,
    winner: null,
    log: [],
    turnNumber: 0,
    aiProcessing: false,
    loadingMessage: "",
    errorMessage: null,
    catalog: null,
    evolutionMap: null,
    recentPlayedCardId: null,
    recentEvolvedCardId: null,
    recentAttackSourceId: null,
    recentAttackTargetId: null,
  };
}

function capLog(log: string[]) {
  return log.slice(-MAX_LOG_ENTRIES);
}

function addLog(state: StoreState, message: string): StoreState {
  return {
    ...state,
    log: capLog([...state.log, message]),
  };
}

function getSideState(state: StoreState, side: PlayerSide) {
  return state[side];
}

function setSideState(state: StoreState, side: PlayerSide, playerState: PlayerState): StoreState {
  return {
    ...state,
    [side]: playerState,
  };
}

function removeHandCard(player: PlayerState, cardId: string) {
  return player.hand.filter((card) => card.id !== cardId);
}

function drawOneCard(state: StoreState, side: PlayerSide): StoreState {
  const playerState = getSideState(state, side);

  if (playerState.deck.length === 0) {
    return addLog(state, `${side === "player" ? "You" : "AI"} tried to draw a card, but the deck was empty.`);
  }

  const [drawnCard, ...remainingDeck] = playerState.deck;

  if (playerState.hand.length >= MAX_HAND_SIZE) {
    const updatedPlayer: PlayerState = {
      ...playerState,
      deck: remainingDeck,
      discardPile: [...playerState.discardPile, drawnCard],
    };

    return addLog(
      setSideState(state, side, updatedPlayer),
      `${side === "player" ? "You" : "AI"} burned ${drawnCard.name} because the hand was full.`,
    );
  }

  const updatedPlayer: PlayerState = {
    ...playerState,
    deck: remainingDeck,
    hand: [...playerState.hand, drawnCard],
  };

  return addLog(
    setSideState(state, side, updatedPlayer),
    `${side === "player" ? "You drew" : "AI drew"} ${drawnCard.name}.`,
  );
}

function drawOpeningHand(player: PlayerState, cards: number) {
  let nextPlayer = { ...player };

  for (let index = 0; index < cards; index += 1) {
    if (nextPlayer.deck.length === 0 || nextPlayer.hand.length >= MAX_HAND_SIZE) {
      break;
    }

    const [card, ...remainingDeck] = nextPlayer.deck;
    nextPlayer = {
      ...nextPlayer,
      deck: remainingDeck,
      hand: [...nextPlayer.hand, card],
    };
  }

  return nextPlayer;
}

function beginTurn(state: StoreState, side: PlayerSide) {
  const playerState = getSideState(state, side);
  const nextTurnNumber = state.turnNumber + 1;
  const maxEnergy = Math.min(10, playerState.maxEnergy + 1);

  const updatedPlayer: PlayerState = {
    ...playerState,
    maxEnergy,
    energy: maxEnergy,
    hasPlayedCardThisTurn: false,
    board: playerState.board.map((card) => ({
      ...card,
      canAttack: true,
    })),
  };

  const withTurn = {
    ...state,
    turnNumber: nextTurnNumber,
    currentTurn: side,
    selectedAttackerId: null,
    selectedEvolutionBaseId: null,
    recentPlayedCardId: null,
    recentEvolvedCardId: null,
    recentAttackSourceId: null,
    recentAttackTargetId: null,
    [side]: updatedPlayer,
  } satisfies StoreState;

  const withEnergyLog = addLog(
    withTurn,
    `${side === "player" ? "Your" : "AI"} turn ${nextTurnNumber}: ${maxEnergy} energy ready.`,
  );

  return drawOneCard(withEnergyLog, side);
}

function ensureAliveOrSetWinner(state: StoreState): StoreState {
  if (state.ai.hero.hp <= 0) {
    return {
      ...state,
      status: "gameOver",
      winner: "player",
      selectedAttackerId: null,
      selectedEvolutionBaseId: null,
      aiProcessing: false,
      log: capLog([...state.log, "You win the battle!"]),
    };
  }

  if (state.player.hero.hp <= 0) {
    return {
      ...state,
      status: "gameOver",
      winner: "ai",
      selectedAttackerId: null,
      selectedEvolutionBaseId: null,
      aiProcessing: false,
      log: capLog([...state.log, "AI wins the battle."]),
    };
  }

  return state;
}

function playCardForSide(state: StoreState, side: PlayerSide, cardId: string): StoreState {
  const playerState = getSideState(state, side);
  const card = playerState.hand.find((entry) => entry.id === cardId);

  if (!card || card.evolutionStage !== 0) {
    return state;
  }

  if (playerState.board.length >= MAX_BOARD_SIZE || playerState.hasPlayedCardThisTurn) {
    return state;
  }

  const updatedCard: Card = {
    ...card,
    currentHp: card.hp,
    canAttack: false,
    enteredTurn: state.turnNumber,
  };

  const updatedPlayer: PlayerState = {
    ...playerState,
    hasPlayedCardThisTurn: true,
    hand: removeHandCard(playerState, cardId),
    board: [...playerState.board, updatedCard],
  };

  return addLog({
    ...setSideState(state, side, updatedPlayer),
    recentPlayedCardId: card.id,
    recentEvolvedCardId: null,
    recentAttackSourceId: null,
    recentAttackTargetId: null,
  }, `${side === "player" ? "You deployed" : "AI deployed"} ${card.name} for free.`);
}

function evolveCardForSide(
  state: StoreState,
  side: PlayerSide,
  baseBoardCardId: string,
  evolutionHandCardId: string,
): StoreState {
  const playerState = getSideState(state, side);
  const baseCard = playerState.board.find((card) => card.id === baseBoardCardId);
  const evolutionCard = playerState.hand.find((card) => card.id === evolutionHandCardId);

  if (!baseCard || !evolutionCard || baseCard.enteredTurn === state.turnNumber) {
    return state;
  }

  const evolutionCost = getEvolutionCost(evolutionCard);

  if (
    evolutionCard.evolvesFromSpeciesId !== baseCard.speciesId ||
    playerState.energy < evolutionCost
  ) {
    return state;
  }

  const nextCurrentHp = Math.min(
    evolutionCard.hp,
    (baseCard.currentHp ?? baseCard.hp) + (evolutionCard.hp - baseCard.hp),
  );

  const updatedBoard = playerState.board.map((card) =>
    card.id === baseBoardCardId
      ? {
          ...evolutionCard,
          id: card.id,
          currentHp: nextCurrentHp,
          canAttack: baseCard.canAttack,
          enteredTurn: baseCard.enteredTurn,
        }
      : card,
  );

  const updatedPlayer: PlayerState = {
    ...playerState,
    energy: playerState.energy - evolutionCost,
    hand: removeHandCard(playerState, evolutionHandCardId),
    board: updatedBoard,
  };

  return addLog({
    ...setSideState(state, side, updatedPlayer),
    recentPlayedCardId: null,
    recentEvolvedCardId: baseBoardCardId,
    recentAttackSourceId: null,
    recentAttackTargetId: null,
  }, `${side === "player" ? "You evolved" : "AI evolved"} ${baseCard.name} into ${evolutionCard.name} for ${evolutionCost} energy.`);
}

function moveFaintedCards(player: PlayerState, faintedIds: Set<string>) {
  const survivingBoard = player.board.filter((card) => !faintedIds.has(card.id));
  const fainted = player.board
    .filter((card) => faintedIds.has(card.id))
    .map((card) => ({ ...card, currentHp: 0, canAttack: false }));

  return {
    ...player,
    board: survivingBoard,
    discardPile: [...player.discardPile, ...fainted],
  };
}

function attackBoardWithSide(
  state: StoreState,
  attackerSide: PlayerSide,
  attackerId: string,
  targetId: string,
): StoreState {
  const defenderSide: PlayerSide = attackerSide === "player" ? "ai" : "player";
  const attackerState = getSideState(state, attackerSide);
  const defenderState = getSideState(state, defenderSide);
  const attacker = attackerState.board.find((card) => card.id === attackerId);
  const target = defenderState.board.find((card) => card.id === targetId);

  if (!attacker || !target || !attacker.canAttack) {
    return state;
  }

  const damage = calculateBoardDamage(attacker, target);
  const counterDamage = calculateCounterDamage(attacker, target);
  const attackCost = getAttackCost(attacker);

  if (attackerState.energy < attackCost) {
    return state;
  }

  const updatedAttackerBoard = attackerState.board.map((card) =>
    card.id === attackerId
      ? {
          ...card,
          currentHp: (card.currentHp ?? card.hp) - counterDamage,
          canAttack: false,
        }
      : card,
  );

  const updatedDefenderBoard = defenderState.board.map((card) =>
    card.id === targetId
      ? {
          ...card,
          currentHp: (card.currentHp ?? card.hp) - damage,
        }
      : card,
  );

  let nextState: StoreState = {
    ...state,
    [attackerSide]: {
      ...attackerState,
      energy: attackerState.energy - attackCost,
      board: updatedAttackerBoard,
    },
    [defenderSide]: {
      ...defenderState,
      board: updatedDefenderBoard,
    },
    selectedAttackerId: attackerSide === "player" ? null : state.selectedAttackerId,
    recentPlayedCardId: null,
    recentEvolvedCardId: null,
    recentAttackSourceId: attackerId,
    recentAttackTargetId: targetId,
  };

  nextState = addLog(
    nextState,
    `${attacker.name} spent ${attackCost} energy, hit ${target.name} for ${damage}, then took ${counterDamage} back.`,
  );

  const attackerFaintedIds = new Set(
    nextState[attackerSide].board
      .filter((card) => (card.currentHp ?? card.hp) <= 0)
      .map((card) => card.id),
  );
  const defenderFaintedIds = new Set(
    nextState[defenderSide].board
      .filter((card) => (card.currentHp ?? card.hp) <= 0)
      .map((card) => card.id),
  );

  if (attackerFaintedIds.size > 0) {
    nextState = setSideState(
      nextState,
      attackerSide,
      moveFaintedCards(nextState[attackerSide], attackerFaintedIds),
    );
  }

  if (defenderFaintedIds.size > 0) {
    nextState = setSideState(
      nextState,
      defenderSide,
      moveFaintedCards(nextState[defenderSide], defenderFaintedIds),
    );
  }

  if (attackerFaintedIds.size > 0 || defenderFaintedIds.size > 0) {
    const faintedNames = [
      ...[...attackerFaintedIds].map(
        (id) => attackerState.board.find((card) => card.id === id)?.name ?? "",
      ),
      ...[...defenderFaintedIds].map(
        (id) => defenderState.board.find((card) => card.id === id)?.name ?? "",
      ),
    ].filter(Boolean);

    nextState = addLog(nextState, `${faintedNames.join(" and ")} fainted.`);
  }

  return nextState;
}

function attackHeroWithSide(state: StoreState, attackerSide: PlayerSide, attackerId: string): StoreState {
  const defenderSide: PlayerSide = attackerSide === "player" ? "ai" : "player";
  const attackerState = getSideState(state, attackerSide);
  const defenderState = getSideState(state, defenderSide);
  const attacker = attackerState.board.find((card) => card.id === attackerId);

  if (!attacker || !attacker.canAttack || defenderState.board.length > 0) {
    return state;
  }

  const damage = calculateHeroDamage(attacker);
  const attackCost = getAttackCost(attacker);

  if (attackerState.energy < attackCost) {
    return state;
  }

  const updatedAttackerState: PlayerState = {
    ...attackerState,
    energy: attackerState.energy - attackCost,
    board: attackerState.board.map((card) =>
      card.id === attackerId
        ? {
            ...card,
            canAttack: false,
          }
        : card,
    ),
  };

  const updatedDefenderState: PlayerState = {
    ...defenderState,
    hero: {
      ...defenderState.hero,
      hp: Math.max(0, defenderState.hero.hp - damage),
    },
  };

  const nextState = addLog(
    {
      ...state,
      [attackerSide]: updatedAttackerState,
      [defenderSide]: updatedDefenderState,
      selectedAttackerId: attackerSide === "player" ? null : state.selectedAttackerId,
      recentPlayedCardId: null,
      recentEvolvedCardId: null,
      recentAttackSourceId: attackerId,
      recentAttackTargetId: null,
    } as StoreState,
    `${attacker.name} spent ${attackCost} energy and attacked the ${defenderSide === "player" ? "player" : "AI"} hero for ${damage}.`,
  );

  return ensureAliveOrSetWinner(nextState);
}

export const useGameStore = create<StoreState>((set, get) => ({
  ...createInitialState(),
  startGame: async () => {
    set({
      ...createInitialState(),
      status: "loading",
      loadingMessage: "Loading Pokemon, evolution chains, and decks...",
    });

    try {
      const { catalog, evolutionMap } = await loadCardCatalog();
      const { playerDeck, aiDeck } = buildInitialDecks(catalog, evolutionMap);

      let nextState: StoreState = {
        ...createInitialState(),
        status: "playing",
        currentTurn: "player",
        catalog,
        evolutionMap,
        player: drawOpeningHand(
          {
            ...createEmptyPlayerState(),
            deck: playerDeck,
          },
          4,
        ),
        ai: drawOpeningHand(
          {
            ...createEmptyPlayerState(),
            deck: aiDeck,
          },
          4,
        ),
        log: ["Battle started."],
      } as StoreState;

      nextState = beginTurn(nextState, "player");
      set(nextState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown loading error";
      set({
        ...createInitialState(),
        status: "menu",
        errorMessage: message,
      });
    }
  },
  restartGame: async () => {
    await get().startGame();
  },
  drawCard: () => {
    const state = get();

    if (state.status !== "playing") {
      return;
    }

    set(drawOneCard(state, state.currentTurn));
  },
  playCard: (cardId) => {
    const state = get();

    if (state.status !== "playing" || state.currentTurn !== "player") {
      return;
    }

    set(playCardForSide(state, "player", cardId));
  },
  evolveCard: (baseBoardCardId, evolutionHandCardId) => {
    const state = get();

    if (state.status !== "playing" || state.currentTurn !== "player") {
      return;
    }

    set(
      (() => {
        const nextState = evolveCardForSide(state, "player", baseBoardCardId, evolutionHandCardId);
        return {
          ...nextState,
          selectedEvolutionBaseId: nextState.selectedEvolutionBaseId === baseBoardCardId ? null : nextState.selectedEvolutionBaseId,
        };
      })(),
    );
  },
  selectAttacker: (cardId) => {
    const state = get();

    if (state.status !== "playing" || state.currentTurn !== "player") {
      return;
    }

    if (!cardId) {
      set({ selectedAttackerId: null });
      return;
    }

    const card = state.player.board.find((entry) => entry.id === cardId);

    if (!card?.canAttack) {
      return;
    }

    set({
      selectedAttackerId: state.selectedAttackerId === cardId ? null : cardId,
    });
  },
  selectEvolutionBase: (cardId) => {
    const state = get();

    if (state.status !== "playing" || state.currentTurn !== "player") {
      return;
    }

    set({
      selectedEvolutionBaseId: state.selectedEvolutionBaseId === cardId ? null : cardId,
    });
  },
  attackTarget: (targetId) => {
    const state = get();

    if (
      state.status !== "playing" ||
      state.currentTurn !== "player" ||
      !state.selectedAttackerId
    ) {
      return;
    }

    set(ensureAliveOrSetWinner(attackBoardWithSide(state, "player", state.selectedAttackerId, targetId)));
  },
  attackHero: () => {
    const state = get();

    if (
      state.status !== "playing" ||
      state.currentTurn !== "player" ||
      !state.selectedAttackerId
    ) {
      return;
    }

    set(attackHeroWithSide(state, "player", state.selectedAttackerId));
  },
  endTurn: () => {
    const state = get();

    if (state.status !== "playing" || state.currentTurn !== "player") {
      return;
    }

    set({
      currentTurn: "ai",
      selectedAttackerId: null,
      selectedEvolutionBaseId: null,
    });
  },
  runAiTurn: async () => {
    const state = get();

    if (
      state.status !== "playing" ||
      state.currentTurn !== "ai" ||
      state.aiProcessing ||
      state.winner
    ) {
      return;
    }

    set({ aiProcessing: true });
    set((currentState) => beginTurn(currentState, "ai"));
    await wait(randomDelay());

    while (true) {
      const snapshot = get();

      if (snapshot.status !== "playing" || snapshot.winner) {
        set({ aiProcessing: false });
        return;
      }

      const bestEvolution = findBestEvolution(snapshot.ai);

      if (!bestEvolution || bestEvolution.boardCard.enteredTurn === snapshot.turnNumber) {
        break;
      }

      set((currentState) =>
        evolveCardForSide(
          currentState,
          "ai",
          bestEvolution.baseBoardCardId,
          bestEvolution.evolutionHandCardId,
        ),
      );
      await wait(randomDelay());
    }

    while (true) {
      const snapshot = get();

      if (snapshot.status !== "playing" || snapshot.winner) {
        set({ aiProcessing: false });
        return;
      }

      const candidate =
        !snapshot.ai.hasPlayedCardThisTurn && snapshot.ai.board.length < MAX_BOARD_SIZE
          ? getPlayableCardsSorted(snapshot.ai)[0]
          : undefined;

      if (!candidate) {
        break;
      }

      set((currentState) => playCardForSide(currentState, "ai", candidate.id));
      await wait(randomDelay());
      break;
    }

    while (true) {
      const snapshot = get();

      if (snapshot.status !== "playing" || snapshot.winner) {
        set({ aiProcessing: false });
        return;
      }

      const attacker = getReadyAttackers(snapshot.ai)[0];

      if (!attacker) {
        break;
      }

      if (snapshot.player.board.length > 0) {
        const target = getWeakestBoardTarget(snapshot.player.board);

        if (target) {
          set((currentState) =>
            ensureAliveOrSetWinner(
              attackBoardWithSide(currentState, "ai", attacker.id, target.id),
            ),
          );
        }
      } else {
        set((currentState) => attackHeroWithSide(currentState, "ai", attacker.id));
      }

      await wait(randomDelay());
    }

    set((currentState) => ({
      ...beginTurn(
        {
          ...currentState,
          currentTurn: "player",
          selectedAttackerId: null,
          selectedEvolutionBaseId: null,
          aiProcessing: false,
        },
        "player",
      ),
      aiProcessing: false,
    }));
  },
}));
