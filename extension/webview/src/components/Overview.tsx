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
    </div>
  );
}
