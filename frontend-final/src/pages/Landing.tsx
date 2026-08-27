import { Link } from "react-router-dom";
import { ShieldCheck, QrCode, Sparkles, Code2, Briefcase, Trophy, GraduationCap, ArrowRight, CheckCircle2, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-shield.jpg";

const features = [
  { icon: Lock, title: "SHA-256 Sealed", desc: "Every credential is cryptographically hashed the moment you submit it. Tampering is mathematically detectable." },
  { icon: QrCode, title: "Verify in 5 seconds", desc: "Anyone scans the QR — no app, no login. Instant ✅ Verified or ❌ Tampered verdict." },
  { icon: GraduationCap, title: "Mentor Endorsement", desc: "Your professor, supervisor, or hackathon organiser co-signs with a single click." },
  { icon: Sparkles, title: "AI NextStep", desc: "After every submission, get personalised skill gaps and free NPTEL / YouTube / Coursera courses." },
];

const integrations = [
  { icon: Code2, label: "GitHub" },
  { icon: Briefcase, label: "LinkedIn" },
  { icon: Trophy, label: "Devfolio" },
  { icon: ShieldCheck, label: "DigiLocker" },
];

export default function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh pointer-events-none" />
        <div className="container relative pt-16 pb-20 md:pt-24 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Hackathon MVP · Live Demo</span>
              </div>

              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6">
                Your work.
                <br />
                <span className="text-gradient-hero">Proven. Forever.</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed">
                Kredz is a tamper-proof credential portfolio for students. Cryptographically seal every project, internship and hackathon win — verified by employers in seconds.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button asChild variant="hero" size="xl">
                  <Link to="/signup?role=student">
                    I'm a Student
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="accent" size="xl">
                  <Link to="/signup?role=mentor">
                    I'm a Mentor
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> No setup fees</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Free for students</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Privacy first</span>
              </div>
            </div>

            <div className="relative animate-scale-in">
              <div className="absolute -inset-8 bg-gradient-accent opacity-20 blur-3xl rounded-full" />
              <div className="relative rounded-3xl overflow-hidden shadow-elegant border border-border/50 animate-float">
                <img
                  src={heroImage}
                  alt="Kredz emerald shield representing tamper-proof verification"
                  width={1536}
                  height={1024}
                  className="w-full h-auto"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 glass rounded-2xl px-5 py-4 shadow-elegant hidden md:flex items-center gap-3 animate-fade-in" style={{ animationDelay: "0.4s" }}>
                <div className="bg-gradient-accent p-2 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">SHA-256 verified</p>
                  <p className="text-sm font-semibold">a3f2d1…verified ✓</p>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 glass rounded-2xl px-5 py-4 shadow-elegant hidden md:flex items-center gap-3 animate-fade-in" style={{ animationDelay: "0.6s" }}>
                <Zap className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Verification time</p>
                  <p className="text-sm font-semibold">&lt; 5 seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">How Kredz works</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Built for the work behind the degree.
          </h2>
          <p className="text-muted-foreground text-lg">
            DigiLocker holds your degree. Kredz holds everything that proves you deserved it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative bg-gradient-card rounded-2xl p-6 border border-border/60 hover:border-primary/30 hover:shadow-elegant transition-base animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-md group-hover:shadow-glow transition-base">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="container py-16">
        <div className="rounded-3xl bg-gradient-hero p-10 md:p-14 text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="font-display text-3xl md:text-4xl font-bold mb-3">
                Link everything you've built.
              </h3>
              <p className="text-primary-foreground/80 text-lg leading-relaxed">
                Attach your GitHub repo, LinkedIn profile, Devfolio hackathon page and DigiLocker proofs to every credential. One QR code. All evidence in one place.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {integrations.map((i) => (
                <div key={i.label} className="glass-dark rounded-xl p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <i.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold">{i.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
          Ready to <span className="text-gradient-primary">prove your work</span>?
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Create your free account in under a minute. Add your first credential and share a verified QR code with any employer.
        </p>
        <Button asChild variant="hero" size="xl">
          <Link to="/signup">
            Start your portfolio
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </section>
    </>
  );
}
