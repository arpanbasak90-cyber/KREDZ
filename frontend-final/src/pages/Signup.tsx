import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, UserCog, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const location = useLocation();
  const initialRole = (new URLSearchParams(location.search).get("role") as "student" | "mentor") || "student";
  const [role, setRole] = useState<"student" | "mentor">(initialRole);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    institution: "",
    contactNumber: "",
    avatarDataUrl: "" as string | undefined,
  });
  const { signupStudent, signupMentor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleAvatar = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please upload an image under 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("avatarDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (role === "student") {
        await signupStudent({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          institution: form.institution.trim(),
        });
        toast({ title: "Account created!", description: "Welcome to Kredz." });
        navigate("/student");
      } else {
        await signupMentor({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          institution: form.institution.trim(),
          contactNumber: form.contactNumber.trim(),
          avatarDataUrl: form.avatarDataUrl,
        });
        toast({ title: "Mentor account created!", description: "You can now verify student credentials." });
        navigate("/mentor");
      }
    } catch (err) {
      toast({
        title: "Signup failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={role === "student" ? "Start building a verified portfolio" : "Help students prove their work"}
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setRole("student")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-base ${
            role === "student" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4" /> Student
        </button>
        <button
          type="button"
          onClick={() => setRole("mentor")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-base ${
            role === "mentor" ? "bg-background shadow-sm text-accent" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCog className="h-4 w-4" /> Mentor
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Aarav Sharma" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">{role === "mentor" ? "College / Institution" : "Institution"}</Label>
          <Input id="institution" required value={form.institution} onChange={(e) => update("institution", e.target.value)} placeholder="IIT Bombay" />
        </div>

        {role === "mentor" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact number</Label>
              <Input id="contact" required type="tel" value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value)} placeholder="+91 98765 43210" />
            </div>

            <div className="space-y-2">
              <Label>Profile picture <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {form.avatarDataUrl ? (
                    <img src={form.avatarDataUrl} alt="Mentor avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCog className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="flex-1 cursor-pointer">
                  <div className="border border-dashed border-border rounded-lg px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-base flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {form.avatarDataUrl ? "Replace photo" : "Upload photo"}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)} />
                </label>
                {form.avatarDataUrl && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => update("avatarDataUrl", undefined)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" />
        </div>

        <Button type="submit" className="w-full" variant={role === "student" ? "hero" : "accent"} size="lg" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${role} account`}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{" "}
        <Link to={`/login?role=${role}`} className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
