/**
 * LINE webhook: routes messages beginning with 查 to the local-model relay.
 * Other messages are appended to the Google Sheet todo list.
 * Configure CHANNEL_ACCESS_TOKEN, RELAY_URL, RELAY_SECRET and SPREADSHEET_ID
 * in Apps Script > Project Settings > Script properties.
 */
function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('CHANNEL_ACCESS_TOKEN');
  const relayUrl = props.getProperty('RELAY_URL');
  const relaySecret = props.getProperty('RELAY_SECRET');
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  if (!token || !spreadsheetId) return textOutput_('Missing script properties');

  const events = JSON.parse(e.postData.contents).events || [];
  events.forEach(event => {
    if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;
    const message = event.message.text.trim();
    if (message.startsWith('查')) {
      if (!relayUrl || !relaySecret) {
        reply_(token, event.replyToken, '轉接站尚未設定，請稍後再試。');
        return;
      }
      const question = message.replace(/^查\s*/, '').trim();
      if (!question) {
        reply_(token, event.replyToken, '請在「查」後面輸入問題，例如：查 台灣最高的山是哪一座？');
        return;
      }
      try {
        const response = UrlFetchApp.fetch(relayUrl.replace(/\/$/, '') + '/ask', {
          method: 'post', contentType: 'application/json',
          headers: { 'X-Relay-Secret': relaySecret },
          payload: JSON.stringify({ question: question }), muteHttpExceptions: true
        });
        if (response.getResponseCode() !== 200) throw new Error('Relay returned ' + response.getResponseCode());
        const result = JSON.parse(response.getContentText());
        const answer = String(result.answer || '').trim();
        const sources = Array.isArray(result.sources) ? result.sources : [];
        const sourceText = sources.length
          ? '\n\n來源：\n' + sources.map((s, i) => (i + 1) + '. ' + s.title + ' ' + s.url).join('\n')
          : '\n\n（轉接站未提供來源，請自行核對。）';
        reply_(token, event.replyToken, (answer || '本地模型沒有產生回答。') + sourceText);
      } catch (err) {
        console.error(err);
        reply_(token, event.replyToken, '目前無法連到本地模型，請稍後再試。');
      }
    } else {
      try {
        const sheet = getTodoSheet_(spreadsheetId);
        sheet.appendRow([new Date(), event.source && event.source.userId || '', message, '待辦']);
        reply_(token, event.replyToken, '已記下待辦：' + message);
      } catch (err) {
        console.error(err);
        reply_(token, event.replyToken, '記錄待辦失敗，請稍後再試。');
      }
    }
  });
  return textOutput_('OK');
}

function getTodoSheet_(spreadsheetId) {
  const book = SpreadsheetApp.openById(spreadsheetId);
  let sheet = book.getSheetByName('待辦');
  if (!sheet) {
    sheet = book.insertSheet('待辦');
    sheet.appendRow(['時間', '使用者 ID', '內容', '狀態']);
  }
  return sheet;
}

function reply_(channelToken, replyToken, message) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + channelToken },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: message.slice(0, 4900) }] }),
    muteHttpExceptions: true
  });
}

function textOutput_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
