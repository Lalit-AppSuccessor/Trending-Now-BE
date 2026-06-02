import './Loader.css'

export default function Loader() {
  return (
    <div className="app">
      <div className="app-inner loader-wrap">
        <div className="loader-inner">
          <div className="loader-avatar">
            <div className="loader-spinner" />
          </div>
          <div className="loader-text">Loading creator profile</div>
          <div className="loader-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  )
}
