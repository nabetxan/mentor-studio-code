import type { DashboardData } from "@mentor-studio/shared";

interface OverviewProps {
  data: DashboardData | null;
}

export function Overview({ data }: OverviewProps) {
  if (!data) {
    return <div className="empty">No data yet</div>;
  }

  return (
    <div className="overview">
      <div className="stat-card">
        <div className="stat-label">Total Questions</div>
        <div className="stat-value">{data.totalQuestions}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Correct Rate</div>
        <div className="stat-value">{Math.round(data.correctRate * 100)}%</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Current Task</div>
        <div className="stat-value">Task {data.currentTask}</div>
      </div>

      {data.unresolvedGaps.length > 0 && (
        <div className="section">
          <h3>Unresolved Gaps ({data.unresolvedGaps.length})</h3>
          <ul className="gap-list">
            {data.unresolvedGaps.map((gap) => (
              <li
                className="action-card"
                key={`${gap.concept}-${gap.topic}-${gap.task}-${gap.first_missed}`}
              >
                <div className="gap-concept">{gap.concept}</div>
                <div className="gap-detail">
                  <span className="gap-topic">{gap.topic}</span>
                  {gap.note && <span className="gap-note">{gap.note}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.byTopic.length > 0 && (
        <div className="section">
          <h3>Topics</h3>
          {data.byTopic.map((topic) => (
            <div className="topic-group" key={topic.topic}>
              <div className="topic-header">
                <span className="topic-label">{topic.label}</span>
                <span className="topic-score">
                  {topic.correct}/{topic.total} ({Math.round(topic.rate * 100)}
                  %)
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round(topic.rate * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
