# 拿掉共享、把輸入放到第一位

日期：2026-08-12

## 問題

工具的資料輸入本來就是表單（`js/view-entry.js` 的 20 格分數輸入框），不需要 JSON。但實際使用時，
JSON 仍然是使用者最先撞到的東西：

- 「我的紀錄」分頁的排版是趟次列表 → 備份 → 匯入 → 才輪到「新增一趟」按鈕（`index.html` 的
  `#manage` 排在 `#entry` 前面）。使用者要滑過整個備份／匯入區才看得到輸入入口
- 匯入區明擺著寫「把匯出的 JSON 貼在這裡」，還附帶「我自己的／朋友的」歸屬選擇與朋友名字欄位。
  不懂 JSON 的人看到這塊會以為那是必經流程
- 新使用者第一次開頁面落在「統計」分頁，看到的全是內建 6 趟的圖，沒有任何字告訴他要去哪裡輸入

同時，「朋友的（只拿來比較）」這條跨瀏覽器共享路線並不符合實際需求。每個人只要看自己的紀錄，
不需要把別人的資料匯進自己這台。這條路線是 JSON 複雜度的唯一來源，但沒有人要用。

## 目標

- 一般使用者從頭到尾不會看到「JSON」這個詞
- 第一次開頁面就在打分數，不需要找入口
- 備份能力保留 —— 清瀏覽器資料仍然會全毀，得留一條救援管道，只是退到進階區

## 非目標

- 不做後端、不做帳號、不做同步（沿用既有技術決策）
- 不動內建 6 趟基準線。它是唯讀參考資料，不是「別人的紀錄」，`meanBasis` 的
  「滿 2 趟改用自己的」邏輯照舊
- 不動輸入表單本身的互動（分數自動推導、候選 chip 消歧、草稿保存都維持現狀）

## 設計

### 一、拿掉「朋友的」

`imported` 這個 origin 整個廢掉。留下的 origin 只有 `builtin`（內建 6 趟，唯讀）與 `mine`。

- `js/store.js`：`parseImport(text, origin, from)` 簡化成 `parseImport(text)`，回傳的每一趟一律
  `origin: 'mine'`，不再帶 `from` 欄位
- `js/store.js`：`load()` 讀出來時把 `origin === 'imported'` 的趟一律當成 `mine`。專案還沒部署，
  理論上不存在這種資料，但成本只有一行
- `js/view-manage.js`：刪掉匯入區的 mine／imported radio 與 `#im-from` 輸入框；`buildList` 的
  `` `來自 ${r.from}` `` badge 分支刪掉（`內建` badge 保留）
- `js/stats.js`：`meanBasis` 的邏輯不變（`mine` 滿 2 趟才用自己的，否則退回 `builtin`），只更新
  註解裡「imported（朋友的）永不計入」這句已經不成立的描述

測試異動：`tests/store.test.mjs` 的「匯入標成 imported 並記來源」改寫成「匯入一律標成 mine」；
`tests/view-manage.test.mjs` 的 friend fixture 拿掉。

### 二、備份收進摺疊區

「我的紀錄」分頁下方的備份與匯入合併成一個預設收合的 `<details>`：

```
▸ 進階：備份與還原
```

展開後才有「複製到剪貼簿」「下載 .json」與還原用的 textarea。文案改成用途導向：

- 區塊說明：換手機或清瀏覽器資料前，先下載一份備份
- textarea placeholder：把備份的內容貼在這裡

標題與說明不出現「JSON」字樣。「下載 .json」按鈕保留副檔名，因為那是使用者真的會在檔案總管裡
看到的東西，藏起來反而找不到檔案。

### 三、首次進場落在輸入頁

開機時判斷一次，使用者自己的紀錄是 0 趟就：

- `js/main.js`：`state.tab` 設成 `'manage'`
- `js/view-entry.js`：自動 `open(blankRun(...))`，表單直接展開

只在開機判一次，用 module 層的 flag 擋住。若每次 render 都判，使用者按「取消」關掉表單後會被
立刻強制重開，形成關不掉的迴圈。

已有草稿時走既有的草稿還原路徑，不覆蓋草稿。

### 四、「我的紀錄」分頁順序對調

`index.html` 裡 `#entry` 移到 `#manage` 前面。輸入表單在最上面，趟次列表次之，備份摺疊區墊底。

### 五、存檔後跳到統計分頁

`view-entry.js` 的 `commit()` 存檔成功後切到「統計」分頁，讓使用者立刻看到自己那條線被畫出來。

需要在 `js/main.js` 的 `actions` 物件新增 `setTab`（`main.js` 已有同名的 export 函式，接上去即可）。
存檔失敗時不切分頁 —— 現有邏輯在失敗時會保留表單與草稿並顯示橫幅，把使用者送去別的分頁會讓他
看不到那個橫幅。

## 影響範圍

| 檔案 | 異動 |
|---|---|
| `index.html` | `#entry` 與 `#manage` 對調 |
| `js/store.js` | `parseImport` 簽名簡化；`load` 相容舊 `imported` |
| `js/stats.js` | 只改註解 |
| `js/view-manage.js` | 刪歸屬選擇；備份／匯入包進 `<details>`；文案改寫 |
| `js/view-entry.js` | 開機自動開表單；存檔成功後切分頁 |
| `js/main.js` | 開機依紀錄數決定初始 tab；`actions` 加 `setTab` |
| `css/app.css` | `<details>` 樣式 |
| `tests/store.test.mjs` | 匯入測試改寫 |
| `tests/view-manage.test.mjs` | friend fixture 拿掉 |
| `README.md` | 使用說明同步 |

## 驗收

- `node tests/run.mjs` 全通過
- 全新瀏覽器（清空 localStorage）開頁面 → 直接看到展開的輸入表單
- 打完一趟按存檔 → 自動跳到統計分頁，圖上多一條自己的線
- 頁面上找不到「JSON」字樣，除了「下載 .json」按鈕
- 展開「進階：備份與還原」→ 下載、還原都正常
- 還原一份備份 → 進來的趟都是自己的，沒有「來自 XXX」badge
