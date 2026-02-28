# 日本史クイズ PWA

Notionで問題を管理し、GitHub ActionsでJSONに変換、GitHub Pagesで公開するPWAです。

## 構成

```
/
├── index.html          # PWA本体
├── questions.json      # 問題データ（Actionsが自動生成）
├── manifest.json       # PWAマニフェスト
├── sw.js               # Service Worker
├── scripts/
│   └── fetch-notion.js # Notion→JSON変換スクリプト
└── .github/workflows/
    └── sync-notion.yml # 毎日自動同期ジョブ
```

## セットアップ手順

### 1. GitHubリポジトリ作成
このフォルダの中身をすべてpublicリポジトリにpushします。

### 2. Notion APIキーをSecretに登録
1. Notionで **インテグレーション** を作成 → APIキー（`secret_xxx`）をコピー
2. GitHub → Settings → Secrets and variables → Actions → `New repository secret`
3. 名前: `NOTION_API_KEY`、値: コピーしたAPIキーを貼り付け

### 3. Notionの権限設定
クイズのデータベースに作成したインテグレーションを **接続** してください。
（DBを開く → 右上「…」→ 接続を追加）

### 4. GitHub Pagesを有効化
Settings → Pages → Source: `main` ブランチの `/`（root）→ Save

数分後に `https://{username}.github.io/{repo}/` でアクセスできます。

### 5. 初回同期
GitHub → Actions → 「Sync Notion → questions.json」→ 「Run workflow」で手動実行。
以降は毎日JST 04:00に自動同期されます。

## Notionデータベースの構造

| プロパティ名 | タイプ | 説明 |
|---|---|---|
| 問題文 | タイトル | 問題本文 |
| 選択肢A〜D | テキスト | 各選択肢 |
| 正解 | セレクト | A / B / C / D |
| 難易度 | セレクト | `★ やさしい` / `★★ ふつう` / `★★★ むずかしい` |
| 時代 | セレクト | `縄文・弥生` / `古墳・飛鳥` / `奈良・平安` / `鎌倉・室町` / `戦国・安土桃山` / `江戸` / `明治・大正` / `昭和・近現代` |
| ヒント文 | テキスト | 不正解時に表示するヒント |
| ステータス | セレクト | `完成`のものだけ取り込まれます |

## 管理画面

タイトル画面で「管理画面」ボタン → パスワード: `poopoo0730`

- **questions.json を再読込**: 最新データを手動で反映（キャッシュバスター付き）
- データリセット機能
