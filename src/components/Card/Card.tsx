import type { Card as CardType } from "../../game/types";
import { getAttackCost, getEvolutionCost } from "../../game/rules";
import styles from "./Card.module.css";

type HighlightVariant = "advantage" | "neutral" | "disadvantage";

type CardProps = {
  card: CardType;
  selected?: boolean;
  playable?: boolean;
  canEvolve?: boolean;
  canAttack?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  highlightVariant?: HighlightVariant | null;
  entering?: boolean;
  evolving?: boolean;
  attacking?: boolean;
  takingHit?: boolean;
  onClick?: () => void;
};

export function Card({
  card,
  selected = false,
  playable = false,
  canEvolve = false,
  canAttack = false,
  disabled = false,
  highlighted = false,
  highlightVariant = null,
  entering = false,
  evolving = false,
  attacking = false,
  takingHit = false,
  onClick,
}: CardProps) {
  const currentHp = card.currentHp ?? card.hp;
  const evolvesFrom = card.evolvesFromSpeciesId ? `From #${card.evolvesFromSpeciesId}` : "Basic";
  const evolvesTo =
    card.evolvesToSpeciesIds.length > 0
      ? `To #${card.evolvesToSpeciesIds.join(", #")}`
      : "Final Form";
  const attackCost = getAttackCost(card);
  const evolutionCost = getEvolutionCost(card);
  const showEvolutionCost = card.evolutionStage > 0;

  return (
    <button
      className={[
        styles.card,
        selected ? styles.selected : "",
        playable ? styles.playable : "",
        canEvolve ? styles.canEvolve : "",
        canAttack ? styles.canAttack : "",
        disabled ? styles.disabled : "",
        highlighted ? styles.highlighted : "",
        highlightVariant === "advantage" ? styles.highlightAdvantage : "",
        highlightVariant === "neutral" ? styles.highlightNeutral : "",
        highlightVariant === "disadvantage" ? styles.highlightDisadvantage : "",
        entering ? styles.entering : "",
        evolving ? styles.evolving : "",
        attacking ? styles.attacking : "",
        takingHit ? styles.takingHit : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className={styles.badges}>
        <div className={styles.cost}>
          <span>{attackCost}</span>
          <small>ATK</small>
        </div>
        {showEvolutionCost ? (
          <div className={styles.evolutionCost}>
            <span>{evolutionCost}</span>
            <small>EVO</small>
          </div>
        ) : null}
      </div>
      <div className={styles.imageWrap}>
        {card.image ? <img alt={card.name} className={styles.image} src={card.image} /> : <div className={styles.placeholder}>?</div>}
      </div>
      <div className={styles.header}>
        <strong>{card.name}</strong>
        <span>Stage {card.evolutionStage}</span>
      </div>
      <div className={styles.types}>{card.types.join(" / ")}</div>
      <div className={styles.stats}>
        <span>HP {currentHp}/{card.hp}</span>
        <span>ATK {card.attack}</span>
        <span>DEF {card.defense}</span>
      </div>
      <div className={styles.meta}>
        <span>{evolvesFrom}</span>
        <span>{evolvesTo}</span>
      </div>
      <div className={styles.flags}>
        {playable && <span>Free Deploy</span>}
        {canEvolve && <span>Evolve {evolutionCost} EN</span>}
        {canAttack && <span>Attack {attackCost} EN</span>}
      </div>
    </button>
  );
}
