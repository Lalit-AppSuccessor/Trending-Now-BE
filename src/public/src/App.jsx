import { useState, useEffect } from "react";
import ProfileHero from "./components/ProfileHero";
import FilterBar from "./components/FilterBar";
import TrendingCarousel from "./components/TrendingCarousel";
import PostGrid from "./components/PostGrid";
import Loader from "./components/Loader";
import "./styles/globals.css";
import { API_URL, byLatest, collectSocialPosts } from "./utils";

function ErrorState({ message, onRetry }) {
  return (
    <div className="app">
      <div className="app-inner error-state">
        <div className="error-icon">⚠️</div>
        <div className="error-title">Failed to load</div>
        <div className="error-msg">{message}</div>
        <button className="retry-btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return null;

  /* ── Prepare data buckets ─────────────────────────────── */
  const sections = data.sections || {};

  // All social posts
  const socialPosts = collectSocialPosts(sections);

  // News posts from ALL platforms
  const newsArticles = [...(data.categorized?.news || [])].sort(byLatest);

  const lifestylePosts = [...(data.categorized?.fun || [])].sort(byLatest);

  const lifestyleDisplay = lifestylePosts;

  const counts = {
    all: socialPosts.length,
   
    news: newsArticles.length,
    lifestyle: lifestylePosts.length,
  };

  const creatorName = data.creatorName.split("_").join(" ");

  /* ── Determine active panel ───────────────────────────── */
  const handleFilterChange = (val) => {
    setActiveFilter(val);
    const el = document.querySelector(".content-area");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app">
      <div className="app-inner">
        {/* ── Profile ──────────────────────────────────── */}
        <ProfileHero data={data} />

        {/* ── Filter tabs ──────────────────────────────── */}
        <FilterBar
          active={activeFilter}
          onChange={handleFilterChange}
          counts={counts}
        />

        {/* ── Content panels ───────────────────────────── */}
        <div className="content-area">
          {/* ALL FEED */}
          {activeFilter === "all" && (
            <>
              {socialPosts.length > 0 && (
                <TrendingCarousel posts={socialPosts} />
              )}
              {socialPosts.length > 0 && <div className="section-divider" />}
              <PostGrid
                posts={socialPosts}
                title="Related Topics"
                type="social"
                showTopicFilter
                creatorName={creatorName}
              />
            </>
          )}

          {/* NEWS */}
          {activeFilter === "news" && (
            <>
              {newsArticles.length > 0 && (
                <TrendingCarousel posts={newsArticles} section="news" />
              )}

              {newsArticles.length > 0 && <div className="section-divider" />}

              <PostGrid
                posts={newsArticles}
                title="Latest News"
                type="news"
                showTopicFilter
                creatorName={creatorName}
              />
            </>
          )}
          {/* LIFESTYLE */}
          {activeFilter === "lifestyle" && (
            <>
              {lifestylePosts.length > 0 && (
                <TrendingCarousel posts={lifestylePosts} section="lifestyle" />
              )}

              {lifestylePosts.length > 0 && <div className="section-divider" />}

              <PostGrid
                posts={lifestylePosts}
                title="Related Topics"
                type="lifestyle"
                showTopicFilter
                creatorName={creatorName}
              />
            </>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────── */}
        <div className="app-footer">
          <span>Creator Profile</span>
          <span className="app-footer-dot">·</span>
          <span>
            Data across {Object.keys(data.sections || {}).length} platforms
          </span>
        </div>
      </div>
    </div>
  );
}
