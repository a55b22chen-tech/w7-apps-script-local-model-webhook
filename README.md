# W7：Apps Script Webhook + 本地模型轉接站

這個範例讓 LINE bot webhook 留在 Google Apps Script：收到「查 …」時，Apps Script 把問題送到電腦上的轉接站；轉接站先用本地模型整理搜尋詞，再向維基百科搜尋，最後讓 Ollama 根據結果回答並附來源。其他文字會新增到 Google 試算表的「待辦」工作表。

## 架構

`LINE → Apps Script Web App → HTTPS tunnel → 本機 relay.py → Wikipedia API + Ollama`

本機 relay 預設只監聽 `127.0.0.1`。Apps Script 不能直接連你的私人電腦，因此需用 HTTPS 隧道提供臨時轉接位址；不要把隧道網址寫進 repo 或截圖。

## 需要準備

- LINE Messaging API channel 與 bot
- Google Apps Script 專案及一份 Google 試算表
- Python 3.10 以上
- Ollama 與可用的本地模型（此電腦已安裝 `gemma4:e2b`）
- 網路連線（用來搜尋維基百科頁面；回答模型仍在本機執行）
- HTTPS 隧道工具；需確認隧道對外存取方式符合你的安全需求

## 安裝與執行轉接站

1. 安裝並啟動 Ollama，下載模型：`ollama pull gemma4:e2b`。若模型已在 `ollama list` 出現，可跳過。
2. 在此資料夾建立虛擬環境並安裝依賴：

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. 在目前 PowerShell 視窗設定轉接密鑰並啟動：

   ```powershell
   $env:RELAY_SECRET = '自行產生的長隨機字串'
   $env:OLLAMA_MODEL = 'gemma4:e2b'
   python relay.py
   ```

4. 開啟 HTTPS tunnel，將外部 HTTPS 請求轉到 `127.0.0.1:8787`。隧道網址只留在 Apps Script 的 Script properties。隧道供外部呼叫時，務必使用長隨機 `RELAY_SECRET`，並避免公開轉接網址。

relay 收到問題時會在執行視窗印出 `收到查詢：…`，方便課堂展示訊息轉接確實到達本機。

## 安裝 Apps Script webhook

1. 建立 Google 試算表，複製試算表 ID（網址 `/d/` 與 `/edit` 之間那段）。
2. 在 Apps Script 專案貼入 `Code.gs`，部署為 Web app，執行身分選自己，存取權按 LINE webhook 所需設定。
3. 在 **Apps Script → 專案設定 → 指令碼屬性** 設定以下四項。值不可貼進程式、README、GitHub 或截圖：

   - `CHANNEL_ACCESS_TOKEN`：LINE 長效通行碼
   - `SPREADSHEET_ID`：試算表 ID
   - `RELAY_URL`：HTTPS tunnel 的根網址
   - `RELAY_SECRET`：與本機 `RELAY_SECRET` 完全相同

4. 將部署後的 Web app 網址填入 LINE Developers 的 Webhook URL 並啟用 webhook。`/exec` 網址也是部署資訊，勿放 repo 或截圖。
5. 在 LINE 傳「查 台灣最高的山是哪一座？」；在本機 relay 視窗查看請求紀錄。傳一般訊息確認它被記在「待辦」工作表。

## 我改了什麼

- 加入「查」前綴分流，並由 Apps Script 透過 HTTPS 呼叫本機 relay。
- 其他訊息寫入試算表待辦清單。
- 本機 relay 先以本地模型整理搜尋詞，再用維基百科搜尋結果作回答上下文，回傳來源標題與網址。
- LINE token、relay secret、試算表 ID 與 tunnel URL 均由執行環境／Script properties 提供，不硬編碼。

## 已知限制

- 來源由維基百科搜尋 API 提供；模型可能錯誤解讀頁面，請點開來源核對。引用編號只是輔助，不代表內容已驗證。
- 這是教學範例，未加入 webhook 簽章驗證、重試佇列、使用者限流或 LINE webhook event 去重。正式部署前需補足。
- relay 的 HTTP 錯誤不會暴露內部細節給 LINE 使用者，但會記錄在本機 server log。
- Apps Script、LINE、搜尋服務、隧道與 Ollama 均需各自可連線；任一未啟動都會造成「查」失敗。

## 安全檢查

推上公開 repo 前，確認沒有長效通行碼、Channel secret、`/exec` 網址、tunnel URL、`.env` 或本機日誌。密鑰只放 Apps Script 指令碼屬性及本機環境變數。

## 課堂帶做

逐步示範與提問見 [課堂示範流程.md](課堂示範流程.md)。
