import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="border-t border-border/60 mt-24 bg-secondary/40">
      <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Kredz</span> · Your work. Proven. Forever.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kredz · Hackathon MVP · Frontend demo
        </p>
      </div>
    </footer>
  );
}
