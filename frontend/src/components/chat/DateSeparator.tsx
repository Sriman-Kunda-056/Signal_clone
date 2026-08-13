import { dateSeparatorLabel } from "@/lib/format";

/** Signal renders date dividers as plain centered text — no pill/chip. */
export function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {dateSeparatorLabel(iso)}
      </span>
    </div>
  );
}
