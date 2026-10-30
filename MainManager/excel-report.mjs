import ExcelJS from 'exceljs';

// Excel ไม่มี timezone: เก็บ serial date ที่เลื่อนไปเวลาไทย พร้อมระบุ UTC+7 ที่หัวตาราง
const thaiDate = value => value && !Number.isNaN(Date.parse(value))
  ? (Date.parse(value) + 7 * 60 * 60 * 1000) / 86400000 + 25569 : null;
const dateFormat = 'yyyy-mm-dd hh:mm:ss';

function table(sheet, rowNumber, headers, rows) {
  const header = sheet.getRow(rowNumber);
  header.values = headers;
  header.height = 28;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '243746' } };
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  });
  rows.forEach(values => sheet.addRow(values));
  sheet.autoFilter = { from: { row: rowNumber, column: 1 }, to: { row: rowNumber + rows.length, column: headers.length } };
  sheet.views = [{ state: 'frozen', ySplit: rowNumber, showGridLines: false }];
}

/** สร้าง XLSX จากผลจริง ไม่อ่าน Config หรือส่งข้อความ Error เป็นสูตร Excel */
export async function createExcelReport(result, timeline) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Automation Framework';
  const overview = workbook.addWorksheet('สรุปผล');
  const cases = workbook.addWorksheet('รายเคส');
  const history = workbook.addWorksheet('ลำดับการทำงาน');
  overview.columns = [{ width: 30 }, { width: 100 }];
  overview.addRows([
    [], ['ผลทดสอบ Automation'], [],
    ['Run ID', result.runId], ['ชื่อชุดทดสอบ', result.runName ?? 'ไม่ระบุ'],
    ['ผลรวม', result.status], ['Platform', result.platform ?? 'ไม่ระบุ'],
    ['เริ่ม (เวลาไทย UTC+7)', thaiDate(result.startedAt)],
    ['จบ (เวลาไทย UTC+7)', thaiDate(result.finishedAt)],
    ['ระยะเวลา (ms)', result.durationMs], [],
    ['หลักฐาน', 'ยังไม่เก็บ Screenshot / Video / Step History'],
    [], ['ข้อผิดพลาดระดับชุดทดสอบ', 'รายละเอียด'],
    ...(result.errors.length ? result.errors.map(error => [error.phase ?? 'ไม่ระบุ', error.message ?? '']) : [['ไม่มี', '']]),
    [], ['รอบที่ยังไม่มีผลสุดท้าย', (result.incompleteRuns ?? []).join('\n') || 'ไม่มี'],
  ]);
  overview.getCell('B8').numFmt = dateFormat;
  overview.getCell('B9').numFmt = dateFormat;
  overview.views = [{ showGridLines: false }];
  cases.columns = [10, 42, 14, 24, 24, 18, 28, 85].map(width => ({ width }));
  cases.addRow([]); cases.addRow(['ผลรายเคส']); cases.addRow([]);
  const executions = [...result.cases, ...result.skippedCases.map(item => ({ ...item, status: 'SKIPPED' }))]
    .sort((a, b) => a.executionIndex - b.executionIndex);
  table(cases, 4, ['ลำดับ', 'Case ID', 'ผล', 'เริ่ม (ไทย UTC+7)', 'จบ (ไทย UTC+7)', 'ระยะเวลา (ms)', 'Error Code', 'รายละเอียด'],
    executions.map(item => [item.executionIndex, item.caseId, item.status, thaiDate(item.startedAt), thaiDate(item.finishedAt), item.durationMs ?? null, item.error?.code ?? '', item.error?.message ?? '']));
  cases.getColumn(4).numFmt = dateFormat; cases.getColumn(5).numFmt = dateFormat;
  history.columns = [26, 85, 16].map(width => ({ width }));
  history.addRow([]); history.addRow(['ลำดับการทำงาน']); history.addRow([]);
  table(history, 4, ['เวลาไทย (UTC+7)', 'เหตุการณ์', 'ผล'], timeline.map(([at, label, status]) => [thaiDate(at), label, status]));
  history.getColumn(1).numFmt = dateFormat;
  for (const sheet of workbook.worksheets) {
    sheet.eachRow(row => {
      row.eachCell(cell => {
        if (!cell.font) cell.font = { name: 'Arial', size: 11 };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    });
    sheet.getCell('A2').font = { name: 'Arial', size: 16, bold: true };
  }
  return workbook.xlsx.writeBuffer();
}
