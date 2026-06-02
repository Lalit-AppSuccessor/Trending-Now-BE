import "./FilterBar.css";

const TABS = [
  { id: "all", label: "All Feed", emoji: "⚡" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🎉" },
];

export default function FilterBar({ active, onChange, counts = {} }) {
  return (
    <div className="filter-bar fade-up fade-up-1">
      <div className="filter-bar-inner">
        {TABS.map((tab) => {
          const count = counts[tab.id];
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              className={`fb-tab ${isActive ? "fb-tab--active" : ""} fb-tab--${tab.id}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="fb-tab-emoji">{tab.emoji}</span>
              <span className="fb-tab-label">{tab.label}</span>
              {count ? <span className="fb-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
