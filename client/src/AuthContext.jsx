import { useEffect, useRef, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";
import AuthContext from "./useAuth";

function userFromSession(data) {
  if (!data || data.user === null) return null;
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      epoch.current += 1;
      setUser(null);
    });
  }, []);

  function fetchSession() {
    return api("/api/check_session").then(userFromSession).catch(() => null);
  }

  async function refreshUser() {
    const ticket = epoch.current;
    const data = await fetchSession();
    if (ticket !== epoch.current) return null;
    setUser(data);
    return data;
  }

  useEffect(() => {
    const ticket = epoch.current;
    fetchSession()
      .then((data) => {
        if (ticket === epoch.current) setUser(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const ticket = ++epoch.current;
    const next = await api("/api/login", "POST", { username, password });
    if (ticket === epoch.current) setUser(next);
  }

  async function signup({ username, password, bio }) {
    const ticket = ++epoch.current;
    const next = await api("/api/signup", "POST", { username, password, bio });
    if (ticket === epoch.current) setUser(next);
  }

  async function logout() {
    const ticket = ++epoch.current;
    setUser(null);
    try {
      await api("/api/logout", "DELETE");
    } catch {
      if (ticket === epoch.current) setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
