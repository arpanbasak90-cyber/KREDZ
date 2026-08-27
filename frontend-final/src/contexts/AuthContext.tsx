import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MentorUser, StudentUser } from "@/lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type CurrentUser =
  | ({ role: "student" } & StudentUser)
  | ({ role: "mentor" } & MentorUser)
  | null;

interface AuthContextValue {
  user: CurrentUser;
  loading: boolean;
  signupStudent: (data: Omit<StudentUser, "id" | "role" | "createdAt">) => Promise<StudentUser>;
  signupMentor: (data: Omit<MentorUser, "id" | "role" | "createdAt">) => Promise<MentorUser>;
  loginStudent: (email: string, password: string) => Promise<StudentUser>;
  loginMentor: (email: string, password: string) => Promise<MentorUser>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = "kredz.session";

function saveSession(user: CurrentUser) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

function loadSession(): CurrentUser {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(loadSession());
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh: () => setUser(loadSession()),

      signupStudent: async (data) => {
        const res = await fetch(`${API}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.fullName,
            institution: data.institution,
            email: data.email,
            password: data.password,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? "Registration failed");
        }
        const result = await res.json();
        const newUser: StudentUser = {
          id: String(result.student_id),
          role: "student",
          fullName: result.name,
          email: data.email,
          password: "",
          institution: data.institution,
          createdAt: new Date().toISOString(),
        };
        saveSession(newUser);
        setUser(newUser);
        return newUser;
      },

      signupMentor: async (data) => {
        const res = await fetch(`${API}/api/mentor-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: data.fullName,
            institution: data.institution,
            email: data.email,
            password: data.password,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? "Registration failed");
        }
        const result = await res.json();
        const newUser: MentorUser = {
          id: String(result.mentor_id),
          role: "mentor",
          fullName: result.full_name,
          email: data.email,
          password: "",
          contactNumber: "",
          institution: data.institution,
          createdAt: new Date().toISOString(),
        };
        saveSession(newUser);
        setUser(newUser);
        return newUser;
      },

      loginStudent: async (email, password) => {
        const res = await fetch(`${API}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? "Login failed");
        }
        const data = await res.json();
        const student: StudentUser = {
          id: String(data.student_id),
          role: "student",
          fullName: data.name,
          email,
          password: "",
          institution: data.institution,
          createdAt: new Date().toISOString(),
        };
        saveSession(student);
        setUser(student);
        return student;
      },

      loginMentor: async (email, password) => {
        const res = await fetch(`${API}/api/mentor-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? "Login failed");
        }
        const data = await res.json();
        const mentor: MentorUser = {
          id: String(data.mentor_id),
          role: "mentor",
          fullName: data.full_name,
          email: data.email,
          password: "",
          contactNumber: "",
          institution: data.institution,
          createdAt: new Date().toISOString(),
        };
        saveSession(mentor);
        setUser(mentor);
        return mentor;
      },

      logout: () => {
        saveSession(null);
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
