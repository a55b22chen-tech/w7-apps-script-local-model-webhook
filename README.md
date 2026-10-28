# W7：Apps Script Webhook + 本地模型轉接站

依照老師 W7 互動頁的介面整理：LINE webhook 留在 Apps Script；「查 …／搜尋 …」送到電腦上的 Ollama 本地模型，由模型自行決定何時使用網路搜尋並回傳來源；其他文字、照片維持待辦小秘書流程。

## 檔案

- `Code.gs`：W7 Apps Script 對照程式，金鑰與轉接網址從指令碼屬性讀取。
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
4. 單機檢查可用 `node line-search-relay.mjs --no-tunnel`；健康檢查路徑為 `/health`。對 Apps Script 的 API 是 `POST /ask`，密碼標頭為 `x-relay-key`。另有 `/check-key` 供 Apps Script `testSetup` 驗證密碼。

## Apps Script 設定

1. 將 `Code.gs` 的 W7 對照程式放入 Apps Script 專案。若要接續自己的 W5 專案，先依老師課程頁對照差異，只把查詢分流與 `askLocalSearch` 加進原程式，保留原有待辦、照片等函式。
2. 在 Apps Script「專案設定 → 指令碼屬性」設定 `SEARCH_RELAY_URL`（轉接站印出的臨時 HTTPS 網址）與 `SEARCH_RELAY_KEY`（從剪貼簿貼上）。程式不需重新部署即可更新這兩個屬性；通道重開換網址時更新 URL。
3. LINE token、Gemini key 與試算表 ID 依原專案既有設定存於指令碼屬性。將已部署 Web App 的 webhook URL 設在 LINE Developers；部署 URL 不放 repo 或截圖。
4. LINE 傳 `查 2026 年諾貝爾物理獎得主是誰？`，確認手機回答含來源；relay 視窗會印出收到一題與處理狀態。一般文字照舊進待辦流程。

## 我改了什麼

- 使用老師指定的 `SEARCH_RELAY_URL`／`SEARCH_RELAY_KEY` 及 `x-relay-key` API，不把密碼放網址或程式碼。
- `Code.gs` 的查詢分支限定「查／搜尋」後接空白或冒號，呼叫本機 relay；成功回覆答案與來源，失敗時明確回報電腦連線問題，不把查詢寫成待辦。
- 其他訊息交回原待辦小秘書流程；示範版亦保留照片、Drive 與日曆相關函式。
- 轉接站使用本機 Ollama 模型與其網路搜尋工具，來源 URL 由實際搜尋結果產生。

## 安全

不要將 LINE 長效通行碼、Channel secret、Gemini key、`SEARCH_RELAY_KEY`、轉接網址或 Apps Script `/exec` 網址寫入 repo 或截圖。密碼與網址只放 Apps Script 指令碼屬性；轉接密碼檔留在使用者家目錄。

## 課堂示範

參考 [課堂示範流程](課堂示範流程.md)。
