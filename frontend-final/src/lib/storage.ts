import type { Credential, MentorUser, StudentUser } from "./types";

const KEYS = {
  students: "kredz.students",
  mentors: "kredz.mentors",
  session: "kredz.session",
  credentials: "kredz.credentials",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  // Students
  getStudents: (): StudentUser[] => read(KEYS.students, []),
  saveStudents: (users: StudentUser[]) => write(KEYS.students, users),

  // Mentors
  getMentors: (): MentorUser[] => read(KEYS.mentors, []),
  saveMentors: (users: MentorUser[]) => write(KEYS.mentors, users),

  // Session
  getSession: (): { role: "student" | "mentor"; id: string } | null =>
    read(KEYS.session, null),
  setSession: (s: { role: "student" | "mentor"; id: string } | null) => {
    if (s) write(KEYS.session, s);
    else localStorage.removeItem(KEYS.session);
  },

  // Credentials
  getCredentials: (): Credential[] => read(KEYS.credentials, []),
  saveCredentials: (creds: Credential[]) => write(KEYS.credentials, creds),
};
