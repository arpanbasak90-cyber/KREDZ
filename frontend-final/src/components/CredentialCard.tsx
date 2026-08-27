import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Calendar, Code2, Briefcase, Trophy, ShieldCheck, ChevronDown, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeBadge, StatusBadge } from "@/components/CredentialBadges";
import { useToast } from "@/hooks/use-toast";
import { shortHash } from "@/lib/hash";
import type { Credential } from "@/lib/types";

// Always display in IST (Asia/Kolkata) regardless of viewer's browser timezone
function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}


export function CredentialCard({ credential }: { credential: Credential }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const verifyUrl = `${window.location.origin}/verify/${credential.hash}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with anyone to verify." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="bg-gradient-card rounded-2xl border border-border/60 hover:border-primary/30 hover:shadow-elegant transition-base overflow-hidden animate-fade-in">
      <div className="p-5 flex flex-col sm:flex-row gap-5">
        {/* QR */}
        <div className="shrink-0 self-start bg-white rounded-xl p-3 border border-border/60 shadow-sm">
          <QRCodeCanvas value={verifyUrl} size={96} level="M" fgColor="#0b1e4a" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg leading-tight truncate">{credential.projectName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> {credential.date} · {credential.studentInstitution}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <TypeBadge type={credential.type} />
              <StatusBadge status={credential.endorsementStatus} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{credential.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {credential.githubLink && <Pill icon={Code2} label="GitHub" href={credential.githubLink} />}
            {credential.linkedinLink && <Pill icon={Briefcase} label="LinkedIn" href={credential.linkedinLink} />}
            {credential.devfolioLink && <Pill icon={Trophy} label="Devfolio" href={credential.devfolioLink} />}
            {credential.digilockerVerified && <Pill icon={ShieldCheck} label="DigiLocker ✓" tone="accent" />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Hide details" : "Details"}
            </Button>
            <code className="ml-auto text-[11px] font-mono text-muted-foreground bg-secondary/70 px-2 py-1 rounded">
              {shortHash(credential.hash, 10)}
            </code>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-secondary/30 px-5 py-4 animate-fade-in">
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Detail label="Mentor">{credential.mentorName} · {credential.mentorEmail}</Detail>
            <Detail label="Submitted">{formatDate(credential.createdAt)}</Detail>
            {credential.endorsedAt && <Detail label="Endorsed at">{formatDate(credential.endorsedAt)}</Detail>}
            {credential.rejectionReason && <Detail label="Rejection note">{credential.rejectionReason}</Detail>}
            <Detail label="SHA-256">
              <code className="text-[11px] font-mono break-all">{credential.hash}</code>
            </Detail>
          </dl>
        </div>
      )}
    </article>
  );
}

function Pill({ icon: Icon, label, href, tone = "default" }: { icon: React.ElementType; label: string; href?: string; tone?: "default" | "accent" }) {
  const cls = tone === "accent"
    ? "bg-accent/10 text-accent border-accent/20"
    : "bg-secondary text-secondary-foreground border-border";
  const inner = (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${cls} hover:bg-secondary/70 transition-base`}>
      <Icon className="h-3 w-3" /> {label}
      {href && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : inner;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <dt className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
