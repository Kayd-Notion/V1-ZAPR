import Link from "next/link";
import { ZaprEmpty } from "@/components/ZaprMark";

export default function NotFound() {
  return (
    <ZaprEmpty title="This page zapped out.">
      <span>It doesn&apos;t exist, or it expired.</span>
      <Link href="/" className="btn btn-primary">
        Back to the feed
      </Link>
    </ZaprEmpty>
  );
}
