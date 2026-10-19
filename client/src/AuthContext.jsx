import { useEffect, useState } from "react";
import { api } from "./api";
import AuthContext from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const data = await api("/api/check_session");
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    api("/api/check_session")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(data);
  }

  async function signup({ username, password, bio }) {
    const data = await api("/api/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, bio }),
    });
    setUser(data);
  }

  async function logout() {
    await api("/api/logout", { method: "DELETE" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
