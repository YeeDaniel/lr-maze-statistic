# CLAUDE.md

## 這是什麼

LINE Rangers 遺跡 LV6 的遺物分數紀錄與分析工具。玩家每趟會經過 20 個檢查點，各拿到一顆遺物，本工具記錄分數並做統計。

已從「單一 HTML、資料硬編碼」改成「別人也能用、各自輸入、存自己瀏覽器、不同步」的靜態網站。

## 檔案地圖

| 路徑 | 內容 |
|---|---|
| `LV6遺物分數分析.md` | **領域知識來源**。計分公式、遺物對照表、六趟實測分析、待確認事項 |
| `index.html` | 進入點，兩個分頁：統計／我的紀錄 |
| `css/base.css` | CSS 變數、深色模式、中文排版 |
| `css/app.css` | 版面與元件樣式 |
| `js/config.js` | LV6 常數 |
| `js/official.js` | 官方遺物分數表（12 組、94 個相異分數） |
| `js/baseline.js` | 作者 6 趟，唯讀基準線 |
| `js/esc.js` | HTML 跳脫工具，使用者可控文字內插前一律經過這裡 |
| `js/decode.js` | 分數反推級距/正負/類型或屬性/候選遺物 |
| `js/stats.js` | 純函式統計 |
| `js/store.js` | localStorage 讀寫、驗證、備份還原 |
| `js/view-chart.js` / `view-detail.js` / `view-dist.js` / `view-entry.js` / `view-manage.js` | 各分頁的畫面模組 |
| `js/main.js` | state 調度，串起各 view 模組 |
| `vendor/chart.umd.js` | Chart.js，本地 vendor 檔 |
| `tests/` | `harness.mjs`（極簡斷言工具）+ `run.mjs`（入口）+ `*.test.mjs` |
| `docs/superpowers/specs/2026-08-05-lv6-relic-local-tool-design.md` | 改版設計文件 |

結構細節見設計文件第三節。

## 領域重點

動任何跟分數有關的程式碼前，先讀 `LV6遺物分數分析.md`。最容易搞錯的幾點：

- **遺物分數是固定值，不是隨機。**「級距 × 正負向 × 類型或屬性 × 效果」四項唯一決定分數。分數變異 100% 來自「掉到哪一顆」
- **總分 =（20 關遺物分數總和 + 1800）× 5**。1800 是「無使用道具」加分
- **負向（減益）遺物分數高於正向**。拿高分等於把自己隊伍削弱，「坐牢」與「高分」是同一件事
- **十二組分數帶兩兩不相交**（3 級距 × 正負 × 類型/屬性），所以分數可反推級距、正負、類型或屬性。推不出來的只有「力/敏/智哪個」或「火/水/木/光/暗哪個」—— 公式裡目標種類不影響分數
- 30% / 50% / 70% / 90% 是正面關，只掉正向遺物，分數天然偏低。**這不是失誤**
- 第 20 關（100% 魔王兔兔）沒有遺物，分數固定 0

### 別把「待確認」寫成規則

md 第六節列了四項尚未確認的觀察（光暗屬性從未出現、正向類型 0/25、負向屬性偏少、八格同分未釐清）。這些是**樣本不足的觀察，不是已證實的遊戲規則**。不要在程式裡寫死，寫死了就永遠驗證不了。

## 慣例

- 專案語言是繁體中文，介面文案、註解、commit 訊息都用中文
- 遺物名稱、效果描述照 md 的用字，不要自己翻譯或簡稱
- 官方資料出自 [github.com/mti0224/rangerbook](https://github.com/mti0224/rangerbook) 的 `res/labyrinth_artifact.json`（437 筆）與 `res/迷宮遺物.json`（55 筆），已內嵌，不需連網
- 網頁版 `/labyrinth/artifact/` 是前端動態載入，直接抓網頁只會拿到空殼

## 技術決策（已定案，別重新提議）

- **無建置**：原生 ES module，沒有 npm、沒有 build step、沒有 node_modules
- **沿用手寫 CSS**：不引入 Tailwind（需要 build，與無建置衝突）
- **維持 Chart.js**：不換 ECharts / amCharts
- **只做 LV6**：關卡序列寫死
- **不做後端**：無帳號、無同步，資料只在 localStorage
- 部署走 GitHub Pages，指 `main` branch root，全用相對路徑
- **XSS 防線**：使用者可控的文字（趟次名稱、備註等）內插進 `innerHTML` 前，一律先經過 `js/esc.js` 的 `esc()` 跳脫

理由都記在設計文件第二節。

## 測試

```bash
node tests/run.mjs
```

node 原生執行，零依賴。純函式模組（`decode` / `stats` / `store` 序列化）直接 import 測。

第 1 條測試（十二組分數帶不重疊）是整個輸入 UX 的前提 —— 它掛了，輸入方式就得從「打分數自動推導」改成完整下拉選單。

## 現況

- 已在 `feat/local-tool` 分支完成十個功能任務，`node tests/run.mjs` 76 通過 0 失敗
- 尚未部署：還沒推上 GitHub、還沒開 Pages
