import { useState } from "react";
import { Loader2, Sparkles, Code2, Briefcase, Trophy, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { StudentUser } from "@/lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Backend accepts these exact strings
const TYPES = ["Project", "Internship", "Hackathon", "Research", "Coursework"] as const;
type CredentialType = (typeof TYPES)[number];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentUser;
  onSubmitted: () => void;
}

const EMPTY_FORM = {
  projectName: "",
  type: "Project" as CredentialType,
  description: "",
  date: new Date().toISOString().slice(0, 10),
  githubLink: "",
  linkedinLink: "",
  devfolioLink: "",
  digilockerVerified: false,
  mentorName: "",
  mentorEmail: "",
};

export function SubmitCredentialDialog({ open, onOpenChange, student, onSubmitted }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName.trim() || !form.description.trim()) {
      toast({ title: "Missing info", description: "Project name and description are required.", variant: "destructive" });
      return;
    }
    if (!form.mentorName.trim() || !form.mentorEmail.trim()) {
      toast({ title: "Mentor required", description: "Add your mentor's name and email so they can endorse.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("student_id", student.id);
      fd.append("student_name", student.fullName);
      fd.append("project_name", form.projectName.trim());
      fd.append("type", form.type);
      fd.append("description", form.description.trim());
      fd.append("institution", student.institution);
      fd.append("date", form.date);
      fd.append("email", student.email);
      if (form.githubLink.trim()) fd.append("github_link", form.githubLink.trim());
      if (form.mentorName.trim()) fd.append("endorser_name", form.mentorName.trim());
      if (form.mentorEmail.trim()) fd.append("endorser_email", form.mentorEmail.trim().toLowerCase());

      const res = await fetch(`${API}/api/submit`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Submission failed");
      }

      toast({
        title: "Credential sealed! 🔒",
        description: "Your mentor has been notified via email to verify it.",
      });
      onSubmitted();
      onOpenChange(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-gradient-primary p-2 rounded-lg shadow-md">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <DialogTitle className="font-display text-2xl">Add a credential</DialogTitle>
          </div>
          <DialogDescription>
            Seal a project, internship or win with SHA-256. Your mentor will be emailed to verify it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pname">Project / Credential name *</Label>
              <Input id="pname" value={form.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="Binary Tree Implementation" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v as CredentialType)}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description *</Label>
            <Textarea id="desc" rows={3} maxLength={500} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What did you build? What problem did it solve?" required />
            <p className="text-[11px] text-muted-foreground text-right">{form.description.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Completion date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
          </div>

          <fieldset className="space-y-3 border border-border/60 rounded-xl p-4 bg-secondary/30">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Evidence links</legend>
            <LinkInput icon={Code2}     label="GitHub repository"   value={form.githubLink}   onChange={(v) => update("githubLink", v)}   placeholder="https://github.com/you/repo" />
            <LinkInput icon={Briefcase} label="LinkedIn profile"    value={form.linkedinLink} onChange={(v) => update("linkedinLink", v)} placeholder="https://linkedin.com/in/you" />
            <LinkInput icon={Trophy}    label="Devfolio submission" value={form.devfolioLink} onChange={(v) => update("devfolioLink", v)} placeholder="https://devfolio.co/projects/..." />
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <Label htmlFor="dl" className="flex items-center gap-2 cursor-pointer">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>DigiLocker verified</span>
              </Label>
              <Switch id="dl" checked={form.digilockerVerified} onCheckedChange={(v) => update("digilockerVerified", v)} />
            </div>
          </fieldset>

          <fieldset className="space-y-3 border border-border/60 rounded-xl p-4 bg-secondary/30">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Mentor endorsement</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mname">Mentor name *</Label>
                <Input id="mname" value={form.mentorName} onChange={(e) => update("mentorName", e.target.value)} placeholder="Prof. Anjali Rao" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memail">Mentor email *</Label>
                <Input id="memail" type="email" value={form.mentorEmail} onChange={(e) => update("mentorEmail", e.target.value)} placeholder="anjali@iitb.ac.in" required />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your mentor will receive an email with a QR code and a link to review this credential in their Kredz dashboard.
            </p>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" variant="hero" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Seal credential
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkInput({ icon: Icon, label, value, onChange, placeholder }: { icon: React.ElementType; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-sm">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
      </Label>
      <Input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
