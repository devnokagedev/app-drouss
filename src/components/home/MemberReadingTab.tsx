import AssignedList from "@/components/AssignedList";
import ReadingForm from "@/components/ReadingForm";

type Props = {
  onLogged: () => void;
};

export function MemberReadingTab({ onLogged }: Props) {
  return (
    <>
      <AssignedList />
      <section>
        <h2 className="font-display text-xl sm:text-2xl font-semibold mb-3 px-1">Enregistrer une lecture</h2>
        <p className="text-sm text-muted-foreground mb-4 px-1">
          Recherchez un khassida, indiquez combien de fois vous l&apos;avez lu ; la liste alimente les statistiques
          de votre section.
        </p>
        <ReadingForm onLogged={onLogged} />
      </section>
    </>
  );
}
