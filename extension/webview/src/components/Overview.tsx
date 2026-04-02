import type {
  DashboardData,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useRef, useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import { CheckIcon, CloseIcon, CopyIcon, EditIcon } from "./icons";
import { TopicSelect } from "./TopicSelect";

interface OverviewProps {
  data: DashboardData | null;
  locale: Locale;
  config: MentorStudioConfig | null;
  addTopicError: string | null;
  lastAddedTopicKey: string | null;
  onClearLastAddedKey: () => void;
}

export function Overview({
  data,
  locale,
  config,
  addTopicError,
  lastAddedTopicKey,
  onClearLastAddedKey,
}: OverviewProps) {
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {},
  );
  const [editingTopic, setEditingTopic] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [copiedTopic, triggerCopy] = useCopyFeedback();

  if (!data) {
    return <div className="empty">{t("overview.noData", locale)}</div>;
  }

  function toggleTopic(key: string) {
    setExpandedTopics((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function startEditingLabel(
    key: string,
    currentLabel: string,
    e: React.SyntheticEvent,
  ) {
    e.stopPropagation();
    setEditingTopic({ key, value: currentLabel });
    requestAnimationFrame(() => editInputRef.current?.focus());
  }

  function saveLabel() {
    if (!editingTopic) return;
    const newLabel = editingTopic.value.trim();
    if (newLabel) {
      postMessage({
        type: "updateTopicLabel",
        key: editingTopic.key,
        newLabel,
      });
    }
    setEditingTopic(null);
  }

  function cancelEditingLabel() {
    setEditingTopic(null);
  }

  function mergeTopic(fromKey: string) {
    const toKey = mergeTargets[fromKey];
    if (toKey) {
      postMessage({ type: "mergeTopic", fromKey, toKey });
    }
  }

  function copyReviewPrompt(key: string, label: string) {
    const text = t("overview.topic.reviewPrompt", locale).replace(
      "{label}",
      label,
    );
    postMessage({ type: "copy", text });
    triggerCopy(key);
  }

  return (
    <div className="overview">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-lbl">{t("overview.totalQuestions", locale)}</div>
          <div className="stat-val">{data.totalQuestions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t("overview.correctRate", locale)}</div>
          <div className="stat-val">{Math.round(data.correctRate * 100)}%</div>
        </div>
        <div className="stat-card wide">
          <div className="stat-lbl">{t("overview.currentTask", locale)}</div>
          <div className="stat-val">
            {data.currentTask === null ? (
              t("overview.notStarted", locale)
            ) : (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  postMessage({
                    type: "openFile",
                    relativePath: "docs/mentor/current-task.md",
                  });
                }}
                className="file-path-link"
              >
                {`${t("overview.taskPrefix", locale)} ${data.currentTask}`}
              </a>
            )}
          </div>
          {config?.mentorFiles?.plan != null &&
            (() => {
              const planPath = config.mentorFiles.plan;
              return (
                <div className="stat-sub">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      postMessage({
                        type: "openFile",
                        relativePath: planPath,
                      });
                    }}
                    className="file-path-link"
                  >
                    {planPath}
                  </a>
                </div>
              );
            })()}
        </div>
      </div>

      {data.byTopic.length > 0 && (
        <div>
          <div className="section-heading">{t("overview.topics", locale)}</div>
          {data.byTopic.map((topic) => {
            const isExpanded = expandedTopics[topic.topic] ?? false;
            const resolvedLabel =
              topic.label !== topic.topic
                ? topic.label
                : (config?.topics?.find((c) => c.key === topic.topic)?.label ??
                  topic.label);
            const displayLabel = resolvedLabel.replace(/^[a-z]-/, "");
            const topicGaps = data.unresolvedGaps.filter(
              (g) => g.topic === topic.topic,
            );
            const mergeOptions = (config?.topics ?? []).filter(
              (c) => c.key !== topic.topic,
            );

            return (
              <div className="topic-card" key={topic.topic}>
                {editingTopic?.key === topic.topic ? (
                  <div className="topic-header topic-header--editing">
                    <input
                      ref={editInputRef}
                      className="inline-edit-input"
                      value={editingTopic.value}
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          value: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveLabel();
                        if (e.key === "Escape") cancelEditingLabel();
                      }}
                    />
                    <button
                      className="inline-edit-btn save"
                      onClick={saveLabel}
                      title={t("overview.topic.save", locale)}
                      aria-label={t("overview.topic.save", locale)}
                    >
                      <CheckIcon />
                    </button>
                    <button
                      className="inline-edit-btn cancel"
                      onClick={cancelEditingLabel}
                      title={t("overview.topic.cancel", locale)}
                      aria-label={t("overview.topic.cancel", locale)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <div
                    className="topic-header"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleTopic(topic.topic)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTopic(topic.topic);
                      }
                    }}
                  >
                    <i
                      className={
                        isExpanded ? "chevron-icon open" : "chevron-icon"
                      }
                    >
                      ›
                    </i>
                    <span className="topic-label">{displayLabel}</span>
                    <button
                      className="edit-label-btn"
                      onClick={(e) =>
                        startEditingLabel(topic.topic, displayLabel, e)
                      }
                      title={t("overview.topic.editLabel", locale)}
                      aria-label={t("overview.topic.editLabel", locale)}
                    >
                      <EditIcon />
                    </button>
                    <span className="score-pill">
                      {topic.correct}/{topic.total}
                      {t("overview.topic.scoreUnit", locale)}
                    </span>
                  </div>
                )}
                <div className="progress-wrap">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuenow={Math.round(topic.rate * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${displayLabel} ${Math.round(topic.rate * 100)}%`}
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.round(topic.rate * 100)}%` }}
                    />
                  </div>
                  <span className="progress-pct" aria-hidden="true">
                    {Math.round(topic.rate * 100)}%
                  </span>
                </div>

                {isExpanded && (
                  <div className="topic-detail">
                    {mergeOptions.length > 0 && (
                      <div>
                        <div className="detail-lbl">
                          {t("overview.topic.mergeTo", locale)}
                        </div>
                        <div className="form-row">
                          <TopicSelect
                            options={mergeOptions}
                            value={mergeTargets[topic.topic] ?? ""}
                            onChange={(key) =>
                              setMergeTargets((prev) => ({
                                ...prev,
                                [topic.topic]: key,
                              }))
                            }
                            onAddTopic={(label) =>
                              postMessage({ type: "addTopic", label })
                            }
                            addTopicError={addTopicError}
                            lastAddedKey={lastAddedTopicKey}
                            onClearLastAddedKey={onClearLastAddedKey}
                            locale={locale}
                          />
                          <button
                            className="btn-primary"
                            disabled={!mergeTargets[topic.topic]}
                            onClick={() => mergeTopic(topic.topic)}
                          >
                            {t("overview.topic.merge", locale)}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="copy-hint">
                      {t("overview.topic.copyHint", locale)}
                    </div>
                    <button
                      className={`copy-btn${copiedTopic === topic.topic ? " copied" : ""}`}
                      onClick={() =>
                        copyReviewPrompt(topic.topic, displayLabel)
                      }
                    >
                      <span aria-live="polite">
                        {copiedTopic === topic.topic
                          ? t("actions.copied", locale)
                          : t("overview.topic.copyReview", locale)}
                      </span>
                      {copiedTopic === topic.topic ? (
                        <CheckIcon />
                      ) : (
                        <CopyIcon />
                      )}
                    </button>

                    {topicGaps.length > 0 && (
                      <div className="wrong-section">
                        <div className="wrong-section-label">
                          {t("overview.topic.reviewSample", locale)}
                        </div>
                        {[...topicGaps]
                          .sort((a, b) =>
                            a.last_missed.localeCompare(b.last_missed),
                          )
                          .slice(0, 3)
                          .map((gap) => (
                            <div className="wrong-item" key={gap.questionId}>
                              {gap.concept}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
