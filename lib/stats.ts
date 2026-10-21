export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
};
export type Photo = { id: number; image_url: string; alt_text: string | null; user_id: string | null; created_at: string };
export type Caption = {
  id: number;
  photo_id: number | null;
  generation_id: number | null;
  caption_text: string;
  setup: string | null;
  angle: string | null;
  created_at: string;
};
export type Generation = { id: number; user_id: string; kind: string; model: string; created_at: string };
export type Vote = { id: number; user_id: string; caption_id: number; vote: number; created_at: string };
export type Like = { id: number; user_id: string; photo_id: number; created_at: string };

export type ScoredCaption = Caption & { up: number; down: number; score: number; total: number };

const TZ = "America/New_York";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localParts(iso: string) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return {
    day: DAYS.indexOf(parts.weekday),
    hour: Number(parts.hour) % 24,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function computeStats(data: {
  profiles: Profile[];
  photos: Photo[];
  captions: Caption[];
  generations: Generation[];
  votes: Vote[];
  likes: Like[];
}) {
  const { profiles, photos, captions, generations, votes, likes } = data;

  // --- per-caption scores
  const tally = new Map<number, { up: number; down: number }>();
  for (const v of votes) {
    const t = tally.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.vote > 0) t.up++;
    else t.down++;
    tally.set(v.caption_id, t);
  }
  const scored: ScoredCaption[] = captions.map((c) => {
    const t = tally.get(c.id) ?? { up: 0, down: 0 };
    return { ...c, up: t.up, down: t.down, score: t.up - t.down, total: t.up + t.down };
  });

  const upvotes = votes.filter((v) => v.vote > 0).length;
  const approval = votes.length ? upvotes / votes.length : 0;

  const hallOfFame = scored
    .filter((c) => c.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 5);

  const hallOfShame = scored
    .filter((c) => c.score < 0)
    .sort((a, b) => a.score - b.score || b.total - a.total)
    .slice(0, 3);

  // Controversy: lots of votes, split close to 50/50.
  const controversial = scored
    .filter((c) => c.up > 0 && c.down > 0)
    .map((c) => ({ ...c, heat: c.total * (Math.min(c.up, c.down) / Math.max(c.up, c.down)) }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 5);

  const ignored = scored.filter((c) => c.total === 0).length;

  // --- which comedic angle lands best
  const ANGLE_LABELS: Record<string, string> = {
    photo: "About the photo",
    name: "About the name",
    both: "Photo + name",
    chat: "Chat jokes",
  };
  const angles = Object.entries(ANGLE_LABELS).map(([key, label]) => {
    const group = scored.filter((c) => (c.angle ?? "photo") === key);
    const up = group.reduce((s, c) => s + c.up, 0);
    const down = group.reduce((s, c) => s + c.down, 0);
    return { key, label, count: group.length, up, down, approval: up + down ? up / (up + down) : null };
  });

  // --- is brevity the soul of wit?
  const LENGTH_BUCKETS = [
    { label: "Under 40 chars", min: 0, max: 39 },
    { label: "40–79", min: 40, max: 79 },
    { label: "80–119", min: 80, max: 119 },
    { label: "120+", min: 120, max: Infinity },
  ];
  const brevity = LENGTH_BUCKETS.map((b) => {
    const group = scored.filter((c) => c.caption_text.length >= b.min && c.caption_text.length <= b.max);
    const voted = group.filter((c) => c.total > 0);
    const up = voted.reduce((s, c) => s + c.up, 0);
    const total = voted.reduce((s, c) => s + c.total, 0);
    return { label: b.label, count: group.length, approval: total ? up / total : null, votes: total };
  });

  // --- when do people vote (day x hour heatmap)
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const v of votes) {
    const { day, hour } = localParts(v.created_at);
    if (day >= 0) heat[day][hour]++;
  }
  const heatMax = Math.max(1, ...heat.flat());
  let peak = { day: 0, hour: 0, count: 0 };
  heat.forEach((row, d) =>
    row.forEach((count, h) => {
      if (count > peak.count) peak = { day: d, hour: h, count };
    }),
  );

  // --- daily generations, last 30 days
  const today = new Date();
  const days: { date: string; label: string; photo: number; chat: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const { date } = localParts(d.toISOString());
    days.push({
      date,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }),
      photo: 0,
      chat: 0,
    });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  for (const g of generations) {
    const i = dayIndex.get(localParts(g.created_at).date);
    if (i === undefined) continue;
    if (g.kind === "chat") days[i].chat++;
    else days[i].photo++;
  }
  const dayMax = Math.max(1, ...days.map((d) => d.photo + d.chat));

  // --- people
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const voterMap = new Map<string, { up: number; down: number }>();
  for (const v of votes) {
    const t = voterMap.get(v.user_id) ?? { up: 0, down: 0 };
    if (v.vote > 0) t.up++;
    else t.down++;
    voterMap.set(v.user_id, t);
  }
  const voters = [...voterMap.entries()]
    .map(([id, t]) => ({ id, profile: profileById.get(id), ...t, total: t.up + t.down, approval: t.up / (t.up + t.down) }))
    .sort((a, b) => b.total - a.total);
  const minVotesToRank = 5;
  const ranked = voters.filter((v) => v.total >= minVotesToRank);
  const toughest = [...ranked].sort((a, b) => a.approval - b.approval || b.total - a.total)[0];
  const sweetest = [...ranked].sort((a, b) => b.approval - a.approval || b.total - a.total)[0];

  const genOwner = new Map(generations.map((g) => [g.id, g.user_id]));
  const photoOwner = new Map(photos.map((p) => [p.id, p.user_id]));
  const creatorMap = new Map<string, { captions: number; score: number; up: number }>();
  for (const c of scored) {
    const owner =
      (c.generation_id && genOwner.get(c.generation_id)) || (c.photo_id && photoOwner.get(c.photo_id)) || null;
    if (!owner) continue;
    const t = creatorMap.get(owner) ?? { captions: 0, score: 0, up: 0 };
    t.captions++;
    t.score += c.score;
    t.up += c.up;
    creatorMap.set(owner, t);
  }
  const creators = [...creatorMap.entries()]
    .map(([id, t]) => ({ id, profile: profileById.get(id), ...t }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const models = Object.entries(
    generations.reduce<Record<string, number>>((acc, g) => {
      acc[g.model] = (acc[g.model] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const likedPhotos = new Map<number, number>();
  for (const l of likes) likedPhotos.set(l.photo_id, (likedPhotos.get(l.photo_id) ?? 0) + 1);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const mostLiked = [...likedPhotos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => ({ photo: photoById.get(id), count }))
    .filter((p) => p.photo);

  return {
    totals: {
      users: profiles.length,
      photos: photos.length,
      captions: captions.length,
      generations: generations.length,
      votes: votes.length,
      likes: likes.length,
      upvotes,
      downvotes: votes.length - upvotes,
      approval,
      ignored,
      activeVoters: voters.length,
    },
    photoById,
    profileById,
    hallOfFame,
    hallOfShame,
    controversial,
    angles,
    brevity,
    heat,
    heatMax,
    peak: { ...peak, dayLabel: DAYS[peak.day] },
    days,
    dayMax,
    voters: voters.slice(0, 8),
    toughest,
    sweetest,
    minVotesToRank,
    creators,
    models,
    mostLiked,
    DAYS,
  };
}

export function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function hourLabel(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}
