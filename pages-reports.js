/**
 * pages-reports.js — รายงาน · Print Preview (A4 แนวตั้ง/แนวนอน หัว–ท้ายกระดาษ เลขหน้า ช่องลงนาม) · ส่งออก CSV
 * หลัก Print ≠ Export: พิมพ์ = เอกสาร · ส่งออก = ข้อมูลไปวิเคราะห์ต่อ · ทั้งสองแบบตรวจสิทธิ์และบันทึก Audit Log ที่หลังบ้าน
 */
var REPORT_FILTERS = {
  PERSONNEL: ['div', 'ward', 'position', 'status', 'level', 'step', 'alert'], STEP: ['div', 'ward', 'step', 'alert'],
  TRAINING: ['from', 'to', 'div', 'ward', 'ttype'], COMPETENCY: ['round', 'div', 'ward', 'position'],
  TRANSFER: ['from', 'to'], STATUS: ['from', 'to'], ATTENDANCE: ['fy', 'ym', 'div', 'ward']
};
route('reports', function (v, r) {
  if (!can('staff')) { go('home'); return; }
  var type = r.q.type || 'PERSONNEL', R0 = S.boot.lists.reports, f = Object.assign({}, r.q); delete f.type;
  if (type === 'TRAINING') { f.from = f.from || fyStart(S.boot.fy); f.to = f.to || isoToday(); }
  if (type === 'ATTENDANCE') f.fy = f.fy || S.boot.fy;
  if ((type === 'PERSONNEL') && !f.status) f.status = 'ACTIVE';
  var fl = REPORT_FILTERS[type], fld = function (k) {
    if (k === 'div' || k === 'ward') return '';
    if (k === 'position') return '<label class="fld sm"><span>ตำแหน่ง</span><select name="position">' + posOpts(f.position || '', 'ทั้งหมด') + '</select></label>';
    if (k === 'status') return '<label class="fld sm"><span>สถานะ</span><select name="status">' + opts([{ v: 'ACTIVE', l: 'ปฏิบัติงาน' }, { v: 'LEAVE', l: 'ลาศึกษา/ลายาว' }, { v: 'INACTIVE', l: 'พ้นสภาพ' }, { v: 'ALL', l: 'ทุกสถานะ' }], f.status) + '</select></label>';
    if (k === 'level') return '<label class="fld sm"><span>ระดับประสบการณ์</span><select name="level">' + opts(R.LEVELS.map(function (l) { return { v: l.level, l: l.level + ' · ' + l.name }; }), f.level || '', 'ทั้งหมด') + '</select></label>';
    if (k === 'step') return '<label class="fld xs"><span>ขั้น</span><select name="step">' + opts(R.STEPS, f.step || '', 'ทั้งหมด') + '</select></label>';
    if (k === 'alert') return '<label class="tog"><input type="checkbox" name="alert"' + (f.alert ? ' checked' : '') + '><span>เฉพาะ ★</span></label>';
    if (k === 'from' || k === 'to') return '<label class="fld sm"><span>' + (k === 'from' ? 'ตั้งแต่' : 'ถึง') + '</span><input type="date" name="' + k + '" value="' + attr(f[k] || '') + '"></label>';
    if (k === 'ttype') return '<label class="fld sm"><span>รูปแบบ</span><select name="ttype">' + opts([{ v: 'ONSITE', l: 'Onsite' }, { v: 'ZOOM', l: 'On Zoom' }], f.ttype || '', 'ทั้งหมด') + '</select></label>';
    if (k === 'fy') return '<label class="fld sm"><span>ปีงบประมาณ</span><select name="fy">' + fyOpts(+f.fy) + '</select></label>';
    if (k === 'ym') return '<label class="fld sm"><span>เดือน</span><select name="ym">' + opts(R.fyMonths(+f.fy).map(function (ym) { return { v: ym, l: R.ymThLong(ym) }; }), f.ym || '', 'ทั้งปี') + '</select></label>';
    if (k === 'round') return '<label class="fld sm"><span>รอบประเมิน (พ.ศ.)</span><input name="round" inputmode="numeric" maxlength="4" value="' + attr(f.round || '') + '" placeholder="ล่าสุด"></label>';
    return '';
  };
  v.innerHTML = pageHead('รายงานและพิมพ์', 'เลือกรายงาน กำหนดตัวกรอง แล้วดูตัวอย่างก่อนพิมพ์ หรือส่งออกเป็นไฟล์ CSV (เปิดด้วย Excel ได้)') +
    '<div class="rep-types">' + Object.keys(R0).map(function (k) { return '<a class="rep-t' + (k === type ? ' on' : '') + '" href="#/reports?type=' + k + '">' + esc(R0[k]) + '</a>'; }).join('') + '</div>' +
    '<form class="filters" id="rf">' + (fl.indexOf('div') >= 0 ? scopeFilters(f) : '') + fl.map(fld).join('') + '</form>' +
    '<div class="row-a"><button class="btn primary" id="rpPrev">⎙ ดูตัวอย่างก่อนพิมพ์</button><button class="btn" id="rpCsv">↓ ส่งออก CSV</button><span class="sp"></span><span class="muted small" id="rpInfo"></span></div><div id="rpBody" class="card flush"></div>';
  var getF = function () { var x = formData($('#rf')); if (x.alert === false) delete x.alert; if (x.ttype) { x.type = x.ttype; } delete x.ttype; return x; };
  $$('#rf select, #rf input').forEach(function (el) { el.onchange = function () { var x = formData($('#rf')); if (el.name === 'div') x.ward = ''; if (x.alert === false) delete x.alert; go('reports', Object.assign({ type: type }, x)); }; });
  var load = function (purpose) { return api('getReport', { type: type, filters: getF(), purpose: purpose || 'view' }); };
  load().then(function (d) { $('#rpInfo').textContent = d.count + ' แถว · ' + d.subtitle; $('#rpBody').innerHTML = reportTable(d, 200) + (d.count > 200 ? '<p class="muted small pad">แสดง 200 แถวแรกบนจอ — ตัวอย่างก่อนพิมพ์และไฟล์ส่งออกมีครบทุกแถว</p>' : ''); })
    .catch(function (e) { fail(e); $('#rpBody').innerHTML = empty(e.message); });
  $('#rpPrev').onclick = function () { load('print').then(function (d) { printPreview({ title: d.title, subtitle: d.subtitle, orientation: d.orientation, html: (d.summary ? '<p class="doc-sum">' + esc(d.summary) + '</p>' : '') + reportTable(d), count: d.count }); }).catch(fail); };
  $('#rpCsv').onclick = function () { load('export').then(function (d) { downloadCsv(d); toast('ส่งออก ' + d.count + ' แถวแล้ว'); }).catch(fail); };
});
function reportTable(d, limit) {
  var rows = limit ? d.rows.slice(0, limit) : d.rows;
  if (!rows.length) return empty('ไม่มีข้อมูลตามเงื่อนไข');
  return '<div class="tbl-wrap"><table class="tbl doc"><thead><tr><th class="r">ลำดับ</th>' + d.columns.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r, i) { return '<tr><td class="r">' + (i + 1) + '</td>' + d.columns.map(function (c) { var v = r[c.key]; return '<td' + (c.key === 'star' ? ' class="star"' : '') + '>' + esc(v == null ? '' : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
}
function downloadCsv(d) {
  var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var lines = [[d.title].concat([]).map(q).join(','), q(d.subtitle), q('ส่งออกเมื่อ ' + new Date().toLocaleString('th-TH') + ' โดย ' + S.me.empCode + ' ' + S.me.fullName), '',
    ['ลำดับ'].concat(d.columns.map(function (c) { return c.label; })).map(q).join(',')];
  d.rows.forEach(function (r, i) { lines.push([i + 1].concat(d.columns.map(function (c) { var v = r[c.key]; return c.key === 'empCode' && v ? '="' + v + '"' : v; })).map(function (x) { return /^="/.test(String(x)) ? x : q(x); }).join(',')); });
  var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'HRMi-NSO_' + d.type + '_' + isoToday() + '.csv'; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ================================================================ Print Preview */
function docHeader(title, subtitle) {
  var s = S.boot.settings;
  return '<header class="doc-h">' + (s.LOGO_DATA ? '<img class="doc-logo" src="' + attr(s.LOGO_DATA) + '" alt="">' : '<span class="nso-mark doc-mark">NSO</span>') +
    '<div><div class="doc-org">' + esc(s.ORG_LINE1) + '</div><div class="doc-org2">' + esc(s.ORG_LINE2) + '</div><div class="doc-sys">ระบบ HRMi for NSO</div></div>' +
    '<div class="doc-meta">พิมพ์เมื่อ ' + R.thaiDate(isoToday()) + ' ' + new Date().toTimeString().slice(0, 5) + ' น.<br>ผู้พิมพ์ ' + esc(S.me.fullName) + '</div></header>' +
    '<h1 class="doc-t">' + esc(title) + '</h1>' + (subtitle ? '<p class="doc-st">' + esc(subtitle) + '</p>' : '');
}
function docSign() {
  var s = S.boot.settings; if (!s.PRINT_SIGN_ON) return '';
  return '<div class="doc-sign">' + [s.PRINT_SIGN_1, s.PRINT_SIGN_2, s.PRINT_SIGN_3].filter(Boolean).map(function (l) { return '<div><span class="sig-line"></span><span>(......................................................)</span><span>' + esc(l) + '</span><span>วันที่ ........../........../..........</span></div>'; }).join('') + '</div>';
}
/** printPreview({title, subtitle, orientation:'portrait'|'landscape', html}) */
function printPreview(o) {
  var land = o.orientation === 'landscape';
  var doc = '<div class="doc ' + (land ? 'land' : 'port') + '">' + docHeader(o.title, o.subtitle) + o.html + docSign() + '<footer class="doc-f">' + esc(S.boot.settings.ORG_LINE1) + ' · HRMi for NSO · ' + esc(o.title) + '</footer></div>';
  var wrap = document.createElement('div'); wrap.className = 'pv-wrap';
  wrap.innerHTML = '<div class="pv-bar"><b>ตัวอย่างก่อนพิมพ์</b><span class="muted">A4 ' + (land ? 'แนวนอน' : 'แนวตั้ง') + (o.count != null ? ' · ' + o.count + ' แถว' : '') + '</span><span class="sp"></span>' +
    '<label class="tog"><input type="checkbox" id="pvSign"' + (S.boot.settings.PRINT_SIGN_ON ? ' checked' : '') + '><span>ช่องลงนาม</span></label>' +
    '<button class="btn primary" id="pvPrint">⎙ พิมพ์</button><button class="btn ghost" id="pvClose">ปิด</button></div><div class="pv-paper">' + doc + '</div>';
  document.body.appendChild(wrap); document.body.classList.add('pv-open');
  var st = document.getElementById('pageStyle') || document.createElement('style'); st.id = 'pageStyle';
  st.textContent = '@page{size:A4 ' + (land ? 'landscape' : 'portrait') + ';margin:12mm 10mm 14mm;@bottom-right{content:"หน้า " counter(page) " / " counter(pages);font:9pt Sarabun,sans-serif;color:#555}@bottom-left{content:"HRMi for NSO · ' + o.title.replace(/"/g, '') + '";font:9pt Sarabun,sans-serif;color:#555}}';
  document.head.appendChild(st);
  $('#pvSign', wrap).onchange = function () { $('.doc-sign', wrap) && ($('.doc-sign', wrap).hidden = !this.checked); if (this.checked && !$('.doc-sign', wrap)) $('.doc-f', wrap).insertAdjacentHTML('beforebegin', docSign() || '<div class="doc-sign"></div>'); };
  var close = function () { wrap.remove(); document.body.classList.remove('pv-open'); };
  $('#pvClose', wrap).onclick = close;
  $('#pvPrint', wrap).onclick = function () { window.print(); };
}

/** พิมพ์ข้อมูลบุคลากรรายบุคคล (A4 แนวตั้ง) ตามสิทธิ์ที่ได้รับ */
function printProfile(d) {
  var p = d.p, raw = d.raw, row = function (a, b) { return '<tr><th>' + esc(a) + '</th><td>' + (b === '' || b == null ? '-' : b) + '</td></tr>'; };
  var html = '<h2 class="doc-sec">ข้อมูลบุคลากร</h2><table class="kvt">' + row('รหัสพนักงาน', p.empCode) + row('ชื่อ-นามสกุล', esc(p.fullName)) + row('ชื่อ-นามสกุล (อังกฤษ)', esc([raw.firstNameEn, raw.lastNameEn].filter(Boolean).join(' '))) +
    row('ตำแหน่ง', esc(p.positionName)) + row('หอ/หน่วยงาน', esc(p.wardCode + ' ' + p.wardName)) + row('ส่วนงาน/สายงาน', esc(p.divName)) + row('สถานะ', esc(p.statusName)) +
    row('วันเริ่มงาน รพ. / อายุงาน', (raw.startDate ? R.thaiDateLong(raw.startDate) : '-') + ' · ' + esc(p.serviceText)) + row('ระดับประสบการณ์', p.level ? 'Level ' + p.level + ' – ' + esc(p.levelName) : '-') +
    (p.stepEligible ? row('ขั้นการทำงานในปัจจุบัน', p.stepCode ? p.stepCode + ' · ปีที่ได้ ' + p.stepYear + ' · ' + p.stepYears + ' ปี' + (p.stepAlert ? ' ★' : '') : 'ยังไม่ระบุ') : '') +
    row('เลขที่ใบประกอบวิชาชีพ', esc(raw.licenseNo) + (raw.licenseExp ? ' (หมดอายุ ' + R.thaiDate(raw.licenseExp) + ')' : '')) + row('เบอร์โทร / อีเมล', esc([raw.phone, raw.email].filter(Boolean).join(' · '))) + '</table>' +
    '<h2 class="doc-sec">การศึกษา</h2>' + (d.education.length ? '<table class="tbl doc"><thead><tr><th>วุฒิ</th><th>สาขา</th><th>สถาบัน</th><th>ปีที่จบ</th></tr></thead><tbody>' + d.education.map(function (e) { return '<tr><td>' + esc(e.degree) + '</td><td>' + esc(e.major) + '</td><td>' + esc(e.institute) + '</td><td>' + esc(e.gradYear) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>-</p>') +
    '<h2 class="doc-sec">ประวัติการอบรม</h2>' + (d.training.length ? '<table class="tbl doc"><thead><tr><th>วันที่</th><th>หลักสูตร</th><th>รูปแบบ</th><th>ผู้จัด</th><th>ชม.</th></tr></thead><tbody>' + d.training.map(function (x) { return '<tr><td>' + R.thaiDate(x.date) + '</td><td>' + esc(x.name) + '</td><td>' + esc(S.boot.lists.trainTypes[x.type] || x.type) + '</td><td>' + esc(x.organizer) + '</td><td>' + esc(x.hours) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>-</p>') +
    '<h2 class="doc-sec">Competency</h2>' + (d.competency.length ? '<table class="tbl doc"><thead><tr><th>รอบ</th>' + S.boot.lists.compCats.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + d.competency.map(function (x) { return '<tr><td>' + x.round + '</td>' + S.boot.lists.compCats.map(function (c) { return '<td>' + (x.data[c] ? x.data[c].avg : '-') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' : '<p>-</p>') +
    '<h2 class="doc-sec">ขาด ลา มาสาย ปีงบประมาณ ' + d.attendance.fy + '</h2><p>' + (d.attendance.types.map(function (t) { var v = d.attendance.total[t.code]; return v ? esc(t.name) + ' ' + (t.unit === 'min' ? (d.attendance.count[t.code] || 0) + ' ครั้ง (' + v + ' นาที)' : v + ' วัน') : ''; }).filter(Boolean).join(' · ') || '-') + '</p>' +
    (d.transfers.length ? '<h2 class="doc-sec">ประวัติการย้ายหน่วยงาน</h2><table class="tbl doc"><tbody>' + d.transfers.map(function (x) { return '<tr><td>' + R.thaiDate(x.date) + '</td><td>' + esc(x.fromWard) + ' → ' + esc(x.toWard || x.toText) + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table>' : '');
  api('logOutput', { kind: 'PRINT', module: 'personnel', empCode: p.empCode, detail: 'พิมพ์ข้อมูลรายบุคคล' }).catch(function () { });
  printPreview({ title: 'ข้อมูลบุคลากรรายบุคคล', subtitle: p.empCode + ' ' + p.fullName, orientation: 'portrait', html: html });
}
