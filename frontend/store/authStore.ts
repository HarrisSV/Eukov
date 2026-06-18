import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nickname?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      updateUser: (user) => set({ user }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "eukov-auth" },
  ),
);
