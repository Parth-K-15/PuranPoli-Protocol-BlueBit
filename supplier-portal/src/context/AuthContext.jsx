/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("supplier_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.me();
        setUser(data.user ?? data);
      } catch {
        localStorage.removeItem("supplier_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token]);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    const jwt = data.token;
    localStorage.setItem("supplier_token", jwt);
    setToken(jwt);
    setUser(data.user ?? data);
    return data;
  };

  const register = async (fields) => {
    const data = await authApi.register(fields);
    const jwt = data.token;
    localStorage.setItem("supplier_token", jwt);
    setToken(jwt);
    setUser(data.user ?? data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("supplier_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
