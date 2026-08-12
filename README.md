# 遺跡 LV6 · 遺物分數紀錄

LINE Rangers 遺跡 LV6 的遺物分數紀錄工具。輸入每趟 20 個檢查點的分數，
自動推導遺物級距與正負向，畫出走勢、明細與分數分布。

**資料只存在你自己的瀏覽器**，沒有帳號、沒有後端、不會上傳到任何地方。
你跟別人各自記各自的，互相看不到。換裝置請用「我的紀錄」分頁最下面的
「進階：備份與還原」下載備份，到新裝置貼回去。

## 使用

開網址就能用。手機直接加到主畫面也可以。

第一次開頁面會直接落在「我的紀錄」分頁的輸入表單，由上往下填 20 個檢查點的分數，
按「存檔」就跳到「統計」分頁看走勢、每輪明細與分數分布。輸入分數時工具會用官方
對照表自動反推遺物，同分數對到多顆遺物時（例如力／敏／智三選一）用候選 chip
手動選一顆消歧。備份與還原收在「我的紀錄」分頁最下面的摺疊區。

## 開發

無建置。原生 ES module，沒有 npm、沒有 build step、沒有 node_modules。改完直接開：

```bash
python -m http.server 8000
```

`file://` 開不起來，ES module 受 CORS 限制，一定要透過 HTTP 伺服器。

測試：

```bash
node tests/run.mjs
```

零依賴，不需要 `npm install`。

### 檔案結構

```
index.html          兩個分頁（統計／我的紀錄）
.nojekyll
css/base.css         CSS 變數、深色模式、中文排版
css/app.css           版面與元件樣式
js/config.js          LV6 常數
js/official.js        官方遺物分數表（12 組、94 個相異分數）
js/baseline.js        作者 6 趟，唯讀基準線
js/esc.js             HTML 跳脫工具
js/decode.js          分數反推級距/正負/類型或屬性/候選遺物
js/stats.js           純函式統計
js/store.js           localStorage 讀寫、驗證、匯出匯入
js/view-chart.js      折線圖
js/view-detail.js     每輪明細表
js/view-dist.js       分數分布
js/view-entry.js      輸入表單
js/view-manage.js     趟次管理與匯出匯入
js/main.js            state 調度
vendor/chart.umd.js
tests/harness.mjs     極簡斷言工具
tests/run.mjs         測試入口
tests/*.test.mjs
```

## 資料來源

遺物分數表取自 [github.com/mti0224/rangerbook](https://github.com/mti0224/rangerbook)
的 `res/labyrinth_artifact.json` 與 `res/迷宮遺物.json`，已內嵌，不需連網。

計分結構的完整分析見 [LV6遺物分數分析.md](LV6遺物分數分析.md)。
