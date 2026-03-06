// scripts/fetch-notion.js
// Node.js 20 (built-in fetch) で動作。依存パッケージ不要。
// 実行: NOTION_API_KEY=secret_xxx node scripts/fetch-notion.js
//
// 変更検知の仕組み:
//   1. 既存の questions.json から前回の generatedAt を読む
//   2. Notionに「前回以降に更新されたページ」だけ問い合わせる（1件クエリ）
//   3. 変更がなければ "NO_CHANGE" を標準出力に書いてexit(0)
//   4. 変更があれば全件取得してJSONを書き出す

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const NOTION_DB_ID = '518d967babdf4bddb687264b1999d75b';
const API_KEY      = process.env.NOTION_API_KEY;
const OUT_PATH     = join(dirname(fileURLToPath(import.meta.url)), '..', 'questions.json');

if (!API_KEY) {
  console.error('❌ 環境変数 NOTION_API_KEY が設定されていません');
  process.exit(1);
}

// ─── ヘルパー ───────────────────────────────────────
const getText   = prop => prop?.rich_text?.[0]?.plain_text ?? '';
const getTitle  = prop => prop?.title?.[0]?.plain_text      ?? '';
const getSelect = prop => prop?.select?.name                 ?? '';

async function notionQuery(body) {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':   'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── 変更チェック（1件だけ問い合わせ） ──────────────
async function hasChanges(since) {
  // since が null（初回）なら必ず全取得
  if (!since) return true;

  const json = await notionQuery({
    filter: {
      and: [
        { property: 'ステータス', select: { equals: '完成' } },
        { timestamp: 'last_edited_time', last_edited_time: { after: since } },
      ],
    },
    page_size: 1, // 1件見つかれば十分
  });

  return json.results.length > 0;
}

// ─── 全件取得 ────────────────────────────────────────
async function fetchAll() {
  const byEra = {};
  let hasMore = true, cursor = undefined, total = 0;

  while (hasMore) {
    const json = await notionQuery({
      filter: { property: 'ステータス', select: { equals: '完成' } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    for (const page of json.results) {
      const p   = page.properties;
      const era = getSelect(p['時代']);
      if (!era) continue;
      const question = getTitle(p['問題文']);
      if (!question) continue;

      const answerLetter = getSelect(p['正解']) || 'A';
      if (!byEra[era]) byEra[era] = [];
      byEra[era].push({
        question,
        choices: [
          getText(p['選択肢A']),
          getText(p['選択肢B']),
          getText(p['選択肢C']),
          getText(p['選択肢D']),
        ],
        answer:     { A:0, B:1, C:2, D:3 }[answerLetter] ?? 0,
        hint:       getText(p['ヒント文']),
        difficulty: getSelect(p['難易度']),
      });
      total++;
    }

    hasMore = json.has_more;
    cursor  = json.next_cursor;
  }

  return { byEra, total };
}

// ─── メイン ──────────────────────────────────────────
async function main() {
  // 前回の同期日時を取得
  let lastSyncedAt = null;
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
      // "初回同期前" などの文字列は無視
      if (prev.generatedAt && prev.generatedAt.includes('T')) {
        lastSyncedAt = prev.generatedAt;
      }
    } catch { /* 壊れていたら無視 */ }
  }

  console.log(`⏰ 前回同期: ${lastSyncedAt ?? '（初回）'}`);
  console.log('🔍 Notionの変更を確認中...');

  const changed = await hasChanges(lastSyncedAt);

  if (!changed) {
    console.log('✅ 変更なし — questions.json の更新をスキップします');
    // GitHub Actionsのステップで参照できるように特別な文字列を出力
    console.log('NO_CHANGE');
    process.exit(0);
  }

  console.log('📥 変更を検出！ 全件取得中...');
  const { byEra, total } = await fetchAll();

  console.log(`✅ 合計 ${total} 問を取得`);
  for (const [era, qs] of Object.entries(byEra)) {
    console.log(`   ${era}: ${qs.length}問`);
  }

  writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalCount:  total,
    questions:   byEra,
  }, null, 2), 'utf-8');

  console.log(`📄 ${OUT_PATH} を更新しました`);
}

main().catch(err => { console.error(err); process.exit(1); });
