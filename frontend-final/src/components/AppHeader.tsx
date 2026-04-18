import { Link, NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, LayoutDashboard, GraduationCap, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-accent rounded-lg blur-md opacity-60 group-hover:opacity-100 transition-base" />
            <div className="relative bg-gradient-primary p-2 rounded-lg shadow-md">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-lg tracking-tight">Kredz</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Verified Forever</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {!user && (
            <>
              <RouterNavLink to="/" end className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-base ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
              }>
                Home
              </RouterNavLink>
              <RouterNavLink to="/login" className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-base ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
              }>
                Login
              </RouterNavLink>
            </>
          )}
          {user?.role === "student" && (
            <RouterNavLink to="/student" className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-base ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`
            }>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </RouterNavLink>
          )}
          {user?.role === "mentor" && (
            <RouterNavLink to="/mentor" className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-base ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`
            }>
              <UserCog className="h-4 w-4" /> Mentor Console
            </RouterNavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" variant="hero">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/70">
                {user.role === "student" ? (
                  <GraduationCap className="h-4 w-4 text-primary" />
                ) : (
                  <UserCog className="h-4 w-4 text-accent" />
                )}
                <span className="text-xs font-semibold">{user.fullName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Logout</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
