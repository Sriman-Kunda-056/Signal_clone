import { Users } from "lucide-react";

import { colorForId, initials } from "@/lib/format";

interface AvatarProps {
  id: number;
  name: string;
  size?: number;
  online?: boolean;
  isGroup?: boolean;
}

export function Avatar({ id, name, size = 40, online, isGroup }: AvatarProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-medium text-white"
        style={{ backgroundColor: colorForId(id), fontSize: size * 0.38 }}
      >
        {isGroup ? <Users style={{ width: size * 0.5, height: size * 0.5 }} /> : initials(name)}
      </div>
      {online !== undefined && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            borderColor: "var(--color-sidebar-bg)",
            backgroundColor: online ? "var(--color-online)" : "var(--color-text-muted)",
          }}
        />
      )}
    </div>
  );
}
