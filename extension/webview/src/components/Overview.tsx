import type {
  DashboardData,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
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
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!data) {
    return <div className="empty">{t("overview.noData", locale)}</div>;
  }

  function toggleTopic(key: string) {
    setExpandedTopics((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function startEditingLabel(
    key: string,
    currentLabel: string,
    e: React.MouseEvent,
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
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
    }
    const text = t("overview.topic.reviewPrompt", locale).replace(
      "{label}",
      label,
    );
    postMessage({ type: "copy", text });
    setCopiedTopic(key);
    copyTimerRef.current = setTimeout(() => setCopiedTopic(null), 2000);
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
            {data.currentTask === null
              ? t("overview.notStarted", locale)
              : `${t("overview.taskPrefix", locale)} ${data.currentTask}`}
          </div>
          {config?.mentorFiles?.plan && (
            <div className="stat-sub">{config.mentorFiles.plan}</div>
          )}
        </div>
      </div>

      {data.byTopic.length > 0 && (
        <div>
          <div className="section-heading">{t("overview.topics", locale)}</div>
          {data.byTopic.map((topic) => {
            const isExpanded = expandedTopics[topic.topic] ?? false;
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
                      title="保存"
                    >
                      <CheckIcon />
                    </button>
                    <button
                      className="inline-edit-btn cancel"
                      onClick={cancelEditingLabel}
                      title="キャンセル"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <button
                    className="topic-header"
                    onClick={() => toggleTopic(topic.topic)}
                  >
                    <span className="topic-label">{topic.label}</span>
                    <button
                      className="edit-label-btn"
                      onClick={(e) =>
                        startEditingLabel(topic.topic, topic.label, e)
                      }
                      title={t("overview.topic.editLabel", locale)}
                    >
                      <EditIcon />
                    </button>
                    <span className="score-pill">
                      {topic.correct}/{topic.total}問
                    </span>
                    <i
                      className={
                        isExpanded ? "chevron-icon open" : "chevron-icon"
                      }
                    >
                      ›
                    </i>
                  </button>
                )}
                <div className="progress-wrap">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.round(topic.rate * 100)}%` }}
                    />
                  </div>
                  <span className="progress-pct">
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
                      onClick={() => copyReviewPrompt(topic.topic, topic.label)}
                    >
                      <span>
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
                          復習内容の一部
                        </div>
                        {[...topicGaps]
                          .sort((a, b) =>
                            a.first_missed.localeCompare(b.first_missed),
                          )
                          .slice(0, 3)
                          .map((gap) => (
                            <div
                              className="wrong-item"
                              key={`${gap.concept}-${gap.task}`}
                            >
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
