import type { Locale } from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import type { TranslationKey } from "../i18n";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import { CheckIcon, CopyIcon } from "./icons";

interface Snippet {
  id: string;
  titleKey: TranslationKey;
  promptKey: TranslationKey;
}

const SNIPPETS: Snippet[] = [
  {
    id: "start-next-task",
    titleKey: "actions.startNextTask",
    promptKey: "actions.prompt.startNextTask",
  },
  {
    id: "review-implementation",
    titleKey: "actions.reviewImplementation",
    promptKey: "actions.prompt.reviewImplementation",
  },
  {
    id: "start-review",
    titleKey: "actions.startReview",
    promptKey: "actions.prompt.startReview",
  },
  {
    id: "start-check",
    titleKey: "actions.startCheck",
    promptKey: "actions.prompt.startCheck",
  },
];

interface ActionsProps {
  locale: Locale;
}

export function Actions({ locale }: ActionsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = (snippet: Snippet) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setCopiedId(snippet.id);
    postMessage({ type: "copy", text: t(snippet.promptKey, locale) });
    timerRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="actions">
      <p className="actions-description">{t("actions.description", locale)}</p>
      <div className="snippet-list">
        {SNIPPETS.map((snippet) => (
          <button
            className={`snippet-btn${copiedId === snippet.id ? " copied" : ""}`}
            key={snippet.id}
            onClick={() => handleCopy(snippet)}
          >
            <span className="snippet-title">{t(snippet.titleKey, locale)}</span>
            <span className="snippet-icon">
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
    </div>
  );
}
