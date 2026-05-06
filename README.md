# エスポラーダ北海道 チャントブック

エスポラーダ北海道の応援チャント・選手コールをまとめたWebサイトです。  
GitHub Pages で公開し、会場でのQRコード案内や試合前の予習・復習に使えます。

---

## 公開URL

| ページ | URL | 用途 |
|---|---|---|
| 応援のはじめ方 | https://f000167a.github.io/espolada_chants/intro.html | 会場QR用・新規サポーター向け |
| チャントブック | https://f000167a.github.io/espolada_chants/index.html | 全チャント・選手コール一覧 |
| 試合日程 | https://f000167a.github.io/espolada_chants/next-match.html | 次節情報・全節日程 |

---

## ページ構成

### intro.html（応援のはじめ方）
会場でQRコードを読み込んだ新規来場者向けのページ。

- **STEP 1**：エスポラーダコールに合わせて手拍子
- **STEP 2**：声も出してみよう（チャント例3つ）
- **STEP 3**：全チャント一覧へのリンク

### index.html（チャントブック）
全チャント・選手コールの一覧。タップで歌詞・コールをモーダル表示。

- チームチャント14曲
- 選手コール20名（2026-27シーズン）
- 音源追加に対応した構造（準備中）

### next-match.html（試合日程）
次節の試合情報と全節日程を表示。

- `schedule.json` を読み込んで動的に表示
- 試合結果は espolada_news Bot により自動更新
- ファイナルシーズン情報も表示

---

## ファイル構成

```
espolada_chants/
├── index.html          # チャントブック（全チャント・選手コール一覧）
├── intro.html          # 応援のはじめ方（会場QR用）
├── next-match.html     # 試合日程ページ
├── schedule.json       # 試合日程データ（espolada_news Botが自動更新）
├── scripts/            # その他スクリプト
└── README.md
```

---

## schedule.json の構造

```json
{
  "season": "2026-27",
  "division": "F1",
  "team": "エスポラーダ北海道",
  "updated": "2026-05-06",
  "matches": [
    {
      "node": 1,
      "date": "2026-05-31",
      "time": "13:00",
      "opponent": "しながわシティ",
      "home": true,
      "venue": "苫小牧市総合体育館",
      "result": null,
      "fleague_url": "https://www.fleague.jp/score/?ym=202605"
    }
  ],
  "final_season": { ... }
}
```

- `result` が `null` の場合は未試合（次節として表示）
- `result` は `"○ 3-2"` / `"● 1-4"` / `"△ 2-2"` の形式
- espolada_news の `update_result.py` が試合後に自動更新

---

## 試合結果の自動更新

espolada_news リポジトリの `update_result.py` が以下を行います：

1. espolada.com の試合結果記事を検出
2. スコア・節番号を抽出
3. GitHub API 経由でこのリポジトリの `schedule.json` を更新

手動で更新する場合は `schedule.json` の該当節の `result` を直接編集してください。

---

## 季節ごとの更新作業

| タイミング | 作業内容 |
|---|---|
| シーズン開幕前 | `schedule.json` を新シーズンのデータに差し替え |
| 選手移籍・加入時 | `index.html` の選手コールデータを更新 |
| 新チャント追加時 | `index.html` のチャントデータに追記 |
| 音源追加時 | 各チャント・コールの `audio` フィールドにURLを設定 |

---

## 関連リポジトリ

- [espolada_news](https://github.com/f000167a/espolada_news)：ニュース自動投稿Bot・試合結果自動反映
