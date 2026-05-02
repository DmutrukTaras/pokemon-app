import type { Card as CardType } from "../../game/types";
import { Card } from "../Card/Card";
import styles from "./Board.module.css";

type BoardProps = {
  title: string;
  cards: CardType[];
  selectedAttackerId?: string | null;
  selectedEvolutionBaseId?: string | null;
  evolvableIds?: Set<string>;
  attackableIds?: Set<string>;
  highlightedIds?: Set<string>;
  matchupHighlightMap?: Record<string, "advantage" | "neutral" | "disadvantage">;
  enteringIds?: Set<string>;
  evolvingIds?: Set<string>;
  attackingIds?: Set<string>;
  takingHitIds?: Set<string>;
  onCardClick?: (card: CardType) => void;
};

export function Board({
  title,
  cards,
  selectedAttackerId,
  selectedEvolutionBaseId,
  evolvableIds,
  attackableIds,
  highlightedIds,
  matchupHighlightMap,
  enteringIds,
  evolvingIds,
  attackingIds,
  takingHitIds,
  onCardClick,
}: BoardProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <span>{cards.length}/5</span>
      </div>
      <div className={styles.grid}>
        {cards.length > 0 ? (
          cards.map((card) => (
            <Card
              key={card.id}
              canAttack={attackableIds?.has(card.id)}
              canEvolve={evolvableIds?.has(card.id)}
              entering={enteringIds?.has(card.id)}
              evolving={evolvingIds?.has(card.id)}
              highlighted={highlightedIds?.has(card.id)}
              highlightVariant={matchupHighlightMap?.[card.id] ?? null}
              attacking={attackingIds?.has(card.id)}
              takingHit={takingHitIds?.has(card.id)}
              onClick={onCardClick ? () => onCardClick(card) : undefined}
              selected={
                selectedAttackerId === card.id || selectedEvolutionBaseId === card.id
              }
              card={card}
            />
          ))
        ) : (
          <div className={styles.empty}>No Pokemon on the board</div>
        )}
      </div>
    </section>
  );
}
