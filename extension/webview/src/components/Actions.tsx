import type { Locale } from "@mentor-studio/shared";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import type { TranslationKey } from "../i18n";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import { CheckIcon, CopyIcon } from "./icons";

interface Snippet {
  id: string;
  titleKey: TranslationKey;
  promptKey: TranslationKey;
  tooltipKey: TranslationKey;
}

const SNIPPETS: Snippet[] = [
  {
    id: "start-next-task",
    titleKey: "actions.startNextTask",
    promptKey: "actions.prompt.startNextTask",
    tooltipKey: "actions.tooltip.startNextTask",
  },
  {
    id: "review-implementation",
    titleKey: "actions.reviewImplementation",
    promptKey: "actions.prompt.reviewImplementation",
    tooltipKey: "actions.tooltip.reviewImplementation",
  },
  {
    id: "start-review",
    titleKey: "actions.startReview",
    promptKey: "actions.prompt.startReview",
    tooltipKey: "actions.tooltip.startReview",
  },
  {
    id: "start-check",
    titleKey: "actions.startCheck",
    promptKey: "actions.prompt.startCheck",
    tooltipKey: "actions.tooltip.startCheck",
  },
];

interface ActionsProps {
  locale: Locale;
}

export function Actions({ locale }: ActionsProps) {
  const [copiedId, triggerCopy] = useCopyFeedback();

  const handleCopy = (snippet: Snippet) => {
    triggerCopy(snippet.id);
    postMessage({ type: "copy", text: t(snippet.promptKey, locale) });
  };

  return (
    <div className="actions">
      <div className="snippet-list">
        {SNIPPETS.map((snippet) => (
          <button
            className={`snippet-btn${copiedId === snippet.id ? " copied" : ""}`}
            key={snippet.id}
            onClick={() => handleCopy(snippet)}
            data-tooltip={t(snippet.tooltipKey, locale)}
          >
            <span className="snippet-title">{t(snippet.titleKey, locale)}</span>
            <span className="snippet-icon" aria-live="polite">
              {copiedId === snippet.id ? (
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
        ))}
      </div>
      <p className="actions-description">{t("actions.description", locale)}</p>
    </div>
  );
}
