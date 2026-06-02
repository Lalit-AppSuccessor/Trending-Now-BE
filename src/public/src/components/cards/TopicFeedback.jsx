import { useState } from "react";
import "./TopicFeedback.css";

export default function TopicFeedback({ creator = "Creator", question }) {
  const [vote, setVote] = useState(null);

  const finalQuestion = question;

  return (
    <div className="pulse-card">
      <div className="pulse-header">
        <div className="pulse-badge">💬 Community Feedback</div>
      </div>

      <h3 className="pulse-question">{finalQuestion}</h3>

      {!vote ? (
        <div className="pulse-actions">
          <button
            className="pulse-action pulse-positive"
            onClick={() => setVote("support")}
          >
            👍 Support
          </button>

          <button
            className="pulse-action pulse-negative"
            onClick={() => setVote("oppose")}
          >
            👎 Oppose
          </button>
        </div>
      ) : (
        <div className="pulse-result">
          <div className="pulse-thanks">✅ Thanks for your feedback</div>
        </div>
      )}

      <div className="pulse-footer">
        <div className="pulse-users">
          👥 Join thousands of community members sharing feedback
        </div>
      </div>
    </div>
  );
}
