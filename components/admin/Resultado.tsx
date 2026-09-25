import { CircleCheck, TriangleAlert } from 'lucide-react';

/** Retorno de uma ação: sucesso anunciado (status) ou erro (alert). */
export function Resultado({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  if (estado.erro) {
    return (
      <p role="alert" className="mt-3 flex gap-2 text-sm text-danger">
        <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />{estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="mt-3 flex gap-2 text-sm text-success">
        <CircleCheck aria-hidden size={18} className="mt-0.5 shrink-0" />{estado.ok}
      </p>
    );
  }
  return null;
}
