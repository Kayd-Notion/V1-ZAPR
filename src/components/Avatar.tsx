import { avColor, initials } from "@/lib/format";

export function Avatar({
  id,
  handle,
  size = "",
  anonymous = false,
}: {
  id: string;
  handle: string;
  size?: "" | "sm" | "lg";
  anonymous?: boolean;
}) {
  if (anonymous) {
    return (
      <div className={`avatar ${size}`.trim()} style={{ background: "var(--text-faint)" }}>
        🕶️
      </div>
    );
  }
  return (
    <div className={`avatar ${size}`.trim()} style={{ background: avColor(id) }}>
      {initials(handle)}
    </div>
  );
}
