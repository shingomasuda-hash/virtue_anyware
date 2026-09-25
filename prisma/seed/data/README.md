# 案件管理のダミーデータ

現行の Google スプレッドシート「顧客・案件管理シート」（太陽光・蓄電池の訪販）から
各シートを CSV へ書き出したもの。**すべて架空のダミーデータ**で実在の顧客情報は含まない。

| ファイル | 元シート | 行数 | 用途 |
| --- | --- | --- | --- |
| `deal-customers.csv` | 顧客マスター | 40 | `customers` |
| `deals.csv` | 案件管理 | 40 | `deals` |
| `deal-progress.csv` | 進捗管理 | 21 | `deal_progresses`（契約以降の案件のみ） |
| `deal-compensations.csv` | 報酬管理 | 21 | `deal_compensations` |
| `deal-masters.csv` | マスター | 18 | プルダウン候補（案件ステータス・メーカー・信販会社等） |

`prisma/seed/deals.ts` がこれを読み込んでシードする。
報酬管理の計算列（原価合計・営業利益・各コミッション・会社残粗利）は
`tests/unit/deal-compensation.test.ts` で計算ロジックの検算に使う。
