import { Badge } from "@/components/ui/badge";
import type { CredentialType, EndorsementStatus } from "@/lib/types";

export function TypeBadge({ type }: { type: CredentialType }) {
  const map: Record<CredentialType, string> = {
    Project: "bg-primary/10 text-primary border-primary/20",
    Internship: "bg-accent/10 text-accent border-accent/20",
    "Hackathon Win": "bg-warning/15 text-warning-foreground border-warning/30",
    Research: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    Coursework: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={`${map[type]} font-semibold`}>{type}</Badge>;
}

export function StatusBadge({ status }: { status: EndorsementStatus }) {
  if (status === "approved")
    return <Badge className="bg-accent/15 text-accent hover:bg-accent/15 border border-accent/30">✓ Endorsed</Badge>;
  if (status === "pending")
    return <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/15 border border-warning/30">⏳ Pending</Badge>;
  if (status === "rejected")
    return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border border-destructive/30">✕ Rejected</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">No mentor</Badge>;
}
