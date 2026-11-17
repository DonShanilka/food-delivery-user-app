import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@/types";
import { apiGet } from "@/services/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const [stored, token] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("token"),
        ]);

        if (stored) {
          const parsedUser = JSON.parse(stored);
          // Older app versions stored the complete login response data here.
          const storedUser = parsedUser?.user ?? parsedUser;

          if (storedUser?._id) {
            setUserState(storedUser as User);
            if (storedUser !== parsedUser) {
              await AsyncStorage.setItem("user", JSON.stringify(storedUser));
            }
            return;
          }

          // Discard malformed cached user data and recover from the token below.
          await AsyncStorage.removeItem("user");
        }

        // If we have a token but no stored user, try fetching profile
        if (token) {
          try {
            const resp = await apiGet<{ success?: boolean; data: User }>(
              "/users/profile",
            );
            const profile = (resp as any)?.data ?? resp;
            if (profile) setUserState(profile as User);
          } catch {
            // ignore - leave user null
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const setUser = async (user: User | null) => {
    setUserState(user);
    if (user) {
      await AsyncStorage.setItem("user", JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem("user");
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
