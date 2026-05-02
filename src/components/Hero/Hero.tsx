import type { Hero as HeroType } from "../../game/types";
import styles from "./Hero.module.css";

type HeroProps = {
  hero: HeroType;
  label: string;
  energy?: number;
  maxEnergy?: number;
  active?: boolean;
};

export function Hero({ hero, label, energy, maxEnergy, active = false }: HeroProps) {
  const hpRatio = `${(hero.hp / hero.maxHp) * 100}%`;

  return (
    <section className={`${styles.hero} ${active ? styles.active : ""}`}>
      <div className={styles.row}>
        <div>
          <strong>{label}</strong>
          <div>HP {hero.hp}/{hero.maxHp}</div>
        </div>
        {typeof energy === "number" && typeof maxEnergy === "number" ? (
          <div className={styles.energy}>Energy {energy}/{maxEnergy}</div>
        ) : null}
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: hpRatio }} />
      </div>
    </section>
  );
}
