import { useState, useRef, useEffect } from "react";
import {
  getThumb,
  getVideoUrl,
  fmtNum,
  fmtDate,
  PLATFORM_META,
  getYoutubeId,
  PROXY,
} from "../../utils";
import CommentSection from "../CommentSection";
import "./SocialCard.css";

const ICONS = {
  facebook: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  ),
  instagram: (
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
  ),
  youtube: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42A2.78 2.78 0 0020.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47a2.78 2.78 0 00-1.94 1.95A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 001.94-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
      <polygon points="10 15 15 12 10 9 10 15" fill="#000" />
    </svg>
  ),
  shorts: (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  twitter: (
    <span style={{ fontSize: 8, lineHeight: 1, fontWeight: 700 }}>𝕏</span>
  ),
};

/* ── YouTube Embed ───────────────────────────────────────────── */
function YouTubeEmbed({ post, isShorts }) {
  const [active, setActive] = useState(false);
  const thumb = getThumb(post);
  const ytId = getYoutubeId(post.url) || post.id;

  const embedUrl = post.embedUrl || `https://www.youtube.com/embed/${ytId}`;

  return (
    <div
      className={`sc-embed-wrap sc-embed-yt ${isShorts ? "sc-embed-shorts" : ""}`}
    >
      {active ? (
        <iframe
          src={`${embedUrl}${
            embedUrl.includes("?") ? "&" : "?"
          }autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
          className="sc-embed-iframe"
        />
      ) : (
        <div className="sc-embed-thumb" onClick={() => setActive(true)}>
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <div className="sc-embed-thumb-fallback" />
          )}
          <div className="sc-embed-overlay" />
          <button className="sc-twitter-play">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
          {isShorts && <div className="sc-shorts-badge">Shorts</div>}
        </div>
      )}
    </div>
  );
}

/* ── Twitter/X Native Embed ─────────────────────────── */
function TwitterVideoPlayer({ post }) {
  const media = post.media?.find((m) => m.type === "video");
  const [playing, setPlaying] = useState(false);

  if (!media?.url) return null;

  return (
    <div className="sc-twitter-player">
      <div className="sc-twitter-video-wrap">
        {playing ? (
          <video
            controls
            autoPlay
            playsInline
            poster={media.thumbnail}
            className="sc-twitter-video"
          >
            <source src={PROXY(media.url)} type="video/mp4" />
          </video>
        ) : (
          <div className="sc-twitter-thumb" onClick={() => setPlaying(true)}>
            <img src={media.thumbnail} alt="" loading="lazy" />

            <div className="sc-twitter-overlay" />

            <button className="sc-twitter-play">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Instagram Custom Player ─────────────────────────────────── */
function InstagramPlayer({ post }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef(null);

  const thumb = getThumb(post);

  const rawVideoUrl =
    post.media?.find((m) => m.type === "video")?.url || getVideoUrl(post);

  const fmtTime = (s = 0) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    setCurrentTime(v.currentTime);
    setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;

    setDuration(v.duration || 0);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;

    v.currentTime = percent * v.duration;
  };

  const togglePlay = async (e) => {
    e?.stopPropagation();

    const v = videoRef.current;
    if (!v) return;

    try {
      if (v.paused) {
        await v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
    } catch (err) {
      console.error("Instagram video failed", {
        rawVideoUrl,
        error: err,
      });
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();

    const v = videoRef.current;
    if (!v) return;

    v.muted = !v.muted;
    setMuted(v.muted);
  };

  if (!rawVideoUrl) return null;

  return (
    <div className="sc-ig-player">
      <div className="sc-ig-header">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>

        <span>Instagram</span>
      </div>

      <div className="sc-ig-video-wrap">
        <video
          ref={videoRef}
          src={rawVideoUrl}
          playsInline
          preload="metadata"
          muted={muted}
          controls={false}
          className="sc-ig-video"
          poster={thumb}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={(e) => {
            console.error("Instagram video failed", {
              rawVideoUrl,
              error: e,
            });
          }}
        />

        {!playing && (
          <>
            <div className="sc-embed-overlay" />

            <button
              className="sc-embed-play sc-embed-play--ig"
              onClick={togglePlay}
              aria-label="Play video"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="sc-ig-controls">
        <button
          className="sc-ig-btn"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="sc-ig-timeline" onClick={handleSeek}>
          <div className="sc-ig-timeline-bg" />

          <div
            className="sc-ig-timeline-fill"
            style={{ width: `${progress}%` }}
          />

          <div
            className="sc-ig-timeline-dot"
            style={{ left: `${progress}%` }}
          />
        </div>

        <span className="sc-ig-time">
          {fmtTime(currentTime)}
          {duration ? ` / ${fmtTime(duration)}` : ""}
        </span>

        <button
          className="sc-ig-btn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>

        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="sc-ig-btn sc-ig-ext"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Generic fallback video player ──────────────────────────── */
function GenericPlayer({ post }) {
  const [active, setActive] = useState(false);
  const thumb = getThumb(post);
  const videoUrl = getVideoUrl(post);
  if (!videoUrl) return null;
  return (
    <div className="sc-media">
      {active ? (
        <video
          controls
          autoPlay
          playsInline
          src={videoUrl}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
          }}
        />
      ) : thumb ? (
        <>
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.target.style.opacity = 0;
            }}
          />
          <div className="sc-media-overlay" />
          <button
            className="sc-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              setActive(true);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#fff">
              <polygon points="4,2 14,8 4,14" />
            </svg>
          </button>
        </>
      ) : null}
    </div>
  );
}

/* ── Main SocialCard ─────────────────────────────────────────── */
export default function SocialCard({ post, index = 0 }) {
  const thumb = getThumb(post);
  const videoUrl = getVideoUrl(post);
  const meta = PLATFORM_META[post.platform] || {};
  const caption = post.text || post.caption || post.title || "";
  const eng = post.engagement || {};
  const likes = post.likes || post.likeCount || eng.reactions || null;
  const comments = post.comments || eng.comments || null;
  const shares = post.shares || eng.shares || null;
  const views = post.views || post.videoViews || null;

  const platform = post.platform;

  /* pick the right media component */
  const renderMedia = () => {
    // YouTube & Shorts
    if (
      platform === "youtube" ||
      platform === "shorts" ||
      platform === "youtube_shorts"
    ) {
      return (
        <YouTubeEmbed
          post={post}
          isShorts={platform === "shorts" || platform === "youtube_shorts"}
        />
      );
    }

    // Instagram videos
    if (platform === "instagram" && videoUrl) {
      return <InstagramPlayer post={post} />;
    }

    // Twitter videos
    if (platform === "twitter") {
      return <TwitterVideoPlayer post={post} />;
    }

    // Facebook videos
    if (platform === "facebook" && videoUrl) {
      return <GenericPlayer post={post} />;
    }

    // Any other platform video
    if (videoUrl) {
      return <GenericPlayer post={post} />;
    }

    // Images
    if (thumb) {
      return (
        <div className="sc-media">
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.target.style.opacity = 0;
            }}
          />
        </div>
      );
    }

    return (
      <div className="sc-no-media">
        <span
          style={{
            color: meta.color || "var(--text4)",
            opacity: 0.4,
            fontSize: 28,
          }}
        >
          {ICONS[platform]}
        </span>
      </div>
    );
  };

  const bodySection = (
    <div className="sc-body">
      <div className="sc-meta-row">
        <span className={`plat-badge ${meta.cls}`}>
          {ICONS[platform]} {meta.short}
        </span>
        {post.url && (
          <div className="sc-cta-wrap">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sc-post-cta-icon"
              title="Open original post"
              aria-label="Open original post"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        )}
        {post.publishedAt && (
          <span className="sc-date">{fmtDate(post.publishedAt)}</span>
        )}
      </div>

      {caption && <div className="sc-caption">{caption}</div>}
      {(likes || comments || shares || views) && (
        <div className="eng-row">
          {likes && <span className="ep">❤️ {fmtNum(likes)}</span>}
          {comments && <span className="ep">💬 {fmtNum(comments)}</span>}
          {shares && <span className="ep">↗ {fmtNum(shares)}</span>}
          {views && <span className="ep">👁 {fmtNum(views)}</span>}
        </div>
      )}
    </div>
  );

  const hasEmbedMedia =
    platform === "youtube" ||
    platform === "shorts" ||
    platform === "youtube_shorts" ||
    platform === "twitter" ||
    (platform === "instagram" && videoUrl) ||
    (platform === "facebook" && videoUrl);

  return (
    <div className="sc-outer" style={{ animationDelay: `${0.05 * index}s` }}>
      {hasEmbedMedia ? (
        <div className="sc-card sc-card--nolink">
          {renderMedia()}
          {bodySection}
        </div>
      ) : (
        <a
          href={post.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="sc-card"
        >
          {renderMedia()}
          {bodySection}
        </a>
      )}
      <CommentSection postIndex={index} type="social" />
    </div>
  );
}
