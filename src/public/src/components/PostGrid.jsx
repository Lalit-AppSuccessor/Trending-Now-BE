import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import SocialCard from "./cards/SocialCard";
import NewsCard from "./cards/NewsCard";
import { extractTopics, postMatchesTopic } from "../utils";
import "./PostGrid.css";
import TopicFeedback from "./cards/TopicFeedback";

const INITIAL_COUNT = 6;

export default function PostGrid({
  posts = [],
  title = "Posts",
  type = "social", // 'social' | 'news'
  showTopicFilter = true,
  creatorName = "this creator",
}) {
  const [activeTopic, setActiveTopic] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const handleTopicChange = (slug) => {
    setActiveTopic(slug);
    setShowAll(false);
  };

  const feedbackQuestions = [
    `What's your opinion of ${creatorName}?`,
    `Do you trust ${creatorName}?`,
    `Do you support ${creatorName}?`,
    `Has your opinion of ${creatorName} changed recently?`,
    `Would you recommend following ${creatorName}?`,
    `Do you find ${creatorName} authentic?`,
    `Is ${creatorName} a positive influence online?`,
    `Do you agree with most of ${creatorName}'s views?`,
    `Has ${creatorName} handled recent events well?`,
    `Do you think ${creatorName} deserves their popularity?`,
    `How credible do you find ${creatorName}?`,
    `Would you continue supporting ${creatorName}?`,
    `Has ${creatorName} gained or lost your trust?`,
    `Do you think ${creatorName} connects well with their audience?`,
    `How would you rate ${creatorName}'s public image?`,
    `Do you believe ${creatorName} is transparent with followers?`,
    `Has ${creatorName}'s content improved recently?`,
    `Would you like to see more from ${creatorName}?`,
    `Do you think ${creatorName} handles criticism well?`,
    `What's one word you'd use to describe ${creatorName}?`,
  ];

  const topics = useMemo(() => {
    if (!showTopicFilter) return [];
    return extractTopics(posts, 12);
  }, [posts, showTopicFilter]);

  useEffect(() => {
    const firstTopic = topics[0]?.slug;
    setActiveTopic(firstTopic);
    setShowAll(false);
  }, [posts]);

  const filtered = useMemo(() => {
    if (activeTopic === "all") return posts;
    return posts.filter((p) => postMatchesTopic(p, activeTopic));
  }, [posts, activeTopic]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);

  if (!posts.length) return null;

  const titleEmoji =
    {
      "Related Topics": "📌",
      "Latest News": "📰",
      Lifestyle: "🎉",
    }[title] || "📋";

  const hasTopics = showTopicFilter && topics.length > 0;

  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: dir * 220,
      behavior: "smooth",
    });
  };

  return (
    <div className="post-grid-section section fade-up fade-up-3">
      {/* section header */}
      <div className="section-head">
        <div className="section-title">
          <span>{titleEmoji}</span>
          {title}
        </div>
        <div className="pg-nav">
          <button className="pg-nav-btn" onClick={() => scroll(-1)}>
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

          <button className="pg-nav-btn" onClick={() => scroll(1)}>
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

      {/* topic filter pills */}
      {hasTopics && (
        <div className="pg-topics-wrap" ref={scrollRef}>
          {topics.map(({ slug, label, count, isHashtag }) => {
            const isActive = activeTopic === slug;
            return (
              <button
                key={slug}
                className={`pg-topic-pill ${isActive ? "pg-topic-pill--active" : ""}`}
                onClick={() => handleTopicChange(slug)}
                title={`${count} post${count !== 1 ? "s" : ""}`}
              >
                {isHashtag ? <span className="pg-topic-hash">#</span> : null}
                {isHashtag ? label.replace(/^#/, "") : label}
                <span className="pg-topic-badge">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* active topic bar */}
      {hasTopics && activeTopic !== (topics[0]?.slug || "all") && (
        <div className="pg-active-topic-bar">
          <span className="pg-active-label">
            {topics.find((t) => t.slug === activeTopic)?.label || activeTopic}
          </span>
          <span className="pg-active-count">
            {filtered.length} posts across all platforms
          </span>
          <button
            className="pg-clear-btn"
            onClick={() => handleTopicChange(topics[0]?.slug || "all")}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* 2-col grid */}
      {visible.length > 0 ? (
        <div className="pg-grid">
          {visible.map((item, i) => {
            const isSocial =
              item.platform ||
              item.account ||
              item.media ||
              item.embedUrl ||
              item.thumbnail ||
              item.avatar;

            const card = isSocial ? (
              <SocialCard
                key={`social-${item.id || item._id || i}`}
                post={item}
                index={i}
              />
            ) : (
              <NewsCard
                key={`news-${item._id || item.id || i}`}
                article={item}
                index={i}
              />
            );

            return (
              <Fragment key={`wrapper-${item.id || item._id || i}`}>
                {card}

                {(i + 1) % 4 === 0 && activeTopic !== "all" && (
                  <TopicFeedback
                    creator={creatorName}
                    question={
                      feedbackQuestions[
                        Math.floor(Math.random() * feedbackQuestions.length)
                      ]
                    }
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="pg-empty">
          <div className="pg-empty-icon">🔍</div>
          <div className="pg-empty-text">No posts found for this topic</div>
          <button
            className="pg-clear-btn-center"
            onClick={() => handleTopicChange(topics[0]?.slug || "all")}
          >
            Show all posts
          </button>
        </div>
      )}

      {/* show more */}
      {!showAll && filtered.length > INITIAL_COUNT && (
        <div className="pg-show-more">
          <button className="pg-show-btn" onClick={() => setShowAll(true)}>
            Show {filtered.length - INITIAL_COUNT} more
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      <div style={{ height: 4 }} />
    </div>
  );
}
