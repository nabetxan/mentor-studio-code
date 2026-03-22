import type { DashboardData } from "@mentor-studio/shared";

interface TopicsProps {
  data: DashboardData | null;
}

export function Topics({ data }: TopicsProps) {
  if (!data) {
    return <div className="empty">No data yet</div>;
  }

  return (
    <div className="topics">
      {data.byTopic.length === 0 ? (
        <div className="empty">No topics yet</div>
      ) : (
        data.byTopic.map((topic) => (
          <div className="topic-group" key={topic.topic}>
            <div className="topic-header">
              <span className="topic-label">{topic.label}</span>
              <span className="topic-score">
                {topic.correct}/{topic.total} ({Math.round(topic.rate * 100)}%)
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.round(topic.rate * 100)}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
