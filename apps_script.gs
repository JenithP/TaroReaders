/**
 * 별빛타로 — Google Apps Script 웹앱
 *
 * ★ 설치 방법:
 * 1. 구글 시트(1Nqnn553Yva4IiJgNQfJppg6b_5cPyTywYRl5D2XV_7I) 열기
 * 2. 상단 메뉴 [확장 프로그램] → [Apps Script] 클릭
 * 3. 이 파일 내용을 전부 붙여넣기 (기존 코드 덮어쓰기)
 * 4. 상단 [배포] → [새 배포] 클릭
 * 5. 유형: 웹 앱
 *    - 설명: 별빛타로 폼 수신
 *    - 다음 사용자로 실행: 나(본인 계정)
 *    - 액세스 권한: 모든 사용자
 * 6. [배포] 클릭 → 권한 허용
 * 7. 표시된 "웹 앱 URL" 복사
 * 8. index.html 상단의 APPS_SCRIPT_URL_HERE 를 복사한 URL로 교체
 */

const SHEET_ID = '1Nqnn553Yva4IiJgNQfJppg6b_5cPyTywYRl5D2XV_7I';
const SHEET_NAME = '시트1'; // 시트 탭 이름이 다르면 여기 수정

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    writeToSheet(data);
    return jsonResponse({result: 'success'});
  } catch (err) {
    return jsonResponse({result: 'error', message: err.toString()});
  }
}

// GET 요청도 허용 (일부 브라우저 환경 대응)
function doGet(e) {
  try {
    writeToSheet(e.parameter);
    return jsonResponse({result: 'success'});
  } catch (err) {
    return jsonResponse({result: 'error', message: err.toString()});
  }
}

function writeToSheet(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();

  // 헤더가 없으면 첫 행에 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['접수시간', '이름', '전화번호', '출생연도', '거주지역', '카드결과', '과거 리딩', '현재 리딩', '미래 리딩', '리딩일시']);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1a0933').setFontColor('#c9a84c');
  }

  sheet.appendRow([
    new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}),
    data.name        || '',
    data.phone       || '',
    data.birth       || '',
    data.region      || '',
    data.tarotResult || '',
    data.gptPast     || '',
    data.gptPresent  || '',
    data.gptFuture   || '',
    data.readingDate || '',
  ]);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
