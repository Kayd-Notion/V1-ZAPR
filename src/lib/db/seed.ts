/**
 * Seed dataset, adapted from MVP.html §B (mock data) into the real domain model.
 * Used by the file-backed dev store and by the Postgres seed script so the feed
 * is never empty during development (guide §Marketing: "un feed vide fait fuir").
 */
import type { Comment, Post, Pump, User } from "./types";

const H = 3600_000;

export function buildSeed(now: number = Date.now()): {
  users: User[];
  posts: Post[];
  comments: Comment[];
  pumps: Pump[];
} {
  const mkUser = (
    id: string,
    handle: string,
    wallet: string,
    bio: string,
    country: string,
    received: number,
    given: number,
  ): User => ({
    id,
    handle,
    wallet,
    bio,
    country,
    createdAt: now - 30 * 24 * H,
    received,
    given,
    zapped: 0,
    hidePumpHistory: false,
    anonymizePumps: false,
  });

  const users: User[] = [
    mkUser("u1", "satoshi_fan", "7xKp9aQ2Rt4mNvBc1sD8fGhJkLwXyZ0pQ93Qw", "Solana maxi. I zap what deserves it. ⚡", "FR", 142.7, 38.2),
    mkUser("u2", "crypto_lea", "3mNv8sD1fGh7JkLwXyZ0pQ2Rt4aQ9Kp5bC2xY", "NFT artist & part-time degen.", "US", 98.4, 64.1),
    mkUser("u3", "devSol", "9pQ2Rt4mNvBc1sD8fGhJkLwXyZ0aQ7xKp3nH1", "Building on Solana. gm.", "JP", 210.3, 12.9),
    mkUser("u4", "moon_hana", "5bC2xY7xKp9aQ2Rt4mNvBc1sD8fGhJkLw0pQ9", "To the moon, calmly. 🌙", "BR", 76.0, 88.5),
    mkUser("u5", "ghostwhale", "1sD8fGhJkLwXyZ0pQ2Rt4mNvBc7xKp9aQ93Qw", "On-chain, off-radar.", "FR", 305.9, 150.4),
    mkUser("u6", "pixelzap", "2Rt4mNvBc1sD8fGhJkLwXyZ0pQ7xKp9aQ5bC2", "Pixel art & memes. Zap-friendly.", "US", 54.2, 29.8),
    mkUser("u7", "zk_marie", "8fGhJkLwXyZ0pQ2Rt4mNvBc1sD7xKp9aQ3nH1", "Privacy first. ZK enthusiast.", "JP", 120.6, 45.0),
  ];

  type SeedPost = [string, string, string, number, number, number, string, string[], ("image" | "video")?];
  // id, userId, text, hoursAgo, pumped, comments baked below
  const raw: {
    id: string;
    userId: string;
    text: string;
    hoursAgo: number;
    pumped: number;
    comments: number;
    country: string;
    tags: string[];
    mediaType?: "image" | "video";
  }[] = [
    { id: "p1", userId: "u5", text: "The community pot just passed 1000 SOL. We're building something crazy. 🐋", hoursAgo: 2, pumped: 48.6, comments: 14, country: "FR", tags: ["#solana", "#pump"] },
    { id: "p2", userId: "u2", text: "New generative art drop tonight. The first 3 zaps get whitelist access. 🎨", hoursAgo: 5, pumped: 31.2, comments: 8, country: "US", tags: ["#nft", "#art"], mediaType: "image" },
    { id: "p3", userId: "u3", text: "Shipped the ZAPR SDK in 3 days. Code goes open source next week. gm 🛠️", hoursAgo: 1, pumped: 22.9, comments: 21, country: "JP", tags: ["#dev", "#build"] },
    { id: "p4", userId: "u1", text: "Reminder: a post lives at least 24h, and every zap extends its life. No cap. 🕒", hoursAgo: 8, pumped: 64.1, comments: 30, country: "FR", tags: ["#tuto"] },
    { id: "p5", userId: "u4", text: "Quick timelapse of my trading setup 🌙", hoursAgo: 12, pumped: 9.4, comments: 5, country: "BR", tags: ["#trading"], mediaType: "video" },
    { id: "p6", userId: "u6", text: "Meme of the day: when your post hits the top 30 while you sleep. 😴📈", hoursAgo: 3, pumped: 18.7, comments: 12, country: "US", tags: ["#meme"], mediaType: "image" },
    { id: "p7", userId: "u7", text: "On-chain privacy isn't optional. Here's why ZAPR anonymizes zap history. 🔒", hoursAgo: 20, pumped: 40.3, comments: 19, country: "JP", tags: ["#privacy", "#zk"] },
    { id: "p8", userId: "u2", text: "Thanks for all the zaps yesterday 🙏 Running it back today, harder.", hoursAgo: 26, pumped: 14.0, comments: 6, country: "US", tags: [] },
    { id: "p9", userId: "u5", text: "Heads up: this post expires soon. Zap it if you want to keep it alive. ⏳", hoursAgo: 23, pumped: 5.1, comments: 3, country: "FR", tags: ["#pump"] },
    { id: "p10", userId: "u3", text: "Quick poll: which feature do you want first on ZAPR?", hoursAgo: 6, pumped: 11.8, comments: 24, country: "JP", tags: ["#feedback"] },
    { id: "p11", userId: "u1", text: "The by-country leaderboard is live 🇫🇷🇺🇸🇯🇵🇧🇷. See where you rank.", hoursAgo: 4, pumped: 27.5, comments: 11, country: "FR", tags: ["#leaderboard"], mediaType: "image" },
    { id: "p12", userId: "u4", text: "GM to all the degens. May your zaps be green today. 🟢", hoursAgo: 0.5, pumped: 3.2, comments: 1, country: "BR", tags: ["#gm"] },
    { id: "p13", userId: "u6", text: "New pixel sticker pack for the community. One zap = instant access.", hoursAgo: 15, pumped: 20.0, comments: 9, country: "US", tags: ["#art", "#community"], mediaType: "image" },
    // Older posts (already expired) so 24h / 7 days / 30 days / all-time
    // leaderboards differ in the demo. Their pumps are dated in the past below.
    { id: "p14", userId: "u4", text: "Weekly recap: thanks for the zaps on my setup 🌙", hoursAgo: 72, pumped: 18.0, comments: 4, country: "BR", tags: ["#recap"] },
    { id: "p15", userId: "u7", text: "Thread: why ZK will change everything for on-chain social. 🧵", hoursAgo: 120, pumped: 7.5, comments: 9, country: "JP", tags: ["#zk", "#thread"] },
    { id: "p16", userId: "u3", text: "First commit of the ZAPR SDK. It starts here. 🛠️", hoursAgo: 480, pumped: 15.0, comments: 12, country: "JP", tags: ["#dev"] },
    { id: "p17", userId: "u2", text: "My very first NFT collection is live 🎨", hoursAgo: 1080, pumped: 9.0, comments: 6, country: "US", tags: ["#nft"] },
  ];

  const posts: Post[] = raw.map((p) => ({
    id: p.id,
    userId: p.userId,
    text: p.text,
    mediaUrl: p.mediaType ? placeholderMedia(p.id, p.mediaType) : null,
    mediaType: p.mediaType ?? null,
    createdAt: now - p.hoursAgo * H,
    pumped: p.pumped,
    comments: p.comments,
    country: p.country,
    tags: p.tags,
  }));

  const comments: Comment[] = [
    { id: "c1", postId: "p1", userId: "u2", text: "Insane, congrats 🔥", createdAt: now - 1 * H },
    { id: "c2", postId: "p1", userId: "u3", text: "We build! gm", createdAt: now - 1.5 * H },
    { id: "c3", postId: "p1", userId: "u6", text: "Zapped without a second thought ⚡", createdAt: now - 0.5 * H },
    { id: "c4", postId: "p3", userId: "u1", text: "Can't wait to see the repo 👀", createdAt: now - 0.8 * H },
    { id: "c5", postId: "p3", userId: "u7", text: "Does the SDK handle privacy?", createdAt: now - 0.6 * H },
  ];

  const pumps: Pump[] = [];
  // A deterministic set of pumpers for a few posts, so detail pages look alive.
  const pumperTemplate: { userId: string; amount: number; hoursAgo: number }[] = [
    { userId: "u5", amount: 12.0, hoursAgo: 1 },
    { userId: "u1", amount: 6.5, hoursAgo: 2 },
    { userId: "u3", amount: 4.0, hoursAgo: 3 },
    { userId: "u6", amount: 2.2, hoursAgo: 4 },
    { userId: "u2", amount: 1.0, hoursAgo: 5 },
  ];
  let seq = 0;
  const addPump = (postId: string, pumperUserId: string, amount: number, hoursAgo: number) => {
    const post = posts.find((p) => p.id === postId)!;
    seq++;
    pumps.push({
      id: `seedpump${seq}`,
      postId,
      pumperUserId,
      amount,
      creatorAmount: amount * 0.7,
      founderAmount: amount * 0.3,
      signature: `seed-${postId}-${seq}`,
      anonymous: false,
      createdAt: now - hoursAgo * H,
      creatorUserId: post.userId,
      postCountry: post.country,
    });
  };
  for (const pid of ["p1", "p4", "p7"]) {
    for (const t of pumperTemplate) addPump(pid, t.userId, t.amount, t.hoursAgo);
  }
  // Older history (outside 24h, some outside 7 / 30 days).
  addPump("p14", "u5", 10.0, 70);
  addPump("p14", "u1", 8.0, 60);
  addPump("p15", "u3", 4.5, 118);
  addPump("p15", "u6", 3.0, 100);
  addPump("p16", "u5", 9.0, 478);
  addPump("p16", "u2", 6.0, 400);
  addPump("p17", "u1", 9.0, 1078);

  return { users, posts, comments, pumps };
}

// Placeholder gradient "media" encoded as a data URI so seed posts render an
// image without any external asset. Real posts use Arweave URLs.
const GRADS = [
  ["#f97316", "#db2777"],
  ["#3b82f6", "#06b6d4"],
  ["#8b5cf6", "#ec4899"],
  ["#10b981", "#0ea5e9"],
  ["#f59e0b", "#ef4444"],
  ["#6366f1", "#22d3ee"],
];
function placeholderMedia(id: string, type: "image" | "video"): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADS[h % GRADS.length];
  const label = type === "video" ? "▶ Video" : "Image";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='500' fill='url(#g)'/><text x='50%' y='50%' fill='rgba(255,255,255,.9)' font-family='sans-serif' font-size='34' font-weight='700' text-anchor='middle' dominant-baseline='middle'>${label} · placeholder</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
