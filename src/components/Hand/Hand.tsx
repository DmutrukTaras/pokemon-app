import type { Card as CardType } from "../../game/types";
import { Card } from "../Card/Card";
import styles from "./Hand.module.css";

type HandProps = {
  cards: CardType[];
  playableIds?: Set<string>;
  evolvableIds?: Set<string>;
  disabledIds?: Set<string>;
  onCardClick?: (card: CardType) => void;
};

export function Hand({
  cards,
  playableIds,
  evolvableIds,
  disabledIds,
  onCardClick,
}: HandProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3>Your Hand</h3>
        <span>{cards.length}/10</span>
      </div>
      <div className={styles.grid}>
        {cards.map((card) => (
          <Card
            key={card.id}
            canEvolve={evolvableIds?.has(card.id)}
            disabled={disabledIds?.has(card.id)}
            onClick={onCardClick ? () => onCardClick(card) : undefined}
            playable={playableIds?.has(card.id)}
            card={card}
          />
        ))}
      </div>
    </section>
  );
}
