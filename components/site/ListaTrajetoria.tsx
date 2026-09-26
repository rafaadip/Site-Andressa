type Item = { onde: string; papel: string; quando: string };

export function ListaTrajetoria({ titulo, itens }: { titulo: string; itens: readonly Item[] }) {
  return (
    <section data-revelar className="mt-14 first:mt-0">
      <h2 className="eyebrow eyebrow-fio">{titulo}</h2>
      <ol className="mt-5 border-t border-borda">
        {itens.map((t) => (
          <li key={t.onde + t.papel} className="grid gap-1 py-5 border-b border-borda md:grid-cols-[1fr_auto] md:gap-8">
            <div>
              <p className="font-medium text-texto">{t.onde}</p>
              <p className="mt-0.5 text-sm text-texto-2">{t.papel}</p>
            </div>
            {t.quando && <p className="text-sm text-texto-2 tabular md:pt-0.5 md:text-right">{t.quando}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
