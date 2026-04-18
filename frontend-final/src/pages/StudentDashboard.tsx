import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldCheck, Sparkles, Award, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { CredentialCard } from "@/components/CredentialCard";
import { SubmitCredentialDialog } from "@/components/SubmitCredentialDialog";
import { useToast } from "@/hooks/use-toast";
import type { StudentUser } from "@/lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface BackendCredential {
  id: number;
  project_name: string;
  type: string;
  description: string;
  date: string;
  institution: string;
  github_link?: string;
  endorser_name?: string;
  endorser_email?: string;
  endorsement_status: string;
  endorsed_at?: string;
  credential_hash: string;
  created_at?: string;
  timestamp?: string;
  qr_token?: string;
}

// Map backend shape → local Credential shape used by CredentialCard
function mapCredential(c: BackendCredential, student: StudentUser) {
  return {
    id: String(c.id),
    studentId: student.id,
    studentName: student.fullName,
    studentInstitution: student.institution,
    projectName: c.project_name,
    type: c.type as never,
    description: c.description,
    date: c.date,
    hash: c.credential_hash,
    githubLink: c.github_link,
    mentorName: c.endorser_name ?? "",
    mentorEmail: c.endorser_email ?? "",
    endorsementStatus: (c.endorsement_status as never) ?? "none",
    endorsedAt: c.endorsed_at,
    createdAt: c.timestamp ?? c.created_at ?? c.date,
  };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const student = user as StudentUser;
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<ReturnType<typeof mapCredential>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCredentials = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/dashboard/${student.id}`);
      if (!res.ok) throw new Error("Failed to load credentials");
      const data = await res.json();
      setCredentials((data.credentials ?? []).map((c: BackendCredential) => mapCredential(c, student)));
    } catch {
      toast({ title: "Error loading credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const stats = {
    total:    credentials.length,
    endorsed: credentials.filter((c) => c.endorsementStatus === "approved").length,
    pending:  credentials.filter((c) => c.endorsementStatus === "pending").length,
  };

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-2">Student portfolio</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Welcome back, <span className="text-gradient-primary">{student.fullName.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-1">{student.institution}</p>
        </div>
        <Button variant="hero" size="lg" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" /> Add credential
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Sparkles} label="Total credentials" value={stats.total}    tone="primary" />
        <StatCard icon={ShieldCheck} label="Endorsed"        value={stats.endorsed} tone="accent" />
        <StatCard icon={Award}       label="Pending review"  value={stats.pending}  tone="warning" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : credentials.length === 0 ? (
        <EmptyState onAdd={() => setOpen(true)} />
      ) : (
        <div className="space-y-4">
          {credentials.map((c) => <CredentialCard key={c.id} credential={c as never} />)}
        </div>
      )}

      <SubmitCredentialDialog
        open={open}
        onOpenChange={setOpen}
        student={student}
        onSubmitted={fetchCredentials}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: "primary" | "accent" | "warning" }) {
  const tones = {
    primary: "bg-gradient-primary text-primary-foreground",
    accent: "bg-gradient-accent text-accent-foreground",
    warning: "bg-warning/15 text-warning-foreground border border-warning/30",
  };
  return (
    <div className="bg-gradient-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 transition-base hover:shadow-elegant">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center bg-secondary/30">
      <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 shadow-md">
        <FileSearch className="h-7 w-7 text-primary-foreground" />
      </div>
      <h3 className="font-display text-xl font-bold mb-2">No credentials yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Tap below to add your first project, internship or hackathon win. We'll seal it with SHA-256 and notify your mentor.
      </p>
      <Button variant="hero" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add your first credential
      </Button>
    </div>
  );
}
