import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, type Integration, type Transfer } from "../lib/api";
import { bytes } from "../lib/format";
import { Pins } from "./Cartridge";
import { ProviderIcon } from "./ProviderIcon";
import { cx, useToast } from "./ui";

const isRunning = (t: Transfer) => t.state !== "done" && t.state !== "error";

/** Server-side moves. Polls while any is running and refreshes the library when one lands. */
export function useTransfers({ notify = false } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["transfers"],
    queryFn: () => api<{ transfers: Transfer[] }>("/files/transfers"),
    refetchInterval: (q) => (q.state.data?.transfers.some(isRunning) ? 1000 : false),
  });
  const seen = useRef(new Map<string, Transfer["state"]>());
  useEffect(() => {
    if (!notify) return;
    for (const t of query.data?.transfers ?? []) {
      const before = seen.current.get(t.id);
      seen.current.set(t.id, t.state);
      if (!before || before === t.state || isRunning(t)) continue;
      if (t.state === "done") toast(`${t.name} agora está em ${t.toName}.`);
      else toast(`Não deu para mover ${t.name}: ${t.error}`, "error");
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [query.data, qc, toast, notify]);
  return query.data?.transfers ?? [];
}

export function useMove() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ fileId, integrationId, mode = "move" }: { fileId: string; integrationId: string; mode?: "move" | "copy" }) =>
      api<{ transfer: Transfer }>(`/files/${fileId}/move`, { method: "POST", json: { integrationId, mode } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["transfers"] }),
    onError: (e) => toast(e.message, "error"),
  });
}

export function useDestinations() {
  return useQuery({ queryKey: ["integrations"], queryFn: () => api<{ integrations: Integration[] }>("/integrations") });
}

/** Destination list for "Mover para". */
export function MoveTargets({
  exclude = [],
  onPick,
  disabled,
}: {
  exclude?: string[];
  onPick: (i: Integration) => void;
  disabled?: boolean;
}) {
  const destinations = useDestinations();
  const options = (destinations.data?.integrations ?? []).filter((i) => !exclude.includes(i.id) && i.status !== "pending");
  if (!options.length) return <p className="text-[13px] text-mute">Nenhum outro destino conectado.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((i) => (
        <button
          key={i.id}
          disabled={disabled}
          onClick={() => onPick(i)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-[13px] transition-colors hover:border-signal disabled:opacity-50"
        >
          <ProviderIcon type={i.type} className="size-4" />
          {i.name}
        </button>
      ))}
    </div>
  );
}

export function TransferProgress({ transfer: t, className }: { transfer: Transfer; className?: string }) {
  const progress = t.size ? t.copied / t.size : 0;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-3">
        <Pins progress={progress} active={t.state === "copying"} count={20} />
        <span className="data text-[11px]">{Math.floor(progress * 100)}%</span>
      </div>
      <p className="data text-[10.5px] text-mute">
        {t.state === "queued" && `Na fila para ${t.toName}`}
        {t.state === "copying" &&
          `${t.mode === "copy" ? "Copiando" : "Movendo"} para ${t.toName} · ${bytes(t.copied)} de ${bytes(t.size)}`}
        {t.state === "finishing" && `Finalizando em ${t.toName}`}
      </p>
    </div>
  );
}
