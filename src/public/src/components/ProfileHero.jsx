import {
  fmtNum,
  fmtDate,
  getTotalReach,
  getTotalPosts,
  PLATFORM_META,
} from "../utils";
import "./ProfileHero.css";

/* ── Platform icons (inline SVG strings) ─────────────── */
const FbIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
  </svg>
);
const IgIcon = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const YtIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.54 6.42A2.78 2.78 0 0020.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47a2.78 2.78 0 00-1.94 1.95A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 001.94-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
  </svg>
);
const TwIcon = () => <span style={{ fontSize: 9, lineHeight: 1 }}>𝕏</span>;

const PLAT_ICONS = {
  facebook: FbIcon,
  instagram: IgIcon,
  youtube: YtIcon,
  twitter: TwIcon,
};

function PlatformDot({ platform, stats }) {
  const Icon = PLAT_ICONS[platform] || (() => null);
  const meta = PLATFORM_META[platform] || {};
  const cls = meta.cls || "";
  return (
    <span className={`hero-plat-dot ${cls}`}>
      <Icon />
      {meta.label}
    </span>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="hero-stat-card">
      <div className="hsc-icon">{icon}</div>
      <div className="hsc-val">{value}</div>
      <div className="hsc-label">{label}</div>
      {sub && <div className="hsc-sub">{sub}</div>}
    </div>
  );
}

export default function ProfileHero({ data }) {
  const name = data.creatorName || "Creator";
  const initials = name
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = name.replace(/_/g, " ");
  const stats = data.stats || {};

  const activePlatforms = Object.keys(PLATFORM_META).filter(
    (k) => stats[k] || (k === "shorts" && stats.youtubeShorts),
  );
  const reach = getTotalReach(stats);
  const totalPosts = getTotalPosts(stats);

  const platformCount = activePlatforms.filter((p) => p !== "shorts").length;

  /* derive a fun rank label */
  const rankLabel =
    reach > 5_000_000
      ? "Mega Creator"
      : reach > 1_000_000
        ? "Top Creator"
        : "Rising Creator";

  return (
    <div className="profile-hero fade-up">
      {/* glow orbs */}
      <div className="ph-glow ph-glow-1" />
      <div className="ph-glow ph-glow-2" />

      {/* ── Row: avatar + info ──────────────────────── */}
      <div className="ph-top">
        {/* avatar */}
        <div className="ph-avatar-wrap">
          <img
            width="70"
            height="70"
            style={{ borderRadius: "20%", objectFit: "cover", objectPosition: "30% center" }}
            src="https://images.indianexpress.com/2025/02/Samay-Raina.jpg?w=600"
            alt={name}
          />
          <div className="ph-online-dot" />
        </div>

        {/* info */}
        <div className="ph-info">
          <div className="ph-rank-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {rankLabel}
          </div>
          <div className="ph-name">{displayName}</div>
          <div className="ph-handle">@{name}</div>

          {/* platform dots */}
          {activePlatforms.length > 0 && (
            <div className="ph-platforms">
              {activePlatforms
                .filter((p) => p !== "shorts")
                .map((p) => (
                  <PlatformDot key={p} platform={p} stats={stats} />
                ))}
            </div>
          )}
        </div>

        {/* rank position */}
        <div className="ph-position" style={{ color: "greenyellow" }}>
          <div className="ph-position-label">Position</div>

          <div className="ph-position-value">
            #{data.rank || data.position || 1}
          </div>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────── */}
      <div className="ph-stats-row">
        <StatCard
          icon={
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
          label="Total Reach"
          value={reach ? fmtNum(reach) : "2.5k"}
          sub="across all platforms"
        />
        <StatCard
          icon={
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
              <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
              <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
              <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
              <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
              <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" />
              <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
            </svg>
          }
          label="Platforms"
          value={platformCount}
          sub={`${activePlatforms
            .filter((p) => p !== "shorts")
            .map((p) => PLATFORM_META[p]?.label)
            .join(", ")}`}
        />
        <StatCard
          icon={
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
          label="Total Posts"
          value={totalPosts || "—"}
          sub="content pieces"
        />
      </div>
    </div>
  );
}
