import { useState, useEffect, useRef } from 'react'
import './CommentSection.css'

/* ── Per-post comment pools keyed by index mod length ─── */
const SOCIAL_POOLS = [
  [
    { user: 'chess_fan99',   text: 'This stream was absolutely insane 🔥', color: '#7c6af7' },
    { user: 'rahul_m',       text: 'Samay never disappoints 👑',           color: '#f2698a' },
    { user: 'priya_k',       text: 'Caught this live — what a moment!',    color: '#2dd4a0' },
    { user: 'ankit_d',       text: 'That sacrifice in move 23 🤯',         color: '#f0a830' },
    { user: 'sanjay_r',      text: 'When is the next one?',               color: '#1d9bf0' },
    { user: 'neha_v',        text: 'Best chess content on the internet',  color: '#ff5555' },
  ],
  [
    { user: 'vikram_s',   text: 'Bro is genuinely built different 💪',    color: '#a594ff' },
    { user: 'meera_t',    text: 'Love the energy in every post!',          color: '#f2698a' },
    { user: 'rohan_b',    text: 'Subscribed after watching this ❤️',       color: '#5b9cf6' },
    { user: 'divya_c',    text: 'The commentary is so good 😂',            color: '#2dd4a0' },
    { user: 'aman_j',     text: 'More collabs please!!',                   color: '#7c6af7' },
  ],
  [
    { user: 'pooja_r',    text: 'Didn\'t expect this twist at all 😮',    color: '#f0a830' },
    { user: 'karan_s',    text: 'This man works so hard, respect 🙏',     color: '#2dd4a0' },
    { user: 'tanya_k',    text: 'Replayed this 5 times already lol',      color: '#a594ff' },
    { user: 'deepak_m',   text: 'Top tier content as always 🎯',           color: '#1d9bf0' },
    { user: 'simran_b',   text: 'Shared with my whole chess club',        color: '#f2698a' },
  ],
]

const NEWS_POOLS = [
  [
    { user: 'chess_daily',   text: 'Well deserved milestone! 🎉',              color: '#f0a830' },
    { user: 'sports_buzz',   text: 'Indian chess is thriving right now',        color: '#2dd4a0' },
    { user: 'mahesh_k',      text: 'Following since 100K — so proud! 🥹',      color: '#7c6af7' },
    { user: 'tech_nerd42',   text: 'The algorithm finally caught up 😄',        color: '#f2698a' },
    { user: 'geeta_r',       text: 'Deserves even more recognition',           color: '#5b9cf6' },
    { user: 'ravi_s',        text: 'Next stop 10M 👀',                         color: '#a594ff' },
  ],
  [
    { user: 'news_watcher',  text: 'Great coverage on this topic',             color: '#f0a830' },
    { user: 'kapil_m',       text: 'The viewership numbers are 🤯',            color: '#1d9bf0' },
    { user: 'sunita_b',      text: 'Proud early fan here 🙌',                  color: '#f2698a' },
    { user: 'arjun_t',       text: 'They should do a documentary tbh',         color: '#2dd4a0' },
  ],
]

export default function CommentSection({ postIndex = 0, type = 'social' }) {
  const pool  = type === 'news'
    ? NEWS_POOLS[postIndex % NEWS_POOLS.length]
    : SOCIAL_POOLS[postIndex % SOCIAL_POOLS.length]

  const [idx,          setIdx]          = useState(0)
  const [visible,      setVisible]      = useState(true)
  const [userComments, setUserComments] = useState([])
  const [inputVal,     setInputVal]     = useState('')
  const inputRef = useRef(null)

  /* cycle every 2 s */
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % pool.length)
        setVisible(true)
      }, 320)
    }, 2000)
    return () => clearInterval(timer)
  }, [pool.length])

  const handleSend = () => {
    const txt = inputVal.trim()
    if (!txt) return
    setUserComments(prev => [...prev, txt])
    setInputVal('')
    inputRef.current?.focus()
  }

  const cur = pool[idx]
  const initials = cur.user.slice(0, 2).toUpperCase()

  return (
    <div className="cs-wrap">
      <div className="cs-header">
        <span className="cs-label">💬 Comments</span>
        <span className="cs-count">{pool.length + userComments.length}</span>
      </div>

      {/* auto-cycling comment */}
      <div className={`cs-live ${visible ? 'cs-live--in' : 'cs-live--out'}`}>
        <div className="cs-avatar" style={{ background: cur.color }}>{initials}</div>
        <div className="cs-body">
          <span className="cs-username">@{cur.user}</span>
          <span className="cs-text">{cur.text}</span>
        </div>
      </div>

      {/* user-added comments */}
      {userComments.map((c, i) => (
        <div key={i} className="cs-user-comment fade-up">
          <div className="cs-avatar" style={{ background: 'var(--accent)' }}>ME</div>
          <div className="cs-body">
            <span className="cs-username" style={{ color: 'var(--accent2)' }}>@you</span>
            <span className="cs-text">{c}</span>
          </div>
        </div>
      ))}

      {/* input row */}
      <div className="cs-input-row">
        <input
          ref={inputRef}
          className="cs-input"
          placeholder="Add a comment…"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="cs-send" onClick={handleSend} aria-label="Send">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
