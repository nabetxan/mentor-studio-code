import type { DashboardData } from "@mentor-studio/shared";

interface ActionsProps {
  data: DashboardData | null;
}

export function Actions({ data }: ActionsProps) {
  if (!data) {
    return <div className="empty">No data yet</div>;
  }

  return (
    <div className="actions">
      <h3>Unresolved Gaps</h3>
      {data.unresolvedGaps.length === 0 ? (
        <div className="empty">No unresolved gaps — great job!</div>
      ) : (
        <ul className="gap-list">
          {data.unresolvedGaps.map((gap, i) => (
            <li className="action-card" key={i}>
              <div className="gap-concept">{gap.concept}</div>
              <div className="gap-detail">
                <span className="gap-topic">{gap.topic}</span>
                {gap.note && <span className="gap-note">{gap.note}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
