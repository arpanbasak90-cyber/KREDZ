// Kredz shared types
export type Role = "student" | "mentor";

export interface StudentUser {
  id: string;
  role: "student";
  fullName: string;
  email: string;
  password: string; // mock only — never do this in production
  institution: string;
  createdAt: string;
}

export interface MentorUser {
  id: string;
  role: "mentor";
  fullName: string;
  email: string;
  password: string; // mock only
  contactNumber: string;
  institution: string;
  avatarDataUrl?: string;
  createdAt: string;
}

export type AnyUser = StudentUser | MentorUser;

export type CredentialType =
  | "Project"
  | "Internship"
  | "Hackathon Win"
  | "Research"
  | "Coursework";

export type EndorsementStatus = "pending" | "approved" | "rejected" | "none";

export interface Credential {
  id: string;
  studentId: string;
  studentName: string;
  studentInstitution: string;
  projectName: string;
  type: CredentialType;
  description: string;
  date: string;
  hash: string;

  // Verification links
  githubLink?: string;
  linkedinLink?: string;
  devfolioLink?: string;
  digilockerVerified?: boolean;

  // Mentor
  mentorName: string;
  mentorEmail: string;
  endorsementStatus: EndorsementStatus;
  endorsedAt?: string;
  rejectionReason?: string;

  createdAt: string;
}
