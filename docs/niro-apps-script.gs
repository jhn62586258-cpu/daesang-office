/**
 * 🚗 니로 운행일지 → 구글 스프레드시트 자동 기록 (Google Apps Script 샘플)
 *
 * 사용 방법
 *  1. 기록할 구글 스프레드시트를 열고 [확장 프로그램] → [Apps Script]
 *  2. 이 파일 내용을 전부 붙여넣고 저장
 *  3. (선택) 서명 이미지를 드라이브에 저장하려면 SIGN_FOLDER_ID 에 드라이브 폴더 ID 입력
 *  4. [배포] → [새 배포] → 유형 '웹 앱' / 다음 사용자로 실행: '나' / 액세스 권한: '모든 사용자' → 배포
 *  5. 발급된 웹 앱 URL 을 src/config.js 의 NIRO_SHEET_WEBAPP_URL 에 붙여넣기
 *
 *  ※ 코드를 고친 뒤에는 [배포 관리] → 수정 → '새 버전'으로 다시 배포해야 반영됩니다.
 */
const SHEET_NAME = '니로 운행일지'
const SIGN_FOLDER_ID = '' // 예: '1AbCdEf...' (비워 두면 서명은 '서명 완료'로만 표시)

const HEADERS = ['기록ID', '운행일자', '운행자', '출발시간', '도착시간', '목적지', '운행목적',
  '출발 주행거리(km)', '도착 주행거리(km)', '이동거리(km)', '연료 잔여량', '서명', '저장시각']

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const d = JSON.parse(e.postData.contents)
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS)
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e7f5ff')
      sheet.setFrozenRows(1)
    }
    // 같은 기록ID가 이미 있으면 중복 저장하지 않음
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : []
    if (ids.indexOf(d.id) !== -1) return json({ ok: true, duplicate: true })

    let sign = d.sign ? '서명 완료' : ''
    if (d.sign && SIGN_FOLDER_ID) {
      const bytes = Utilities.base64Decode(String(d.sign).split(',')[1])
      const blob = Utilities.newBlob(bytes, 'image/png', `서명_${d.date}_${d.driver}_${d.id}.png`)
      const file = DriveApp.getFolderById(SIGN_FOLDER_ID).createFile(blob)
      sign = file.getUrl()
    }
    sheet.appendRow([
      d.id, d.date, d.driver, d.depTime, d.arrTime, d.dest, d.purpose,
      d.odoStart, d.odoEnd, d.distance, d.fuel, sign,
      Utilities.formatDate(new Date(d.at || Date.now()), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    ])
    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
