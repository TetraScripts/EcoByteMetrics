import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import { createAuthStore } from "./session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAuthStore(typeof window !== "undefined"));
  useEffect(() => {
    void store.restore();
    const check = () => { store.checkExpiration(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      store.dispose();
    };
  }, [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}
