// Shared cube state so face panels do not take a long list of props.
import { createContext, useContext, useMemo } from "react";

const GameContext = createContext(null);

export function GameProvider({ value, children }) {
  const {
    anim,
    loggedIn,
    game,
    onGuess,
    onPick,
    onShowPlayers,
    onLoginSuccess,
    onLoginFailure,
    onSignupSuccess,
    onSignupFailure,
    onShowLogin,
    onShowSignup,
  } = value;

  // A new object every render would redraw every face. Reuse it when the
  // pieces are the same.
  const memoized = useMemo(() => ({
    anim,
    loggedIn,
    game,
    onGuess,
    onPick,
    onShowPlayers,
    onLoginSuccess,
    onLoginFailure,
    onSignupSuccess,
    onSignupFailure,
    onShowLogin,
    onShowSignup,
  }), [
    anim,
    loggedIn,
    game,
    onGuess,
    onPick,
    onShowPlayers,
    onLoginSuccess,
    onLoginFailure,
    onSignupSuccess,
    onSignupFailure,
    onShowLogin,
    onShowSignup,
  ]);

  return <GameContext.Provider value={memoized}>{children}</GameContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useGame() {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error("useGame must be used inside GameProvider");
  }
  return value;
}
