import { Ghost } from "lucide-react";
import { avColor, initials } from "@/lib/format";

export function Avatar({
  id,
  handle,
  size = "",
  anonymous = false,
}: {
  id: string;
  handle: string;
  size?: "" | "xs" | "sm" | "lg";
  anonymous?: boolean;
}) {
  if (anonymous) {
    return (
      <div className={`avatar anon ${size}`.trim()} aria-label="Anonymous">
        <Ghost />
      </div>
    );
  }
  return (
    <div className={`avatar ${size}`.trim()} style={{ background: avColor(id) }}>
      {initials(handle)}
    </div>
  );
}
