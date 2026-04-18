import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldX, ArrowLeft, Calendar, Code2, Briefcase, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/storage";
import { TypeBadge, StatusBadge } from "@/components/CredentialBadges";

export default function VerifyPage() {
  const { hash } = useParams<{ hash: string }>();
  const credential = useMemo(() => store.getCredentials().find((c) => c.hash === hash), [hash]);

  if (!credential) {
    return (
      <div className="container max-w-2xl py-16">
        <Verdict tone="unknown" title="Credential not found" subtitle="No credential matches this verification link." />
        <BackHome />
      </div>
    );
  }

  // Tampered detection: in this frontend-only demo, all stored creds are valid.
  // We expose `?tamper=1` to demonstrate the rejected verdict on stage.
  const tampered = new URLSearchParams(window.location.search).get("tamper") === "1";

  return (
    <div className="container max-w-2xl py-10">
      <Verdict
        tone={tampered ? "tampered" : "verified"}
        title={tampered ? "Credential TAMPERED" : "Credential VERIFIED"}
        subtitle={tampered ? "Warning: this credential has been altered since it was sealed." : "This credential has not been tampered with."}
      />

      <article className="bg-gradient-card rounded-2xl border border-border/60 p-6 mt-6 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{credential.projectName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{credential.studentName}</span> · {credential.studentInstitution}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Completed {credential.date}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TypeBadge type={credential.type} />
            <StatusBadge status={credential.endorsementStatus} />
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed mb-5">{credential.description}</p>

        <div className="flex flex-wrap gap-2 mb-5">
          {credential.githubLink && <Evidence icon={Code2} label="GitHub" href={credential.githubLink} />}
          {credential.linkedinLink && <Evidence icon={Briefcase} label="LinkedIn" href={credential.linkedinLink} />}
          {credential.devfolioLink && <Evidence icon={Trophy} label="Devfolio" href={credential.devfolioLink} />}
          {credential.digilockerVerified && <Evidence icon={ShieldCheck} label="DigiLocker ✓" tone="accent" />}
        </div>

        <div className="border-t border-border/60 pt-4 grid sm:grid-cols-2 gap-4 text-sm">
          <Detail label="Mentor">{credential.mentorName}</Detail>
          <Detail label="Sealed at">{new Date(credential.createdAt).toLocaleString()}</Detail>
          <div className="sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">SHA-256 hash</p>
            <code className="text-xs font-mono break-all bg-secondary/70 px-3 py-2 rounded-lg block">{credential.hash}</code>
          </div>
        </div>
      </article>

      <BackHome />
    </div>
  );
}

function Verdict({ tone, title, subtitle }: { tone: "verified" | "tampered" | "unknown"; title: string; subtitle: string }) {
  const map = {
    verified: { Icon: ShieldCheck, cls: "bg-gradient-accent text-accent-foreground shadow-accent-glow" },
    tampered: { Icon: ShieldX, cls: "bg-destructive text-destructive-foreground shadow-elegant" },
    unknown: { Icon: ShieldAlert, cls: "bg-muted text-muted-foreground" },
  } as const;
  const { Icon, cls } = map[tone];
  return (
    <div className={`rounded-3xl p-8 text-center animate-scale-in ${cls}`}>
      <Icon className="h-14 w-14 mx-auto mb-3" strokeWidth={2} />
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{title}</h1>
      <p className="opacity-90">{subtitle}</p>
    </div>
  );
}

function Evidence({ icon: Icon, label, href, tone = "default" }: { icon: React.ElementType; label: string; href?: string; tone?: "default" | "accent" }) {
  const cls = tone === "accent"
    ? "bg-accent/10 text-accent border-accent/20"
    : "bg-secondary text-secondary-foreground border-border";
  const inner = <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cls}`}><Icon className="h-3.5 w-3.5" /> {label}</span>;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a> : inner;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">{label}</p>
      <p>{children}</p>
    </div>
  );
}

function BackHome() {
  return (
    <div className="text-center mt-8">
      <Button asChild variant="ghost">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Kredz</Link>
      </Button>
    </div>
  );
}
