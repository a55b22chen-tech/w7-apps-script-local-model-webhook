/**
 * W7 LINE webhook: "查 …" goes to the local-model relay; other text is saved as a todo.
 * Put credentials in Apps Script > Project Settings > Script properties.
 * Required: LINE_CHANNEL_ACCESS_TOKEN, SEARCH_RELAY_URL, SEARCH_RELAY_KEY.
 * Optional: SPREADSHEET_ID (if omitted, the script creates a todo spreadsheet on first use).
 */
const PROPS = PropertiesService.getScriptProperties();
const SEARCH_PREFIX = /^(?:查|搜尋)[\s:：]+([\s\S]+)$/;

function doGet() {
  return ContentService.createTextOutput("W7 LINE webhook is ready");
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    (body.events || []).forEach(handleEvent_);
  } catch (err) {
    console.error("Webhook payload error: " + err.message);
  }
  return ContentService.createTextOutput("OK");
}

function handleEvent_(event) {
  if (!event || event.type !== "message" || !event.replyToken || !event.message) return;
  if (event.message.type !== "text") {
    replyLine_(event.replyToken, "目前這個課堂版先處理文字訊息。");
    return;
  }

  const text = String(event.message.text || "").trim();
  const match = text.match(SEARCH_PREFIX);
  if (match) {
    const question = match[1].trim();
    replyLine_(event.replyToken, question ? askLocalSearch_(question) : "請在「查」後面加上問題，例如：查 台灣最高的山是哪一座？");
    return;
  }

  try {
    const sheet = getTodoSheet_();
    const source = event.source || {};
    sheet.appendRow([new Date(), source.userId || source.groupId || source.roomId || "", text, "待辦"]);
    replyLine_(event.replyToken, "✅ 已記下待辦：" + text);
  } catch (err) {
    console.error("Todo save failed: " + err.message);
    replyLine_(event.replyToken, "記錄待辦失敗，請稍後再試。");
  }
}

function askLocalSearch_(question) {
  const relayUrl = (PROPS.getProperty("SEARCH_RELAY_URL") || "").trim().replace(/\/+$/, "");
  const relayKey = (PROPS.getProperty("SEARCH_RELAY_KEY") || "").trim();
  if (!relayUrl || !relayKey) return "這支 bot 還沒設定本地轉接站（指令碼屬性需有 SEARCH_RELAY_URL 和 SEARCH_RELAY_KEY）。";

  let response;
  try {
    response = UrlFetchApp.fetch(relayUrl + "/ask", {
      method: "post",
      contentType: "application/json",
      headers: { "x-relay-key": relayKey },
      payload: JSON.stringify({ question: question }),
      muteHttpExceptions: true,
      timeoutSeconds: 50
    });
  } catch (err) {
    console.error("Relay unavailable: " + err.message);
    return "🔌 本地模型現在連不到，請確認電腦上的轉接站和通道有開著。";
  }

  let data = {};
  try { data = JSON.parse(response.getContentText()); } catch (err) { /* handled below */ }
  if (response.getResponseCode() !== 200 || !data.answer) {
    console.error("Relay returned HTTP " + response.getResponseCode());
    return "本地模型這次沒有完成回答，請稍後再試。";
  }

  let reply = String(data.answer).trim();
  const sources = Array.isArray(data.sources) ? data.sources.filter(s => s && s.url).slice(0, 3) : [];
  if (sources.length) {
    reply += "\n\n來源：\n" + sources.map(s => "• " + String(s.title || s.url) + "\n  " + String(s.url)).join("\n");
  } else {
    reply += "\n\n（這題沒有取得來源，請再查證。）";
  }
  return reply;
}

function getTodoSheet_() {
  let id = (PROPS.getProperty("SPREADSHEET_ID") || "").trim();
  let book;
  if (id) {
    book = SpreadsheetApp.openById(id);
  } else {
    book = SpreadsheetApp.create("W7 LINE 待辦");
    PROPS.setProperty("SPREADSHEET_ID", book.getId());
  }
  let sheet = book.getSheetByName("待辦");
  if (!sheet) sheet = book.insertSheet("待辦");
  if (sheet.getLastRow() === 0) sheet.appendRow(["時間", "使用者", "內容", "狀態"]);
  return sheet;
}

function replyLine_(replyToken, message) {
  const token = PROPS.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN script property");
    return;
  }
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: "text", text: String(message).slice(0, 4900) }] }),
    muteHttpExceptions: true
  });
}
