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
// 2026-09 개편: 리딩 코드·질문·주제·유입코드가 추가되어 열 구성이 바뀌었으므로
// 기존 '시트1'과 섞이지 않게 새 탭에 기록한다. (탭이 없으면 자동 생성)
const SHEET_NAME = '리딩v2';
const HEADERS = ['접수시간', '리딩코드', '이름', '전화번호', '생년월일', '거주지역', '질문',
                 '카드결과', '과거 리딩', '현재 리딩', '미래 리딩', '주제', '유입코드',
                 '마케팅동의', '리딩일시'];

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
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#1a0933').setFontColor('#c9a84c');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}),
    data.code        || '',
    data.name        || '',
    // 앞자리 0이 숫자로 잘리지 않게 문자열로 저장
    data.phone ? "'" + data.phone : '',
    data.birth       || '',
    data.region      || '',
    data.question    || '',
    data.tarotResult || '',
    data.gptPast     || '',
    data.gptPresent  || '',
    data.gptFuture   || '',
    data.themes      || '',
    data.src         || '',
    data.marketing   || '',
    data.readingDate || '',
  ]);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
