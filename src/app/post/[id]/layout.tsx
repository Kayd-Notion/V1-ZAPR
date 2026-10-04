import type { Metadata } from "next";
import { getStore } from "@/lib/db";

/**
 * Server-side title and description of a post's page, so a link shared on
 * X / Telegram / Discord shows the post itself (its preview image is
 * opengraph-image.tsx next to this file).
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getStore()
    .getPost(id)
    .catch(() => null);
  if (!post) return { title: "Post not found" };
  const text = post.text.length > 160 ? `${post.text.slice(0, 157)}…` : post.text;
  const title = `@${post.author.handle} on ZAPR`;
  return {
    title,
    description: text,
    openGraph: { type: "article", title, description: text },
    twitter: { card: "summary_large_image", title, description: text },
  };
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
