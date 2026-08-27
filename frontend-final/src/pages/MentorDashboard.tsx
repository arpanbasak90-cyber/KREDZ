import { useEffect, useMemo, useState } from "react";
import {
  Calendar, Code2, ShieldCheck,
  CheckCircle2, XCircle, Clock,
  ExternalLink, FileSearch, Inbox, Brain, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Filter = "pending" | "approved" | "rejected" | "all";

interface AiVerdict {
  verdict: "approve" | "reject" | "review";
  confidence: number;
  integrity_score: number;
  github: { plagiarism_risk: string; issues: string[] };
  certificates: { authentic: boolean | null; issues: string[] };
  summary: string;
  flags: string[];
}

interface EnrichedCredential {
  id: number;
  project_name: string;
  type: string;
  description: string;
  date: string;
  institution: string;
  github_link?: string;
  endorsement_status: string;
  endorsed_at?: string;
  endorsement_token?: string;
  credential_hash: string;
  student: { name: string; institution: string };
  ai_verdict: AiVerdict | null;
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const mentorEmail = (user as Record<string, string>)?.email ?? "";
  const mentorName  = (user as Record<string, string>)?.fullName
                   ?? (user as Record<string, string>)?.full_name
                   ?? "Mentor";

  const [credentials, setCredentials] = useState<EnrichedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  const fetchCredentials = () => {
    if (!mentorEmail) return;
    setLoading(true);
    fetch(`${API}/api/mentor-credentials?email=${encodeURIComponent(mentorEmail)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCredentials(data); })
      .catch(() => toast({ title: "Error loading credentials", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCredentials(); }, [mentorEmail]);

  const filtered = useMemo(() => {
    if (filter === "all") return credentials;
    return credentials.filter((c) => c.endorsement_status === filter);
  }, [credentials, filter]);

  const stats = {
    pending:  credentials.filter((c) => c.endorsement_status === "pending").length,
    approved: credentials.filter((c) => c.endorsement_status === "approved").length,
    rejected: credentials.filter((c) => c.endorsement_status === "rejected").length,
  };

  const handleEndorse = async (cred: EnrichedCredential, decision: "approved" | "rejected", reason?: string) => {
    try {
      const form = new FormData();
      form.append("decision", decision);
      const res = await fetch(`${API}/endorse/${cred.endorsement_token}`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      toast({
        title: decision === "approved" ? "Credential approved ✓" : "Credential rejected",
        description: decision === "approved" ? "The student has been notified." : reason || "Rejection recorded.",
      });
      fetchCredentials();
    } catch {
      toast({ title: "Error", description: "Could not record your decision.", variant: "destructive" });
    }
  };

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-1">Mentor console</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight">{mentorName}</h1>
            <p className="text-sm text-muted-foreground">{mentorEmail}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCredentials} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip active={filter==="pending"}  onClick={()=>setFilter("pending")}  icon={Clock}        label="Pending"  count={stats.pending}      tone="warning" />
        <FilterChip active={filter==="approved"} onClick={()=>setFilter("approved")} icon={CheckCircle2} label="Approved" count={stats.approved}     tone="accent" />
        <FilterChip active={filter==="rejected"} onClick={()=>setFilter("rejected")} icon={XCircle}      label="Rejected" count={stats.rejected}     tone="destructive" />
        <FilterChip active={filter==="all"}      onClick={()=>setFilter("all")}      icon={Inbox}        label="All"      count={credentials.length} tone="default" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <MentorCredentialRow
              key={c.id}
              credential={c}
              onApprove={() => handleEndorse(c, "approved")}
              onReject={(r) => handleEndorse(c, "rejected", r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, icon: Icon, label, count, tone }: {
  active: boolean; onClick: ()=>void; icon: React.ElementType;
  label: string; count: number; tone: "warning"|"accent"|"destructive"|"default";
}) {
  const activeCls = { warning:"bg-warning/20 text-warning-foreground border-warning/40", accent:"bg-accent/15 text-accent border-accent/30", destructive:"bg-destructive/15 text-destructive border-destructive/30", default:"bg-primary/10 text-primary border-primary/30" }[tone];
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${active ? activeCls : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"}`}>
      <Icon className="h-4 w-4" />{label}
      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/70 text-[11px]">{count}</span>
    </button>
  );
}

function MentorCredentialRow({ credential: c, onApprove, onReject }: {
  credential: EnrichedCredential; onApprove: ()=>void; onReject: (r:string)=>void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [showAi, setShowAi] = useState(false);

  return (
    <article className="bg-gradient-card rounded-2xl border border-border/60 hover:shadow-elegant transition-colors p-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg">{c.project_name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{c.student.name}</span> · {c.student.institution}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />{c.date}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <TypeBadge type={c.type} />
          <StatusBadge status={c.endorsement_status} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{c.description}</p>

      {c.github_link && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <a href={c.github_link} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary text-[11px] font-semibold hover:border-primary/30 hover:text-primary transition-colors">
            <Code2 className="h-3 w-3" />GitHub<ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        </div>
      )}

      {c.ai_verdict && (
        <button onClick={()=>setShowAi(v=>!v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent mb-3 hover:underline">
          <Brain className="h-3.5 w-3.5" />
          {showAi ? "Hide" : "Show"} AI verdict
          <VerdictChip verdict={c.ai_verdict.verdict} />
        </button>
      )}

      {showAi && c.ai_verdict && (
        <div className="mb-4 animate-fade-in">
          <AiVerdictPanel ai={c.ai_verdict} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
        <code className="text-[11px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
          SHA-256: {c.credential_hash?.slice(0, 16)}…
        </code>
        {c.endorsement_status === "pending" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={()=>setShowReject(v=>!v)}><XCircle className="h-4 w-4"/>Reject</Button>
            <Button variant="accent" size="sm" onClick={onApprove}><CheckCircle2 className="h-4 w-4"/>Approve</Button>
          </div>
        ) : c.endorsement_status === "approved" ? (
          <span className="text-xs text-accent font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5"/>Endorsed{c.endorsed_at && ` · ${new Date(c.endorsed_at).toLocaleDateString()}`}
          </span>
        ) : (
          <span className="text-xs text-destructive font-semibold flex items-center gap-1"><XCircle className="h-3.5 w-3.5"/>Rejected</span>
        )}
      </div>

      {showReject && c.endorsement_status === "pending" && (
        <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-3 animate-fade-in">
          <Label htmlFor={`reason-${c.id}`}>Why are you rejecting? (optional)</Label>
          <Textarea id={`reason-${c.id}`} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Briefly explain so the student can correct it..." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={()=>{setShowReject(false);setReason("");}}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={()=>{onReject(reason.trim());setShowReject(false);setReason("");}}>Confirm rejection</Button>
          </div>
        </div>
      )}
    </article>
  );
}

function AiVerdictPanel({ ai }: { ai: AiVerdict }) {
  const verdictColor = { approve:"text-accent", reject:"text-destructive", review:"text-warning-foreground" }[ai.verdict] ?? "text-muted-foreground";
  const riskColor    = { low:"text-accent", medium:"text-warning-foreground", high:"text-destructive", not_provided:"text-muted-foreground" }[ai.github.plagiarism_risk] ?? "text-muted-foreground";
  const allIssues    = [...(ai.github.issues??[]), ...(ai.certificates.issues??[]), ...(ai.flags??[])].filter(Boolean);

  return (
    <div className="bg-secondary/50 rounded-xl border border-border/60 p-4 space-y-3">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Integrity score</span>
          <span className={`font-semibold ${verdictColor}`}>{ai.integrity_score}/100</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${ai.integrity_score>=70?"bg-accent":ai.integrity_score>=40?"bg-warning":"bg-destructive"}`} style={{width:`${ai.integrity_score}%`}}/>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Confidence: {ai.confidence}%</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{ai.summary}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">GitHub plagiarism risk</span>
        <span className={`font-semibold capitalize ${riskColor}`}>{ai.github.plagiarism_risk.replace("_"," ")}</span>
      </div>
      {allIssues.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/60">
          {allIssues.map((issue,i)=>(
            <div key={i} className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0"/><span>{issue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const cls = { approve:"bg-accent/10 text-accent border-accent/30", reject:"bg-destructive/10 text-destructive border-destructive/30", review:"bg-warning/15 text-warning-foreground border-warning/30" }[verdict] ?? "bg-secondary text-muted-foreground";
  const label = { approve:"Approve", reject:"Reject", review:"Review" }[verdict] ?? verdict;
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cls}`}>{label}</span>;
}
function TypeBadge({ type }: { type: string }) {
  return <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold">{type}</span>;
}
function StatusBadge({ status }: { status: string }) {
  if (status==="approved") return <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30 text-[11px] font-semibold">Approved</span>;
  if (status==="rejected") return <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 text-[11px] font-semibold">Rejected</span>;
  return <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning-foreground border border-warning/30 text-[11px] font-semibold">Pending</span>;
}
function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center bg-secondary/30">
      <div className="w-16 h-16 mx-auto bg-gradient-accent rounded-2xl flex items-center justify-center mb-4 shadow-md">
        <FileSearch className="h-7 w-7 text-accent-foreground" />
      </div>
      <h3 className="font-display text-xl font-bold mb-2">Nothing here yet</h3>
      <p className="text-muted-foreground max-w-sm mx-auto">When a student lists your email as their mentor, credentials will appear here for review.</p>
    </div>
  );
}
