# Learning Tracker Rules

学習中（メンターセッションに限らず）に以下を検知したら、docs/mentor/progress.jsonとdocs/mentor/question-history.jsonを自動更新する。

## 記録トリガー

- ユーザーが概念について質問して、理解が不十分だと判断した場合
- メンターのクイズや理解度チェックで間違えた/部分的にしか答えられなかった場合
- コードレビューで概念的な誤解が見つかった場合

→ question-history.json に記録を追加し、progress.json の unresolved_gaps にも追加する

## 解決トリガー

- 復習テストで正しく答えられた場合
- 以前間違えた概念を、別の文脈で正しく説明・使用できた場合

→ question-history.json に correct: true で記録を追加し、progress.json の unresolved_gaps から該当項目を削除する

## 復習タイミング

- 関連タスクに入った時: そのタスクの topic に関連する unresolved_gaps があれば、タスク開始前に復習を提案する
- ユーザーが明示的に復習を頼んだ時

## 注意

- 記録する前に確認してもOK（ただし毎回聞かなくてよい、自然な判断で）
- 正解した問題も question-history.json に記録する（成長の軌跡として）

## データ形式

progress.json の unresolved_gaps:

<!-- ```json
{
  "concept": "概念の名前",
  "topic": "typescript|react|backend|database|auth|validation|api-client|tanstack-query|gamification|deployment",
  "first_missed": "YYYY-MM-DD",
  "task": "タスク番号 or 理解度チェック-QN or session-YYYY-MM-DD",
  "note": "何を間違えたか"
}
```

question-history.json の history エントリ:

```json
{
  "date": "YYYY-MM-DD",
  "task": "タスク識別子",
  "topic": "トピック名",
  "concept": "概念の名前",
  "correct": true
}
``` -->
