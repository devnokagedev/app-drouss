import { SuperAdminTabs } from "./SuperAdminTabs"

export function SuperAdminPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">
        Créez les sections (diwanes), nommez-les et désignez un ou plusieurs administrateurs de section.
        Les membres s&apos;inscrivent en choisissant une section ; chaque admin ne voit que les lectures de
        sa section.
      </p>
      <SuperAdminTabs />
    </div>
  );
}

