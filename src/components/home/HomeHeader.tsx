import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import type { AccessLevel } from "@/hooks/useAuth";

type Props = {
  fullName: string | null;
  sectionLabel: string | null;
  access: AccessLevel;
  onLogout: () => void;
};

export function HomeHeader({ fullName, sectionLabel, access, onLogout }: Props) {
  return (
    <header className="bg-gradient-primary text-primary-foreground px-4 sm:px-6 pt-8 pb-10 rounded-b-3xl shadow-elevated">
      <div className="flex items-start justify-between gap-3 max-w-7xl mx-auto">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest opacity-80">Dahira</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1">Assalamou aleykoum</h1>
          {fullName && <p className="text-sm opacity-90 mt-1 truncate">{fullName}</p>}
          {access === "member" && sectionLabel && (
            <p className="text-xs opacity-85 mt-2 truncate">
              Section : <span className="font-medium">{sectionLabel}</span>
            </p>
          )}
          {access === "super_admin" && (
            <span className="inline-flex items-center gap-1 mt-3 text-xs bg-accent/90 text-accent-foreground px-2.5 py-1 rounded-full font-medium">
              <ShieldCheck className="h-3 w-3 shrink-0" /> Super administrateur
            </span>
          )}
          {access === "diwane_admin" && (
            <span className="inline-flex items-center gap-1 mt-3 text-xs bg-accent/90 text-accent-foreground px-2.5 py-1 rounded-full font-medium">
              <Users className="h-3 w-3 shrink-0" /> Admin de section
            </span>
          )}
          {access === "platform_admin" && (
            <span className="inline-flex items-center gap-1 mt-3 text-xs bg-accent/90 text-accent-foreground px-2.5 py-1 rounded-full font-medium">
              <ShieldCheck className="h-3 w-3 shrink-0" /> Administrateur
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground shrink-0 touch-manipulation min-h-[44px] min-w-[44px]"
          aria-label="Se déconnecter"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
