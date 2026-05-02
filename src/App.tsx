import { useGameStore } from "./store/gameStore";
import { GamePage } from "./pages/GamePage";
import { MenuPage } from "./pages/MenuPage";

function App() {
  const status = useGameStore((state) => state.status);

  if (status === "menu" || status === "loading") {
    return <MenuPage />;
  }

  return <GamePage />;
}

export default App;
