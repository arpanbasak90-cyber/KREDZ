import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const location = useLocation();
  const initialRole = (new URLSearchParams(location.search).get("role") as "student" | "mentor") || "student";
  const [role, setRole] = useState<"student" | "mentor">(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginStudent, loginMentor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (role === "student") {
        await loginStudent(email, password);
        toast({ title: "Welcome back!", description: "Logged in as student." });
        navigate("/student");
      } else {
        await loginMentor(email, password);
        toast({ title: "Welcome back!", description: "Logged in as mentor." });
        navigate("/mentor");
      }
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Kredz account">
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
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>

        <Button type="submit" className="w-full" variant={role === "student" ? "hero" : "accent"} size="lg" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Sign in as ${role}`}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        Don't have an account?{" "}
        <Link to={`/signup?role=${role}`} className="font-semibold text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
