import Link from "next/link";
import { displayName, fetchAll, requireAdmin } from "@/lib/admin";
import {
  computeStats,
  hourLabel,
  pct,
  type Caption,
  type Generation,
  type Like,
  type Photo,
  type Profile,
  type ScoredCaption,
  type Vote,
} from "@/lib/stats";

const HEAT_STEPS = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6", "--seq-7"];

export default async function StatsPage() {
  const { supabase } = await requireAdmin();

  const [profiles, photos, captions, generations, votes, likes] = await Promise.all([
    fetchAll<Profile>(supabase, "profiles", "id, first_name, last_name, avatar_url, is_superadmin, created_at"),
    fetchAll<Photo>(supabase, "photos", "id, image_url, alt_text, user_id, created_at"),
    fetchAll<Caption>(supabase, "captions", "id, photo_id, generation_id, caption_text, setup, angle, created_at"),
    fetchAll<Generation>(supabase, "generations", "id, user_id, kind, model, created_at"),
    fetchAll<Vote>(supabase, "caption_votes", "id, user_id, caption_id, vote, created_at"),
    fetchAll<Like>(supabase, "likes", "id, user_id, photo_id, created_at"),
  ]);

  const s = computeStats({ profiles, photos, captions, generations, votes, likes });
  const t = s.totals;
  const maxVoter = Math.max(1, ...s.voters.map((v) => Math.max(v.up, v.down)));
  const maxCreator = Math.max(1, ...s.creators.map((c) => Math.abs(c.score)));
  const maxModel = Math.max(1, ...s.models.map(([, n]) => n));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Is anyone laughing?</h1>
        </div>
        <p className="muted small">All times Eastern. Live from Supabase on every load.</p>
      </div>

      {/* Hero + tiles */}
      <section className="card">
        <div className="hero">
          <div>
            <div className="big">{pct(t.approval)}</div>
            <p className="muted">
              of {t.votes.toLocaleString()} votes are upvotes — the room&apos;s laugh rate
            </p>
          </div>
          <div className="grid tiles" style={{ flex: 1 }}>
            <Tile label="Users" value={t.users} sub={`${t.activeVoters} have voted`} href="/users" />
            <Tile label="Photos" value={t.photos} sub={`${t.likes} likes`} href="/media" />
            <Tile label="Captions" value={t.captions} sub={`${t.generations} AI runs`} href="/media" />
            <Tile label="Upvotes" value={t.upvotes} sub={`${t.downvotes} downvotes`} href="/votes" />
            <Tile label="Never voted on" value={t.ignored} sub="captions shouting into the void" />
          </div>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <h2>Hall of fame</h2>
            <span className="muted small">highest net score</span>
          </div>
          <CaptionList items={s.hallOfFame} photoById={s.photoById} empty="No votes yet." />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Most divisive</h2>
            <span className="muted small">lots of votes, close to 50/50</span>
          </div>
          <CaptionList items={s.controversial} photoById={s.photoById} empty="Nothing has split the room yet." />
        </section>
      </div>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <h2>Which joke angle lands?</h2>
            <span className="muted small">upvote rate by caption type</span>
          </div>
          <div className="bars">
            {s.angles.map((a) => (
              <PercentRow
                key={a.key}
                label={a.label}
                value={a.approval}
                title={`${a.label}: ${a.up} up / ${a.down} down across ${a.count} captions`}
                note={`${a.count} captions`}
              />
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Is brevity the soul of wit?</h2>
            <span className="muted small">upvote rate by caption length</span>
          </div>
          <div className="bars">
            {s.brevity.map((b) => (
              <PercentRow
                key={b.label}
                label={b.label}
                value={b.approval}
                title={`${b.label}: ${b.votes} votes on ${b.count} captions`}
                note={`${b.votes} votes`}
              />
            ))}
          </div>
          <Verdict brevity={s.brevity} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>When does the room laugh?</h2>
          <span className="muted small">
            {s.peak.count
              ? `Peak: ${s.peak.dayLabel}s around ${hourLabel(s.peak.hour)} (${s.peak.count} votes)`
              : "No votes yet"}
          </span>
        </div>
        <div className="heat" role="table" aria-label="Votes by day of week and hour">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ textAlign: "center" }}>
              {h % 6 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
          {s.heat.map((row, d) => (
            <HeatRow key={d} day={s.DAYS[d]} row={row} max={s.heatMax} />
          ))}
        </div>
        <div className="heat-scale">
          fewer
          {HEAT_STEPS.map((v) => (
            <i key={v} style={{ background: `var(${v})` }} />
          ))}
          more votes
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>AI generations, last 30 days</h2>
          <span className="muted small">
            {s.days.reduce((n, d) => n + d.photo + d.chat, 0)} runs (photo captions + chat replies)
          </span>
        </div>
        <div className="columns" aria-label="Generations per day">
          {s.days.map((d) => {
            const n = d.photo + d.chat;
            return (
              <div className="col" key={d.date} title={`${d.label}: ${d.photo} photo, ${d.chat} chat`}>
                <div style={{ height: `${(n / s.dayMax) * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="axis-row">
          <span>{s.days[0].label}</span>
          <span>peak {s.dayMax}/day</span>
          <span>{s.days[s.days.length - 1].label}</span>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <h2>Critics</h2>
            <span className="legend">
              <span style={{ "--swatch": "var(--down)" } as React.CSSProperties}>down</span>
              <span style={{ "--swatch": "var(--up)" } as React.CSSProperties}>up</span>
            </span>
          </div>
          {s.voters.length === 0 && <p className="muted">No votes yet.</p>}
          <div className="bars">
            {s.voters.map((v) => (
              <div className="bar-row" key={v.id} title={`${v.up} up, ${v.down} down`}>
                <span className="bar-label">{displayName(v.profile, "Anonymous")}</span>
                <div className="diverge">
                  <div className="left">
                    <div className="fill-down" style={{ width: `${(v.down / maxVoter) * 100}%` }} />
                  </div>
                  <div className="mid" />
                  <div className="right">
                    <div className="fill-up" style={{ width: `${(v.up / maxVoter) * 100}%` }} />
                  </div>
                </div>
                <span className="num muted">{pct(v.approval)}</span>
              </div>
            ))}
          </div>
          {s.toughest && s.sweetest && s.toughest.id !== s.sweetest.id && (
            <p className="small muted">
              Toughest crowd: <strong>{displayName(s.toughest.profile, "Anonymous")}</strong> (
              {pct(s.toughest.approval)} up). Easiest laugh:{" "}
              <strong>{displayName(s.sweetest.profile, "Anonymous")}</strong> ({pct(s.sweetest.approval)} up).
              Min {s.minVotesToRank} votes to qualify.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Funniest creators</h2>
            <span className="muted small">net score across their AI captions</span>
          </div>
          {s.creators.length === 0 && <p className="muted">No captions yet.</p>}
          <div className="bars">
            {s.creators.map((c) => (
              <div className="bar-row" key={c.id} title={`${c.captions} captions, ${c.up} upvotes`}>
                <span className="bar-label">{displayName(c.profile, "Anonymous")}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(Math.max(0, c.score) / maxCreator) * 100}%`,
                    }}
                  />
                </div>
                <span className="num">{c.score > 0 ? `+${c.score}` : c.score}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <h2>Models behind the jokes</h2>
            <span className="muted small">generations per model</span>
          </div>
          <div className="bars">
            {s.models.map(([model, n]) => (
              <div className="bar-row" key={model}>
                <span className="bar-label" title={model}>
                  {model}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(n / maxModel) * 100}%` }} />
                </div>
                <span className="num">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Most liked photos</h2>
            <span className="muted small">❤ from the feed</span>
          </div>
          {s.mostLiked.length === 0 && <p className="muted">No likes yet.</p>}
          <div className="grid tiles">
            {s.mostLiked.map(({ photo, count }) => (
              <Link key={photo!.id} href={`/media/photo/${photo!.id}`} className="tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo!.image_url} alt={photo!.alt_text ?? ""} className="thumb" style={{ width: "100%", height: 100 }} />
                <div className="small muted">{count} likes</div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {s.hallOfShame.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Hall of shame</h2>
            <span className="muted small">lowest net score — candidates for deletion?</span>
          </div>
          <CaptionList items={s.hallOfShame} photoById={s.photoById} empty="" />
        </section>
      )}
    </>
  );
}

function Tile({ label, value, sub, href }: { label: string; value: number; sub: string; href?: string }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString()}</div>
      <div className="sub">{sub}</div>
    </>
  );
  return href ? (
    <Link href={href} className="tile" style={{ color: "inherit", textDecoration: "none" }}>
      {body}
    </Link>
  ) : (
    <div className="tile">{body}</div>
  );
}

function PercentRow({ label, value, title, note }: { label: string; value: number | null; title: string; note: string }) {
  return (
    <div className="bar-row" title={title}>
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <span className="num">
        {pct(value)} <span className="muted small">· {note}</span>
      </span>
    </div>
  );
}

function Verdict({ brevity }: { brevity: { label: string; approval: number | null; votes: number }[] }) {
  const rated = brevity.filter((b) => b.approval !== null && b.votes >= 3);
  if (rated.length < 2) return null;
  const best = rated.reduce((a, b) => (b.approval! > a.approval! ? b : a));
  return (
    <p className="small muted">
      Verdict: <strong>{best.label.toLowerCase()}</strong> captions get the best reception.
    </p>
  );
}

function HeatRow({ day, row, max }: { day: string; row: number[]; max: number }) {
  return (
    <>
      <span>{day}</span>
      {row.map((count, h) => {
        const step = count === 0 ? null : Math.min(6, Math.floor((count / max) * 6.999));
        return (
          <div
            key={h}
            className="cell"
            title={`${day} ${hourLabel(h)}: ${count} votes`}
            style={{ background: step === null ? "var(--neutral)" : `var(${HEAT_STEPS[step]})` }}
          />
        );
      })}
    </>
  );
}

function CaptionList({
  items,
  photoById,
  empty,
}: {
  items: ScoredCaption[];
  photoById: Map<number, Photo>;
  empty: string;
}) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="bars" style={{ gap: 12 }}>
      {items.map((c) => {
        const photo = c.photo_id ? photoById.get(c.photo_id) : undefined;
        return (
          <Link
            key={c.id}
            href={`/media/${c.id}`}
            style={{ display: "flex", gap: 12, color: "inherit", textDecoration: "none" }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.image_url} alt={photo.alt_text ?? ""} className="thumb" />
            ) : (
              <div className="thumb" style={{ display: "grid", placeItems: "center" }}>💬</div>
            )}
            <div className="quote" style={{ flex: 1 }}>
              {c.setup && <div className="setup">“{c.setup}”</div>}
              <div>{c.caption_text}</div>
              <div className="small muted">
                <span className="pill up">▲ {c.up}</span> <span className="pill down">▼ {c.down}</span> net{" "}
                {c.score > 0 ? `+${c.score}` : c.score}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
