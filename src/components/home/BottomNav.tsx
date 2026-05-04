import type { ReactNode } from "react";
import { BookOpen, ListChecks, ShieldCheck } from "lucide-react";
import type { AccessLevel } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Tab = "log" | "mine" | "admin";

type Props = {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  access: AccessLevel;
};

export function BottomNav({ tab, onTabChange, access }: Props) {
  const showAdmin = access !== "member";

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-sm border-t border-border safe-bottom z-50">
      <div
        className={cn(
          "mx-auto grid max-w-7xl w-full",
          showAdmin ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <NavBtn
          active={tab === "log"}
          onClick={() => onTabChange("log")}
          icon={<BookOpen className="h-5 w-5" />}
          label="Lire"
        />
        <NavBtn
          active={tab === "mine"}
          onClick={() => onTabChange("mine")}
          icon={<ListChecks className="h-5 w-5" />}
          label="Mes lectures"
        />
        {showAdmin && (
          <NavBtn
            active={tab === "admin"}
            onClick={() => onTabChange("admin")}
            icon={<ShieldCheck className="h-5 w-5" />}
            label={access === "super_admin" ? "Structure" : "Admin"}
          />
        )}
      </div>
    </nav>
  );
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-3 min-h-[52px] transition-colors touch-manipulation",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      <span className="text-[11px] sm:text-xs font-medium leading-tight text-center px-1">{label}</span>
    </button>
  );
}
