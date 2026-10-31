# W7：Apps Script Webhook + 本地模型轉接站

依照老師 W7 的路徑整理：LINE webhook 留在 Apps Script；「查 …／搜尋 …」送到電腦上的 Ollama 本地模型，由模型自行決定何時搜尋並回傳來源；若 Ollama 搜尋功能未登入或沒有結果，轉接站改用公開維基百科 API 找來源，再交給本地模型整理。這份可獨立執行的 `Code.gs` 將其他文字記成試算表待辦。因目前找不到原 W5 Apps Script 程式，這份範例保留文字待辦流程，不包含原 W5 的照片／日曆功能。

## 檔案

- `Code.gs`：獨立 W7 webhook 範例，金鑰與轉接網址從指令碼屬性讀取。
- `line-search-relay.mjs`：老師提供的 Node.js 轉接站，使用本機 Ollama web search/fetch，並可啟動 Cloudflare quick tunnel。
- `課堂示範流程.md`：上課展示順序。

## 安裝與執行轉接站（Windows PowerShell）

1. 安裝 Ollama、Node.js LTS、cloudflared；用 `ollama list` 確認模型已安裝。預設模型是 `gemma4:e4b`。若電腦已有 `gemma4:e2b`，可在本視窗先設定 `$env:MODEL="gemma4:e2b"`。
2. 將 `line-search-relay.mjs` 與 `cloudflared.exe` 放在同一個 `line-relay` 資料夾，進入該資料夾並把它加進 PATH：

   ```powershell
   Set-Location "$env:USERPROFILE\line-relay"
   $env:PATH += ";$env:USERPROFILE\line-relay"
   node line-search-relay.mjs
   ```

3. 等轉接站載入模型並印出 Cloudflare 網址。轉接密碼由程式放在使用者家目錄的 `.line-search-relay.key`，不會印在視窗；程式會將密碼複製到剪貼簿。保持此視窗開啟。
4. 單機檢查可用 `node line-search-relay.mjs --no-tunnel`；健康檢查路徑為 `/health`。對 Apps Script 的 API 是 `POST /ask`，密碼標頭為 `x-relay-key`。另有 `/check-key` 供 Apps Script `testSetup` 驗證密碼。Ollama 搜尋無法使用時會自動改用維基百科 API。

## Apps Script 設定

1. 將 `Code.gs` 放入 Apps Script 專案並部署成 Web App，執行身分選自己、存取權設為 LINE webhook 能呼叫的選項。若找到原 W5 專案，依老師課程頁將 `askLocalSearch_` 與查詢分流併入 W5，保留原有待辦和照片函式。
2. 在 Apps Script「專案設定 → 指令碼屬性」設定 `LINE_CHANNEL_ACCESS_TOKEN`、`SEARCH_RELAY_URL`（轉接站印出的臨時 HTTPS 網址）與 `SEARCH_RELAY_KEY`（轉接站建立的密碼）。可選填 `SPREADSHEET_ID`；不填時第一次記待辦會自動建立試算表並記住 ID。
3. 將部署後的 Web App 網址填入 LINE Developers 的 Webhook URL 並啟用 webhook；`/exec` 網址不要放 repo 或截圖。
4. LINE 傳 `查 2026 年諾貝爾物理獎得主是誰？`，確認手機回答含來源；relay 視窗會印出收到一題與處理狀態。一般文字照舊進待辦流程。

## 我改了什麼

- 使用老師指定的 `SEARCH_RELAY_URL`／`SEARCH_RELAY_KEY` 及 `x-relay-key` API，不把密碼放網址或程式碼。
- `Code.gs` 的查詢分支限定「查／搜尋」後接空白或冒號，呼叫本機 relay；成功回覆答案與來源，失敗時明確回報，不把查詢寫成待辦。
- 其他文字直接記入試算表待辦；這是獨立範例，待找到 W5 原始程式後應把查詢分支合併回原程式，以保留照片與日曆功能。
- 轉接站優先使用本機 Ollama 模型的網路搜尋工具；Ollama 未登入或無搜尋結果時，改以維基百科 API 搜尋。來源 URL 由實際結果產生，回答仍由本機模型完成。

## 安全

不要將 LINE 長效通行碼、Channel secret、Gemini key、`SEARCH_RELAY_KEY`、轉接網址或 Apps Script `/exec` 網址寫入 repo 或截圖。密碼與網址只放 Apps Script 指令碼屬性；轉接密碼檔留在使用者家目錄。

## 課堂示範

參考 [課堂示範流程](課堂示範流程.md)。
