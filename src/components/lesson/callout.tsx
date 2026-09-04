export function Callout({
  kind = "tip",
  title,
  children,
}: {
  kind?: "tip" | "info" | "warn";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = { tip: "bg-yellow", info: "bg-blue", warn: "bg-pink" }[kind];
  const defaultTitle = { tip: "Consejo", info: "Nota", warn: "Ojo" }[kind];
  return (
    <aside className={`card-pastel ${styles} px-5 py-4 text-sm leading-relaxed`}>
      <strong className="block mb-1">{title ?? defaultTitle}</strong>
      <div className="text-ink-2">{children}</div>
    </aside>
  );
}
