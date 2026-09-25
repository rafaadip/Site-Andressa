type Item = { onde: string; papel: string; quando: string };

export function ListaTrajetoria({ titulo, itens }: { titulo: string; itens: readonly Item[] }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="eyebrow">{titulo}</h2>
      <ol className="mt-4 border-t border-borda">
        {itens.map((t) => (
          <li key={t.onde + t.papel} className="grid gap-1 py-4 border-b border-borda md:grid-cols-[1fr_auto] md:gap-8">
            <div>
              <p className="font-medium text-texto">{t.onde}</p>
              <p className="text-sm text-texto-2">{t.papel}</p>
            </div>
            {t.quando && <p className="text-sm text-texto-2 tabular md:text-right">{t.quando}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
