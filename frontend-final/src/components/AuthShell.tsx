import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-hero text-primary-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative flex flex-col justify-between w-full">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="bg-white/15 backdrop-blur p-2 rounded-lg">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-xl">Kredz</span>
          </Link>

          <div className="max-w-md animate-fade-in-up">
            <h2 className="font-display text-4xl xl:text-5xl font-bold leading-tight mb-4">
              Your work.<br />
              <span className="text-accent-glow">Proven. Forever.</span>
            </h2>
            <p className="text-primary-foreground/80 text-lg">
              Cryptographically sealed credentials. Mentor-endorsed. Verified by anyone, anywhere — in seconds.
            </p>
          </div>

          <p className="text-xs text-primary-foreground/60 font-mono">© Kredz · SHA-256 · 2026</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md animate-fade-in">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="bg-gradient-primary p-2 rounded-lg shadow-md">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg">Kredz</span>
          </Link>

          <h1 className="font-display text-3xl font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground mb-8">{subtitle}</p>}

          {children}
        </div>
      </div>
    </div>
  );
}
