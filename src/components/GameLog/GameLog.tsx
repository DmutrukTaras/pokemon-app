import styles from "./GameLog.module.css";

type GameLogProps = {
  entries: string[];
};

export function GameLog({ entries }: GameLogProps) {
  return (
    <section className={styles.log}>
      <div className={styles.header}>
        <h3>Game Log</h3>
      </div>
      <div className={styles.entries}>
        {[...entries].reverse().map((entry, index) => (
          <div key={`${entry}-${index}`} className={styles.entry}>
            {entry}
          </div>
        ))}
      </div>
    </section>
  );
}
