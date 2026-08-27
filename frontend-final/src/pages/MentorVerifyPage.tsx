import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, ExternalLink, Code2, Brain, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface CredentialData {
  credential: Record<string, unknown>;
  student: { name: string; institution: string };
  ai_verdict: AiVerdict | null;
}

interface Checkpoint {
  name: string;
  status: "auto_cleared" | "needs_human";
  reason: string;
}

interface AiVerdict {
  verdict: "approve" | "reject" | "review";
  confidence: number;
  integrity_score: number;
  github: { plagiarism_risk: string; issues: string[] };
  certificates: { authentic: boolean | null; issues: string[] };
  checkpoints?: Checkpoint[];
  summary: string;
  flags: string[];
}

export default function MentorVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loginMentor } = useAuth();
  const { toast } = useToast();

  const token = searchParams.get("token") ?? "";

  const [credData, setCredData] = useState<CredentialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Login form state (shown when not authenticated)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Endorsement / seal action state
  const [acting, setActing] = useState(false);
  const [sealing, setSealing] = useState(false);

  // ── Review gate state ────────────────────────────────────────────
  const [reviewedCheckpoints, setReviewedCheckpoints] = useState<Set<number>>(new Set());
  const [githubViewed, setGithubViewed] = useState(false);

  // Fetch credential on mount
  useEffect(() => {
    if (!token) {
      setError("No QR token found in the link. Please scan the QR code again.");
      setLoading(false);
      return;
    }
    fetch(`${API}/api/credential-by-qr-token/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.detail) throw new Error(data.detail);
        setCredData(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const refreshCredential = async () => {
    const updated = await fetch(`${API}/api/credential-by-qr-token/${token}`).then((r) => r.json());
    setCredData(updated);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await loginMentor(loginEmail, loginPassword);
      toast({ title: "Welcome back!", description: "You're now logged in as mentor." });
    } catch (err: unknown) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Invalid credentials.",
        variant: "destructive",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEndorse = async (decision: "approved" | "rejected") => {
    if (!credData) return;
    const endorsementToken = credData.credential.endorsement_token as string;
    if (!endorsementToken) {
      toast({ title: "Cannot endorse", description: "No endorsement token on this credential.", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      const form = new FormData();
      form.append("decision", decision);
      const res = await fetch(`${API}/endorse/${endorsementToken}`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Action failed");
      toast({
        title: decision === "approved" ? "Credential approved ✓" : "Credential rejected",
        description: decision === "approved" ? "Endorsement recorded." : "Rejection recorded.",
      });
      await refreshCredential();
    } catch {
      toast({ title: "Error", description: "Could not record your decision. Try again.", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleSeal = async () => {
    if (!credData) return;
    const endorsementToken = credData.credential.endorsement_token as string;
    const mentorEmail = (user as { email?: string })?.email;
    if (!endorsementToken || !mentorEmail) {
      toast({ title: "Cannot seal", description: "Missing token or mentor email.", variant: "destructive" });
      return;
    }
    setSealing(true);
    try {
      const form = new FormData();
      form.append("mentor_email", mentorEmail);
      const res = await fetch(`${API}/api/seal/${endorsementToken}`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Seal failed");
      }
      toast({ title: "Credential sealed 🔒", description: "This credential is now permanently locked." });
      await refreshCredential();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not seal this credential. Try again.",
        variant: "destructive",
      });
    } finally {
      setSealing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gradient-card rounded-2xl border border-border/60 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">Invalid QR Link</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!credData) return null;

  const cred = credData.credential;
  const student = credData.student;
  const ai = credData.ai_verdict;
  const status = cred.endorsement_status as string;
  const sealHash = cred.seal_hash as string | undefined;
  const githubLink = cred.github_link as string | undefined;

  // If the mentor isn't logged in, show a compact login gate first
  const isLoggedInMentor = user?.role === "mentor";

  // ── Endorsement gate logic ─────────────────────────────────────────
  const needsHumanCheckpoints = ai?.checkpoints?.filter((cp) => cp.status === "needs_human") ?? [];
  const allCheckpointsReviewed =
    needsHumanCheckpoints.length === 0 ||
    needsHumanCheckpoints.every((_, i) => reviewedCheckpoints.has(i));
  const githubGateOk = !githubLink || githubViewed;
  const canEndorse = allCheckpointsReviewed && githubGateOk;

  const missingReasons: string[] = [];
  if (!allCheckpointsReviewed) {
    missingReasons.push(
      `${needsHumanCheckpoints.length - reviewedCheckpoints.size} flagged item(s) not yet reviewed`
    );
  }
  if (!githubGateOk) missingReasons.push("GitHub repo not yet opened");

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Kredz · Mentor Review</p>
            <h1 className="font-display text-xl font-bold">Credential Verification</h1>
          </div>
        </div>

        {/* Credential card */}
        <div className="bg-gradient-card rounded-2xl border border-border/60 p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{cred.project_name as string}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">{student.name}</span> · {student.institution}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{cred.date as string} · {cred.type as string}</p>
            </div>
            <StatusPill status={status} />
          </div>

          <p className="text-sm text-muted-foreground">{cred.description as string}</p>

          {githubLink && (
            <a
              href={githubLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setGithubViewed(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                githubViewed
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-secondary hover:border-primary/30 hover:text-primary"
              }`}
            >
              <Code2 className="h-3 w-3" /> GitHub <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              {githubViewed && <CheckCircle2 className="h-3 w-3 ml-0.5" />}
            </a>
          )}

          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <code className="block text-[11px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
              SHA-256: {(cred.credential_hash as string)?.slice(0, 20)}…
            </code>
            {sealHash && (
              <code className="block text-[11px] font-mono text-accent bg-accent/10 px-2 py-1 rounded">
                🔒 Seal: {sealHash.slice(0, 20)}…
              </code>
            )}
          </div>
        </div>

        {/* AI Verdict panel */}
        {ai && (
          <AiVerdictPanel
            ai={ai}
            reviewedCheckpoints={reviewedCheckpoints}
            setReviewedCheckpoints={setReviewedCheckpoints}
          />
        )}

        {/* Login gate or Action panel */}
        {!isLoggedInMentor ? (
          <div className="bg-gradient-card rounded-2xl border border-border/60 p-6">
            <p className="text-sm font-semibold mb-4">Log in as mentor to approve or reject</p>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Log in & continue
              </Button>
            </form>
          </div>
        ) : status === "pending" ? (
          <div className="bg-gradient-card rounded-2xl border border-border/60 p-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">Your decision</p>
            <p className="text-sm text-muted-foreground">
              You are reviewing as <span className="font-semibold text-foreground">{(user as { email?: string }).email}</span>.
              Your endorsement will be recorded on-chain.
            </p>

            {!canEndorse && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
                <Lock className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-warning-foreground">Endorsement locked</p>
                  <ul className="text-xs text-muted-foreground mt-0.5 list-disc list-inside">
                    {missingReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handleEndorse("rejected")} disabled={acting}>
                <XCircle className="h-4 w-4 mr-1.5" /> Reject
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onClick={() => handleEndorse("approved")}
                disabled={acting || !canEndorse}
                title={!canEndorse ? "Review all flagged checkpoints and open GitHub first" : undefined}
              >
                {acting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : canEndorse ? (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                ) : (
                  <Lock className="h-4 w-4 mr-1.5" />
                )}
                Approve
              </Button>
            </div>
          </div>
        ) : status === "approved" && !sealHash ? (
          <div className="bg-gradient-card rounded-2xl border border-border/60 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <p className="text-sm font-semibold">This credential has been approved.</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Once you're confident, seal it — this permanently chains a mentor signature onto the credential hash.
            </p>
            <Button variant="accent" className="w-full" onClick={handleSeal} disabled={sealing}>
              {sealing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
              Seal Credential
            </Button>
          </div>
        ) : (
          <div className="bg-gradient-card rounded-2xl border border-border/60 p-5 flex items-center gap-3">
            {status === "approved"
              ? <Lock className="h-5 w-5 text-accent shrink-0" />
              : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
            <p className="text-sm font-semibold">
              {status === "approved" && sealHash
                ? <>This credential is <span className="text-accent">sealed</span> and permanently locked.</>
                : <>This credential has already been <span className="text-destructive">{status}</span>.</>}
            </p>
          </div>
        )}

        {/* Go to full dashboard */}
        {isLoggedInMentor && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/mentor")}>
            View all credentials in dashboard →
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 text-xs font-semibold">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/30 text-xs font-semibold">
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning-foreground border border-warning/30 text-xs font-semibold">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function AiVerdictPanel({
  ai,
  reviewedCheckpoints,
  setReviewedCheckpoints,
}: {
  ai: AiVerdict;
  reviewedCheckpoints: Set<number>;
  setReviewedCheckpoints: (s: Set<number>) => void;
}) {
  const verdictColor = {
    approve: "text-accent",
    reject:  "text-destructive",
    review:  "text-warning-foreground",
  }[ai.verdict] ?? "text-muted-foreground";

  const verdictBg = {
    approve: "bg-accent/10 border-accent/30",
    reject:  "bg-destructive/10 border-destructive/30",
    review:  "bg-warning/15 border-warning/30",
  }[ai.verdict] ?? "";

  const verdictLabel = {
    approve: "✓ Approve",
    reject:  "✗ Reject",
    review:  "⚠ Needs review",
  }[ai.verdict] ?? ai.verdict;

  const riskColor = {
    low:          "text-accent",
    medium:       "text-warning-foreground",
    high:         "text-destructive",
    not_provided: "text-muted-foreground",
  }[ai.github.plagiarism_risk] ?? "text-muted-foreground";

  return (
    <div className="bg-gradient-card rounded-2xl border border-border/60 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">AI Verification</p>
        <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-semibold ${verdictBg} ${verdictColor}`}>
          {verdictLabel}
        </span>
      </div>

      {/* Integrity score bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Integrity score</span>
          <span className="font-semibold text-foreground">{ai.integrity_score}/100</span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${ai.integrity_score >= 70 ? "bg-accent" : ai.integrity_score >= 40 ? "bg-warning" : "bg-destructive"}`}
            style={{ width: `${ai.integrity_score}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Confidence: {ai.confidence}%</p>
      </div>

      {/* AI Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed">{ai.summary}</p>

      {/* GitHub risk */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">GitHub plagiarism risk</span>
        <span className={`font-semibold capitalize ${riskColor}`}>{ai.github.plagiarism_risk.replace("_", " ")}</span>
      </div>

      {/* Checkpoints — needs_human items require explicit review before endorsing */}
      {ai.checkpoints && ai.checkpoints.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Checkpoints — review required before endorsing
          </p>
          {ai.checkpoints.map((cp, i) => {
            const isReviewed = reviewedCheckpoints.has(i);
            return (
              <label
                key={i}
                className={`flex items-start gap-2 py-1.5 px-2 -mx-2 rounded-lg cursor-pointer transition-colors ${
                  cp.status === "needs_human" && !isReviewed ? "bg-warning/5 hover:bg-warning/10" : ""
                }`}
              >
                {cp.status === "auto_cleared" ? (
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                ) : (
                  <input
                    type="checkbox"
                    checked={isReviewed}
                    onChange={(e) => {
                      const next = new Set(reviewedCheckpoints);
                      e.target.checked ? next.add(i) : next.delete(i);
                      setReviewedCheckpoints(next);
                    }}
                    className="h-4 w-4 mt-0.5 shrink-0 accent-orange-500 cursor-pointer"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {cp.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {cp.status === "auto_cleared" ? "— cleared by AI" : "— tap to confirm you've reviewed this"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{cp.reason}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Issues */}
      {[...ai.github.issues, ...ai.certificates.issues, ...ai.flags].filter(Boolean).length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</p>
          {[...ai.github.issues, ...ai.certificates.issues, ...ai.flags].map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
