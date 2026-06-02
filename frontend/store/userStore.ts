import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  userId: string | null;
  email: string | null;
  setUser: (userId: string, email: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: null,
      email: null,
      setUser: (userId, email) => set({ userId, email }),
      clearUser: () => set({ userId: null, email: null }),
    }),
    {
      name: "eukov-user",
    },
  ),
);
