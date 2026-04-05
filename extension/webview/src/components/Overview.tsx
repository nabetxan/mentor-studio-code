import type {
  DashboardData,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import { CheckIcon, CloseIcon, CopyIcon, EditIcon, TrashIcon } from "./icons";
import { TopicSelect } from "./TopicSelect";

function stripKeyPrefix(label: string): string {
  return label.replace(/^[a-z]-/, "");
}

interface OverviewProps {
  data: DashboardData | null;
  locale: Locale;
  config: MentorStudioConfig | null;
  addTopicError: string | null;
  lastAddedTopicKey: string | null;
  onClearLastAddedKey: () => void;
  deleteTopicErrors: Map<string, string>;
  onClearDeleteTopicErrors: () => void;
}

export function Overview({
  data,
  locale,
  config,
  addTopicError,
  lastAddedTopicKey,
  onClearLastAddedKey,
  deleteTopicErrors,
  onClearDeleteTopicErrors,
}: OverviewProps) {
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {},
  );
  const [editingTopic, setEditingTopic] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [mergeSource, setMergeSource] = useState<string>("");
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [copiedTopic, triggerCopy] = useCopyFeedback();
  const [deleteSelected, setDeleteSelected] = useState<Set<string>>(new Set());
  const [deleteDropdownOpen, setDeleteDropdownOpen] = useState(false);
  const deleteDropdownRef = useRef<HTMLDivElement>(null);

  // Prune deleteSelected when topics or topicsWithHistory change
  useEffect(() => {
    if (deleteSelected.size === 0) return;
    const allTopicKeys = new Set((config?.topics ?? []).map((tp) => tp.key));
    const historySet = new Set(data?.topicsWithHistory ?? []);
    setDeleteSelected((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (allTopicKeys.has(key) && !historySet.has(key)) {
          next.add(key);
        }
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [config?.topics, data?.topicsWithHistory]);

  useEffect(() => {
    if (!deleteDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        deleteDropdownRef.current &&
        !deleteDropdownRef.current.contains(e.target as Node)
      ) {
        setDeleteDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [deleteDropdownOpen]);

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

  function executeMerge() {
    if (mergeSource && mergeTarget) {
      postMessage({
        type: "mergeTopic",
        fromKey: mergeSource,
        toKey: mergeTarget,
      });
      setMergeSource("");
      setMergeTarget("");
    }
  }

  function toggleDeleteSelection(key: string) {
    setDeleteSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function executeDelete() {
    if (deleteSelected.size === 0) return;
    postMessage({ type: "deleteTopics", keys: [...deleteSelected] });
    setDeleteSelected(new Set());
    setDeleteDropdownOpen(false);
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
                    relativePath: ".mentor/current-task.md",
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

      {data.byTopic.length === 0 && data.totalQuestions > 0 && (
        <div className="all-correct-message">
          {t("overview.allCorrect", locale)}
        </div>
      )}

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
            const displayLabel = stripKeyPrefix(resolvedLabel);
            const topicGaps = data.unresolvedGaps.filter(
              (g) => g.topic === topic.topic,
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
                    <button
                      className={`snippet-btn${copiedTopic === topic.topic ? " copied" : ""}`}
                      onClick={() =>
                        copyReviewPrompt(topic.topic, displayLabel)
                      }
                      data-tooltip={t("overview.topic.copyHint", locale)}
                    >
                      <span className="snippet-title">
                        {t("overview.topic.copyReview", locale)}
                      </span>
                      <span className="snippet-icon" aria-live="polite">
                        {copiedTopic === topic.topic ? (
                          <>
                            <CheckIcon />
                            <span className="snippet-copied-text">
                              {t("actions.copied", locale)}
                            </span>
                          </>
                        ) : (
                          <CopyIcon />
                        )}
                      </span>
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

      {(config?.topics ?? []).length > 1 && (
        <div className="merge-topics-section">
          <div className="section-heading">
            {t("overview.topic.mergeSection", locale)}
          </div>
          <div className="merge-topics-row">
            <div className="merge-topics-field">
              <div className="detail-lbl">
                {t("overview.topic.mergeSource", locale)}
              </div>
              <select
                className="form-select"
                value={mergeSource}
                onChange={(e) => {
                  setMergeSource(e.target.value);
                  if (e.target.value === mergeTarget) {
                    setMergeTarget("");
                  }
                }}
              >
                <option value="">
                  {t("overview.topic.mergeSelectSource", locale)}
                </option>
                {[...(config?.topics ?? [])]
                  .sort((a, b) =>
                    a.label.localeCompare(b.label, undefined, {
                      numeric: true,
                    }),
                  )
                  .map((tp) => (
                    <option key={tp.key} value={tp.key}>
                      {stripKeyPrefix(tp.label)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="merge-topics-field">
              <div className="detail-lbl">
                {t("overview.topic.mergeTo", locale)}
              </div>
              <div className="form-row">
                <TopicSelect
                  options={(config?.topics ?? []).filter(
                    (c) => c.key !== mergeSource,
                  )}
                  value={mergeTarget}
                  onChange={(key) => setMergeTarget(key)}
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
                  disabled={!mergeSource || !mergeTarget}
                  onClick={executeMerge}
                >
                  {t("overview.topic.merge", locale)}
                </button>
              </div>
            </div>
          </div>
          {!mergeSource && mergeTarget && (
            <div className="merge-topics-hint">
              {t("overview.topic.mergeSelectSourceHint", locale)}
            </div>
          )}
        </div>
      )}

      {(config?.topics ?? []).length > 0 && (
        <div className="delete-topics-section">
          <div className="section-heading">
            {t("overview.topic.deleteSection", locale)}
          </div>
          {(() => {
            const allTopics = config?.topics ?? [];
            const historySet = new Set(data.topicsWithHistory);
            const hasDisabled = allTopics.some((tp) => historySet.has(tp.key));
            const allDisabled = allTopics.every((tp) => historySet.has(tp.key));
            if (allDisabled) {
              return (
                <div className="delete-topics-hint">
                  {t("overview.topic.noTopics", locale)}
                </div>
              );
            }
            return (
              <>
                <div className="delete-topics-select" ref={deleteDropdownRef}>
                  <button
                    className="form-select"
                    type="button"
                    aria-expanded={deleteDropdownOpen}
                    aria-haspopup="dialog"
                    onClick={() => setDeleteDropdownOpen((prev) => !prev)}
                  >
                    {deleteSelected.size > 0
                      ? t("overview.topic.selectedCount", locale).replace(
                          "{count}",
                          String(deleteSelected.size),
                        )
                      : t("overview.topic.selectTopics", locale)}
                  </button>
                  {deleteDropdownOpen && (
                    <fieldset
                      className="delete-topics-dropdown"
                      aria-label={t("overview.topic.selectTopics", locale)}
                    >
                      {[...allTopics]
                        .sort((a, b) =>
                          a.label.localeCompare(b.label, undefined, {
                            numeric: true,
                          }),
                        )
                        .map((tp) => {
                          const hasData = historySet.has(tp.key);
                          const displayLabel = stripKeyPrefix(tp.label);
                          return (
                            <label
                              key={tp.key}
                              className={`delete-topics-item${hasData ? " disabled" : ""}`}
                            >
                              <input
                                type="checkbox"
                                disabled={hasData}
                                checked={deleteSelected.has(tp.key)}
                                onChange={() => toggleDeleteSelection(tp.key)}
                              />
                              <span>{displayLabel}</span>
                            </label>
                          );
                        })}
                    </fieldset>
                  )}
                </div>
                <div className="delete-topics-actions">
                  <button
                    className="btn-delete"
                    disabled={deleteSelected.size === 0}
                    onClick={executeDelete}
                  >
                    <TrashIcon />
                    {t("overview.topic.delete", locale)}
                  </button>
                </div>
                {deleteTopicErrors.size > 0 && (
                  <div className="delete-topics-error">
                    {[...deleteTopicErrors.values()].join("; ")}
                    <button
                      className="delete-topics-error-dismiss"
                      onClick={onClearDeleteTopicErrors}
                      aria-label={t("overview.error.dismiss", locale)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                )}
                {hasDisabled && (
                  <div className="delete-topics-hint">
                    {t("overview.topic.deleteHint", locale)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
