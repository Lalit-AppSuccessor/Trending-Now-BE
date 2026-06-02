import { PROXY, fmtDate } from '../../utils'
import CommentSection from '../CommentSection'
import './NewsCard.css'

export default function NewsCard({ article, index = 0 }) {
  const img   = article.urlToImage || article.image
  const src   = article.source?.name || article.source || 'News'
  const title = article.title  || ''
  const desc  = article.description || ''
  const date  = fmtDate(article.publishedAt || article.scrapedAt)

  return (
    <div className="nc-outer" style={{ animationDelay: `${0.05 * index}s` }}>
      <a
        href={article.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="nc-card"
      >
        {/* image */}
        <div className="nc-image">
          {img
            ? <img
                src={PROXY(img)}
                alt=""
                loading="lazy"
                onError={e => { e.target.style.opacity = 0 }}
              />
            : <div className="nc-no-image">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text4)" strokeWidth="1.5">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
              </div>
          }
          {article.breaking && <span className="nc-breaking">Breaking</span>}
          <div className="nc-img-overlay" />
        </div>

        {/* body */}
        <div className="nc-body">
          <div className="nc-source-row">
            <span className="nc-source">{src}</span>
            {date && <span className="nc-date">{date}</span>}
          </div>
          <div className="nc-title">{title}</div>
          {desc && <div className="nc-desc">{desc}</div>}
        </div>
      </a>

      <CommentSection postIndex={index} type="news" />
    </div>
  )
}
