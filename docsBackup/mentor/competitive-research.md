# 【個人開発】AI学習トラッキング VSCode Extension「Mentor Studio Code」の類似サービス徹底リサーチ

2026年03月23日

## AI要約

- Mentor Studio Codeは、AIメンター（Claude Code）との学習セッションから生まれるログを自動収集し、正答率・弱点をVSCodeサイドバーで可視化するExtension。
- 既存ツールを調査した結果、「AIメンタリング」「正誤トラッキング」「IDE統合」「弱点可視化」の4つを兼ね備えた製品は存在しない。
- 最も近い競合はGoose Mentor Mode（Block社）だが、まだPoCフェーズで履歴保存・可視化機能がない。市場は急成長中（CAGR 30〜42%）で、ポジションは空いている。

---

## はじめに

AIメンターと一緒にプロジェクトベースでWeb開発を学んでいる中で、「学習ログが散逸する」「自分の弱点が見えない」という課題を感じて作り始めたのが **Mentor Studio Code**。コンセプトは「Claude Codeがメンターとして出した質問の正誤を自動記録 → VSCodeサイドバーで正答率・弱点トピックを可視化」というもの。

開発に入る前に、既存の類似サービスを徹底的にリサーチした。

---

## 競合サービスは大きく5タイプに分かれる

### ① AIコーディングアシスタント（IDE統合型）

コード補完・説明が主目的。学習トラッキング機能はほぼない。

| アプリ | リリース | ユーザー数 | 学習機能 |
|---|---|---|---|
| **GitHub Copilot** | 2022年 | 1億+の開発者基盤 | Student Plan（2026年3月〜）で学習向け"Experiences"追加。ただし正誤トラッキング・弱点分析なし |
| **Cursor** | 2023年 | 急成長中（非公開） | Student Plan無料。コード説明可能だが学習管理機能ゼロ |
| **Amazon Q Developer** | 2024年（旧CodeWhisperer） | 非公開 | 学習機能なし。純粋な生産性ツール |
| **Cline** (VSCode Extension) | — | 240万インストール | 自律エージェント。学習機能なし |
| **Roo Code** (VSCode Extension) | — | 90万インストール | "Ask"モードあるが構造化学習・トラッキングなし |

**このカテゴリの特徴：** 全員が「コードを書く生産性」にフォーカスしており、「学ぶ → 理解度を測る → 弱点を潰す」というサイクルは提供していない。

---

### ② AIメンターモード（最も近い競合）

**Goose Mentor Mode（Block社 / 旧Square）** — Mentor Studio Codeに最も近いコンセプト。

- **リリース：** 2025年8月（PoC）
- **OSS：** GitHub: block/goose（5,000+ Stars）
- **特徴：**
  - AIアシスタンスを「自動化」から「教育」に変えるコンセプト
  - スキルギャップ分析で学習すべき領域を特定
  - 開発者の経験レベルに応じた動的アシスタンス調整
  - ジュニア vs シニアで異なるレスポンス
- **現状：** まだPoCフェーズ。少数のジュニア開発者でテスト中
- **価格：** 無料 / OSS

**Mentor Studio Codeとの違い：**
- Gooseは **CLI** ベース。VSCodeサイドバーダッシュボードなし
- **質問履歴の永続化なし**（セッション単位で消える）
- 正答率の可視化・トピック別弱点分析なし
- まだPoCで、本格的なプロダクトではない

**Khanmigo / Code Tutor（Khan Academy）**

- **リリース：** 2023年
- **ユーザー：** 140万+（2025年時点。全教科合計。1年で68K→140万に急成長）
- **特徴：** ソクラテス式対話、JS/HTML/Python/SQL対応、コード演習に文脈対応した説明
- **価格：** 教師無料 / 学生$4/月

**Mentor Studio Codeとの違い：**
- Webブラウザベース（IDE統合なし）
- Khan Academy のカリキュラムに閉じた学習
- 自分のプロジェクトベースの学習には使えない

---

### ③ プログラミング学習プラットフォーム（進捗トラッキングあり）

Webベースの学習サービス。進捗管理はあるが、IDE統合・AIメンタリングは弱い。

| プラットフォーム | 設立 | ユーザー | 特徴 | 価格 |
|---|---|---|---|---|
| **Exercism** | 2013年 | 200万 | 82言語、**人間メンターがコードレビュー**、バッジ/レピュテーション | 無料（OSS） |
| **LeetCode** | 2015年 | 1,000万+（推定） | 3,000+問題、企業別出題傾向（Premium）、コミュニティ製Progress Tracker | 無料 / Premium $35/月 |
| **HackerRank** | 2012年 | 2,600+企業利用 | スキルアセスメント、AI評価、ファネル分析ダッシュボード | Starter $165/月〜 |
| **freeCodeCamp** | 2014年 | 数百万 | 無料、プロジェクトベース、認定制度 | 無料 |
| **Codecademy** | 2011年 | 数百万 | AI補助、Teams向け管理ダッシュボード | 無料〜 / Pro $20-35/月 |

**このカテゴリの特徴：**
- 全てWebブラウザベース（IDE統合なし）
- Exercismは人間メンターだがAIではない
- 進捗トラッキングは「解いた問題数」が中心で、概念レベルの弱点分析は弱い
- **自分のプロジェクトに紐づいた学習**はできない（プラットフォーム内の問題セット限定）

---

### ④ 間隔反復 / クイズツール（開発者向け）

スペースドリピティションで知識定着を狙うツール。

| ツール | 特徴 | 価格 |
|---|---|---|
| **Execute Program** | TypeScript/JS/SQL/Regexの間隔反復学習。コード実行可能。1日20分 | $39/月 or $235/年 |
| **FlashCode** (VSCode Extension) | VSCode内でフラッシュカード作成・復習。JSON形式 | 無料 |
| **Recall** (VSCode Extension) | VSCode内のスペースドリピティション | 無料 |
| **Anki for VSCode** | ローカルAnkiとの連携 | 無料 |

**このカテゴリの特徴：**
- Execute Programは設計が洗練されているが、対象言語が限定的でWeb限定
- FlashCode/RecallはVSCode内だが、AI機能なし・アナリティクスなし
- **いずれもAIメンターとの連携・自動ログ収集なし**

---

### ⑤ スキルアセスメントプラットフォーム

| ツール | 特徴 | 状態 |
|---|---|---|
| **Pluralsight Skill IQ** | ベイジアン統計+MLの適応型アセスメント。10-15分で25問。0-300スコア。ギャップに基づくコンテンツ推薦 | 現役（スコアのみ無料） |
| **LinkedIn Skill Assessments** | 15問MC、上位30%でバッジ | **2024年終了** |

**このカテゴリの特徴：**
- Pluralsight Skill IQはギャップ特定がMentor Studio Codeに近い
- ただしWeb限定・オンデマンドアセスメント（継続トラッキングではない）
- 自分のプロジェクトとは無関係

---

## GitHub上のOSSプロジェクト

| プロジェクト | Stars | 概要 |
|---|---|---|
| block/goose (Mentor Mode) | 5,000+ | AIエージェントのメンターモード（上述） |
| harlleybastos/relearn-programming | 4 | GitHub Copilotでゲーミフィケーション学習、XPシステム |
| kunalshah03/CodeMentor-AI | 0 | コード分析 + 学習パス生成 |
| coding-repetition | 0 | VSCodeのスペースドリピティション |
| recallcode-ai | 0 | AIコーチング + スペースドリピティション |

**結論：OSSでもこの領域は未開拓。** 有意なトラクションを持つプロジェクトはGooseのみ。

---

## 市場データ

| 指標 | 数値 | ソース |
|---|---|---|
| AI教育市場規模（2025年） | $6.9B | Mordor Intelligence |
| AI教育市場予測（2030年） | $41B（CAGR 42.83%） | Mordor Intelligence |
| AIチューター市場（2024年） | $1.63B | Grand View Research |
| AIチューター市場予測（2030年） | $7.99B（CAGR 30.5%） | Grand View Research |

**成長シグナル：**
- KhanmigoはAI導入後1年でユーザー68K → 140万に急成長（20倍）
- VSCodeのエージェント系Extensionが最速成長カテゴリ（Cline: 240万インストール）

---

## Mentor Studio Codeの差別化ポイント

### 市場の隙間はここにある

既存ツールの大半は「コードを書く生産性」か「Webブラウザ上の学習プラットフォーム」。**IDE内でAIメンターの学習ログを自動収集・可視化**するツールは存在しない。

4象限で整理すると：

```
                    IDE統合あり
                        │
        Mentor Studio   │  GitHub Copilot
        Code ★          │  Cursor / Cline
        (ここが空白)     │  (生産性ツール)
                        │
 学習トラッキング ───────┼─────── 生産性重視
        あり            │         のみ
                        │
        Exercism        │  Amazon Q
        LeetCode        │  CodeWhisperer
        Pluralsight     │
        (Webのみ)       │
                        │
                    Webのみ
```

### 差別化の具体的な軸

1. **AIセッションからの自動ログ収集** — 他のツールは手動入力 or プラットフォーム内限定。Mentor Studio Codeは Claude Code が書き込むJSONをFile Watcherで自動検知
2. **概念レベルの弱点トラッキング** — 「TypeScriptの正答率50%」だけでなく「`interface vs type` が未解決」まで追跡。Pluralsight Skill IQに近いがリアルタイム・継続的
3. **自分のプロジェクトに紐づく学習** — LeetCode/Exercismはプラットフォーム内の問題限定。Mentor Studio Codeは実際のプロジェクト開発の中で学ぶ
4. **VSCodeサイドバー完結** — FlashCode/Recallを除き、学習ツールは全てWebブラウザ遷移が必要
5. **復習ループの自動化** — `unresolved_gaps` に基づきAIが関連タスク開始時に復習を提案。Execute Programのスペースドリピティションに近いが、AI駆動

### Goose Mentor Mode との勝負

最も近い競合だが、現時点で以下の差がある：

| 比較軸 | Goose Mentor Mode | Mentor Studio Code |
|---|---|---|
| UI | CLIのみ | VSCodeサイドバーダッシュボード |
| 学習履歴 | セッション内で消える | JSON永続化 + 将来DB同期 |
| 弱点可視化 | スキルギャップ分析（対話内） | トピック別正答率 + unresolved gaps |
| 復習 | なし | 未解決概念の自動再出題 |
| ステータス | PoC（2025年8月〜） | Phase 1実装中 |

### 懸念点

- **GitHub Copilotが学習機能を本格化するリスク** — Student Plan（2026年3月〜）で"Experiences"を追加中。Microsoftが本気を出せば市場ごと持っていかれる可能性
- **Goose Mentor ModeがPoCから本格プロダクトに成長するリスク** — Block社（旧Square）のリソースは大きい
- **Claude Code依存** — メンター機能がClaude Codeに依存しているため、Claude Code側の仕様変更に影響を受ける
- **ユーザー獲得** — 「Claude Code Pro + VSCode + AIメンターで学習している人」というニッチなターゲット。市場教育コストが高い

---

## まとめ

Mentor Studio Codeの競合リサーチで見えてきたのは、**「AIメンタリング × 学習トラッキング × IDE統合 × 弱点可視化」を兼ね備えたツールは現時点で存在しない**ということ。

- AIコーディングアシスタント → 学習トラッキングがない
- 学習プラットフォーム → IDE統合がない
- VSCode学習Extension → AIもアナリティクスもない
- Goose Mentor Mode → 一番近いがPoCで履歴保存・可視化がない

AI教育市場はCAGR 30-42%で急成長中。Khanmigoの1年で20倍の成長が示すように、AIメンタリングへの需要は爆発的に増えている。

**「自分のプロジェクトで学びながら、弱点が自動で可視化される」** — このUXを提供できるのは今のところMentor Studio Codeだけ。

ニッチだが、刺さる人には深く刺さるポジション。まずはPhase 1を完成させて、Claude Codeユーザーコミュニティに投げてみよう。
