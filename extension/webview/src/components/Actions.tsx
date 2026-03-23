import { useEffect, useRef, useState } from "react";
import { postMessage } from "../vscodeApi";

interface Snippet {
  id: string;
  title: string;
  prompt: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: "start-next-task",
    title: "Start next task",
    prompt:
      "docs/mentor/rules/MENTOR_RULES.md を読んで、次のタスクを始めてください。",
  },
  {
    id: "review-implementation",
    title: "Review implementation",
    prompt:
      "docs/mentor/rules/MENTOR_RULES.md を読んで、現在のタスクの実装をレビューしてください。",
  },
  {
    id: "start-review",
    title: "Start 復習",
    prompt:
      "docs/mentor/rules/MENTOR_RULES.md を読んで、unresolved_gaps にある概念の復習を始めてください。",
  },
  {
    id: "start-check",
    title: "Start 理解度チェック",
    prompt:
      "docs/mentor/rules/MENTOR_RULES.md を読んで、app-design と roadmap を確認し、現在のタスクに関連する理解度チェックを実施してください。",
  },
];

export function Actions() {
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
    postMessage({ type: "copy", text: snippet.prompt });
    timerRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="actions">
      <h3>Mentor Actions</h3>
      <ul className="snippet-list">
        {SNIPPETS.map((snippet) => (
          <li className="snippet-card" key={snippet.id}>
            <span className="snippet-title">{snippet.title}</span>
            <button
              className="snippet-copy"
              onClick={() => handleCopy(snippet)}
              title="Copy prompt to clipboard"
            >
              {copiedId === snippet.id ? "✓" : "📋"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
