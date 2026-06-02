import { useRef, useState } from "react";
import { getThumb, getVideoUrl, fmtNum, PLATFORM_META, PROXY } from "../utils";
import "./TrendingCarousel.css";

/* ── Platform icons ──────────────────────────────────── */
const ICONS = {
  facebook: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  ),
  instagram: (
    <svg
      width="10"
      height="10"
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
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42A2.78 2.78 0 0020.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47a2.78 2.78 0 00-1.94 1.95A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 001.94-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
    </svg>
  ),
  shorts: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  twitter: (
    <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 700 }}>𝕏</span>
  ),
};

function CarouselVideo({ post }) {
  const [playing, setPlaying] = useState(false);

  const thumb = getThumb(post);

  const mediaVideo =
    post.media?.find((m) => m.type === "video")?.url || getVideoUrl(post);

  if (!mediaVideo) {
    return (
      <div className="tc-thumb">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.target.style.opacity = 0;
            }}
          />
        ) : (
          <div className="tc-thumb-placeholder" />
        )}
      </div>
    );
  }

  const isShort = post.platform === "youtube_shorts";

  return (
    <div
      className={`tc-thumb tc-video-thumb ${isShort ? "tc-shorts-wrap" : ""}`}
    >
      {playing ? (
        <video
          controls
          autoPlay
          playsInline
          poster={thumb}
          className={`tc-video ${
            isShort ? "tc-video-shorts" : "tc-video-landscape"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <source
            src={post.platform === "twitter" ? PROXY(mediaVideo) : mediaVideo}
            type="video/mp4"
          />
        </video>
      ) : (
        <>
          {thumb ? (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.target.style.opacity = 0;
              }}
            />
          ) : (
            <div className="tc-thumb-placeholder" />
          )}

          <div className="tc-thumb-gradient" />

          <button
            className="tc-play"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlaying(true);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#fff">
              <polygon points="4,2 14,8 4,14" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function YouTubeEmbed({ post }) {
  const [playing, setPlaying] = useState(false);

  const thumb = getThumb(post);

  const embedUrl = post.embedUrl || `https://www.youtube.com/embed/${post.id}`;

  return (
    <div className="tc-thumb tc-video-thumb">
      {playing ? (
        <iframe
          src={`${embedUrl}${
            embedUrl.includes("?") ? "&" : "?"
          }autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
          className="tc-video"
          allow="accelerometer; autoplay;"
          allowFullScreen
          title="YouTube Video"
        />
      ) : (
        <>
          <img src={thumb} alt="" loading="lazy" />

          <div className="tc-thumb-gradient" />

          <button
            className="tc-play"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlaying(true);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#fff">
              <polygon points="4,2 14,8 4,14" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function CarouselCard({ post, index }) {
  const thumb = getThumb(post);
  const videoUrl = getVideoUrl(post);

  const meta = PLATFORM_META[post.platform] || {};
  const caption = post.text || post.caption || post.title || "";

  const eng = post.engagement || {};

  const likes = post.likes || post.likeCount || eng.reactions || null;

  const views = post.views || post.videoViews || null;

  const href = post.url || "#";

  const cardContent = (
    <>
      <div className="tc-media">
        {post.platform === "youtube" ||
        post.platform === "shorts" ||
        post.platform === "youtube_shorts" ? (
          <YouTubeEmbed post={post} />
        ) : videoUrl ? (
          <CarouselVideo post={post} />
        ) : (
          <div className="tc-thumb">
            {thumb ? (
              <img
                src={thumb}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.target.style.opacity = 0;
                }}
              />
            ) : (
              <div className="tc-thumb-placeholder" />
            )}

            <div className="tc-thumb-gradient" />
          </div>
        )}

        <span className={`tc-plat-badge plat-badge ${meta.cls}`}>
          {ICONS[post.platform]}
          {meta.short}
        </span>

        {(likes || views) && (
          <div className="tc-eng-overlay">
            {likes && <span>❤️ {fmtNum(likes)}</span>}
            {views && <span>👁 {fmtNum(views)}</span>}
          </div>
        )}
      </div>

      <div className="tc-body">
        <div className="tc-caption">{caption}</div>

        {post.account && <div className="tc-account">@{post.account}</div>}
      </div>
    </>
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tc-card fade-up"
      style={{ animationDelay: `${0.04 * index}s` }}
    >
      {cardContent}
    </a>
  );
}

export default function TrendingCarousel({ posts = [], section = "all" }) {
  const scrollRef = useRef(null);

  const shown = posts.slice(0, 20);

  if (!shown.length) return null;

  const scroll = (dir) => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: dir * 220,
      behavior: "smooth",
    });
  };

  return (
    <div className="trending-section section fade-up fade-up-2">
      <div className="section-head">
        <div className="section-title">
          <span className="tc-fire">🔥</span>
          Trending{" "}
          {section == "all" ? "Now" : section == "news" ? "News" : "Lifestyle"}
        </div>

        <div className="tc-nav">
          <button
            className="tc-nav-btn"
            onClick={() => scroll(-1)}
            aria-label="scroll left"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            className="tc-nav-btn"
            onClick={() => scroll(1)}
            aria-label="scroll right"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="tc-scroll" ref={scrollRef}>
        {shown.map((post, i) => (
          <CarouselCard key={`${post.platform}-${i}`} post={post} index={i} />
        ))}

        <div className="tc-fade-edge" />
      </div>
    </div>
  );
}
