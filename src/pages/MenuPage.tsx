import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import styles from "./MenuPage.module.css";

export function MenuPage() {
  const [showRules, setShowRules] = useState(false);
  const startGame = useGameStore((state) => state.startGame);
  const status = useGameStore((state) => state.status);
  const loadingMessage = useGameStore((state) => state.loadingMessage);
  const errorMessage = useGameStore((state) => state.errorMessage);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span className={styles.kicker}>Single-player Pokemon strategy duel</span>
        <h1>Pokemon Card Battler</h1>
        <p>
          Build a board, spend energy, evolve your Pokemon at the right moment,
          and race the AI to zero hero HP.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.primary}
            disabled={status === "loading"}
            onClick={() => void startGame()}
            type="button"
          >
            {status === "loading" ? "Loading..." : "Start Game"}
          </button>
          <button
            className={styles.secondary}
            onClick={() => setShowRules((value) => !value)}
            type="button"
          >
            {showRules ? "Hide Rules" : "Rules"}
          </button>
        </div>
        {status === "loading" ? <p className={styles.info}>{loadingMessage}</p> : null}
        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      </section>

      {showRules ? (
        <section className={styles.rules}>
          <h2>How it works</h2>
          <ul>
            <li>Each turn you draw one card and refill energy up to your current max.</li>
            <li>You may deploy one Basic Pokemon for free each turn.</li>
            <li>Energy is spent on attacks and evolutions instead of playing cards.</li>
            <li>Evolutions must be in your hand and match a Pokemon already on the board.</li>
            <li>A Pokemon cannot attack on the same turn it was played.</li>
            <li>If the enemy has board cards, you must attack them before the hero.</li>
            <li>Type advantage adds 50% more damage.</li>
            <li>First hero to reach 0 HP loses.</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
