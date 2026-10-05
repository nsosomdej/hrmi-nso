/**
 * pages-people.js — บุคลากร: ค้นหา/ตัวกรอง/แบ่งหน้า · โปรไฟล์ (แท็บ) · เพิ่ม/แก้ไข · ขั้นการทำงาน · การศึกษา · ย้าย · สถานะ · ข้อมูลของฉัน
 */
var PEOPLE_F = ['q', 'div', 'ward', 'position', 'status', 'level', 'step', 'alert', 'noStep', 'mismatch', 'license', 'sort', 'page', 'size'];

route('people', function (v, r) {
  if (!can('staff')) { go('me'); return; }
  var f = {}; PEOPLE_F.forEach(function (k) { if (r.q[k] != null) f[k] = r.q[k]; });
  if (f.status == null) f.status = 'ACTIVE';
  var flags = [['alert', '★ เกินเกณฑ์'], ['noStep', 'ยังไม่ระบุขั้น'], ['mismatch', 'ข้อสังเกต Level–ขั้น'], ['license', 'ใบประกอบฯ ใกล้หมดอายุ']];
  v.innerHTML = pageHead('บุคลากร', 'ค้นหาจากรหัส ชื่อ หอ หรือตำแหน่ง · ข้อมูลตามขอบเขตสิทธิ์ของคุณ',
    (can('edit') ? '<button class="btn primary" id="addP">+ เพิ่มบุคลากร</button>' : '') + (can('edit') && can('smartapi') ? '<button class="btn" id="addApi">เพิ่มจากรหัส (SmartAPI)</button>' : '') +
    '<a class="btn" href="#/reports' + qs(Object.assign({ type: 'PERSONNEL' }, f, { page: '', size: '', sort: '' })) + '">⎙ พิมพ์ / ส่งออก</a>') +
    '<form class="filters" id="pf"><label class="fld grow"><span>ค้นหา</span><input type="search" name="q" value="' + attr(f.q || '') + '" placeholder="รหัส 7 หลัก หรือชื่อ-สกุล"></label>' + scopeFilters(f) +
    '<label class="fld sm"><span>ตำแหน่ง</span><select name="position">' + posOpts(f.position || '', 'ทั้งหมด') + '</select></label>' +
    '<label class="fld sm"><span>สถานะ</span><select name="status">' + opts([{ v: 'ACTIVE', l: 'ปฏิบัติงาน' }, { v: 'LEAVE', l: 'ลาศึกษา/ลายาว' }, { v: 'INACTIVE', l: 'พ้นสภาพ' }, { v: 'ALL', l: 'ทุกสถานะ' }], f.status) + '</select></label>' +
    '<label class="fld sm"><span>ระดับประสบการณ์</span><select name="level">' + opts(R.LEVELS.map(function (l) { return { v: l.level, l: l.level + ' · ' + l.name }; }), f.level || '', 'ทั้งหมด') + '</select></label>' +
    '<label class="fld xs"><span>ขั้น</span><select name="step">' + opts(R.STEPS, f.step || '', 'ทั้งหมด') + '</select></label>' +
    '<div class="flag-row">' + flags.map(function (x) { return '<label class="tog"><input type="checkbox" name="' + x[0] + '"' + (f[x[0]] ? ' checked' : '') + '><span>' + x[1] + '</span></label>'; }).join('') + '</div></form>' +
    '<div class="card flush" id="plist">' + skeleton(6) + '</div>';
  var apply = function (extra) { var x = formData($('#pf')); flags.forEach(function (k) { x[k[0]] = x[k[0]] ? 1 : ''; }); go('people', Object.assign({ sort: f.sort, size: f.size }, x, extra || {})); };
  $$('#pf select, #pf input[type=checkbox]').forEach(function (el) { el.onchange = function () { if (el.name === 'div') $('#pf [name=ward]').value = ''; apply(); }; });
  $('#pf [name=q]').addEventListener('input', debounce(function () { apply(); }, 450));
  $('#pf').onsubmit = function (e) { e.preventDefault(); apply(); };
  if ($('#addP')) $('#addP').onclick = function () { personForm(null); };
  if ($('#addApi')) $('#addApi').onclick = addByCodesDialog;
  var payload = Object.assign({}, f, { alert: !!f.alert, noStep: !!f.noStep, mismatch: !!f.mismatch, license: !!f.license, page: +f.page || 1, size: +f.size || 20 });
  var draw = function (d) {
    var sortH = function (k, l) { var cur = f.sort || 'empCode', on = cur.replace('-', '') === k; return '<th><button class="th-sort' + (on ? ' on' : '') + '" data-sort="' + (on && cur.charAt(0) !== '-' ? '-' + k : k) + '">' + l + (on ? (cur.charAt(0) === '-' ? ' ▾' : ' ▴') : '') + '</button></th>'; };
    $('#plist').innerHTML = !d.rows.length ? empty('ไม่พบบุคลากรตามเงื่อนไข', 'ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา') :
      '<div class="tbl-wrap"><table class="tbl rows"><thead><tr>' + sortH('empCode', 'รหัส') + sortH('name', 'ชื่อ-สกุล') + sortH('wardCode', 'หอ/หน่วย') + sortH('service', 'อายุงาน') + '<th>ระดับประสบการณ์</th>' + sortH('stepYears', 'ขั้นการทำงาน') + '<th>สถานะ</th></tr></thead><tbody>' +
      d.rows.map(function (p) {
        return '<tr data-href="#/person/' + p.empCode + '" tabindex="0"><td data-l="รหัส" class="mono">' + p.empCode + '</td><td data-l="ชื่อ-สกุล"><b>' + esc(p.fullName) + '</b><div class="muted small">' + esc(p.positionName) + '</div>' +
          (p.mismatch ? '<div class="note-i small" title="' + attr(p.mismatch) + '">ⓘ ข้อสังเกต Level–ขั้น</div>' : '') + (p.apiFlag ? '<div class="note-w small">⚠ HR: ' + (p.apiFlag === 'NOT_FOUND' ? 'ไม่พบในระบบ HR' : 'ครบวันพ้นสภาพ') + '</div>' : '') + '</td>' +
          '<td data-l="หอ/หน่วย">' + esc(p.wardCode) + '<div class="muted small">' + esc(p.wardName) + '</div></td><td data-l="อายุงาน">' + esc(p.serviceText) + '</td>' +
          '<td data-l="ระดับ">' + (p.level ? 'L' + p.level + ' ' + esc(p.levelName) : '<span class="muted">-</span>') + '</td><td data-l="ขั้น">' + stepCell(p) + '</td><td data-l="สถานะ">' + statusChip(p.status) + (p.licenseWarn ? ' <span class="chip warn" title="ใบประกอบวิชาชีพ">ใบประกอบฯ ' + (p.licenseDays < 0 ? 'หมดอายุ' : p.licenseDays + ' วัน') + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    $('#plist').insertAdjacentHTML('beforeend', '<div class="pager-row">' + pager(d) + '<label class="fld xs inline"><span>ต่อหน้า</span><select id="psz">' + opts([20, 50, 100], d.size) + '</select></label></div>');
    bindHref($('#plist')); bindPager($('#plist'), function (p) { go('people', Object.assign({}, f, { page: p })); });
    $$('[data-sort]', $('#plist')).forEach(function (b) { b.onclick = function () { go('people', Object.assign({}, f, { sort: b.getAttribute('data-sort'), page: 1 })); }; });
    $('#psz').onchange = function () { go('people', Object.assign({}, f, { size: this.value, page: 1 })); };
  };
  api('listPersonnel', payload, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); $('#plist').innerHTML = empty('โหลดรายชื่อไม่สำเร็จ', esc(e.message)); });
});

/* ================================================================ โปรไฟล์ */
route('person', function (v, r) { profilePage(v, r.arg, r.q.tab); });
route('me', function (v, r) { if (!S.me.hasProfile) { v.innerHTML = empty('ไม่มีทะเบียนบุคลากรของบัญชีนี้'); return; } profilePage(v, S.me.empCode, r.q.tab, true); });

function profilePage(v, code, tab, isMe) {
  var draw = function (d) { drawProfile(v, d, tab || 'info', isMe); };
  api('getPerson', { empCode: code }, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); v.innerHTML = empty(e.code === 'FORBIDDEN' ? 'คุณไม่มีสิทธิ์ดูข้อมูลบุคลากรรายนี้' : 'โหลดข้อมูลไม่สำเร็จ', esc(e.message)); });
}
function kv(label, val, cls) { return '<div class="kv' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span><b>' + (val === '' || val == null ? '<span class="muted">-</span>' : val) + '</b></div>'; }
function drawProfile(v, d, tab, isMe) {
  var p = d.p, raw = d.raw, self = d.can.self;
  var tabs = [['info', 'ข้อมูลบุคคล'], ['work', 'การปฏิบัติงาน'], ['edu', 'การศึกษา (' + d.education.length + ')'], ['training', 'การอบรม (' + d.training.length + ')'],
    ['comp', 'Competency'], ['att', 'ขาด ลา สาย'], ['hist', 'ประวัติ']];
  if (d.can.health) tabs.push(['health', 'ข้อมูลสุขภาพ']);
  var acts = '';
  if (d.can.edit) acts += '<button class="btn primary" data-a="edit">แก้ไขข้อมูล</button>';
  if (d.can.decide) acts += '<button class="btn" data-a="transfer">ย้ายหน่วยงาน</button><button class="btn" data-a="status">เปลี่ยนสถานะ</button>';
  if (self) acts += '<button class="btn" data-a="self">แก้เบอร์โทร/อีเมล</button><button class="btn" data-a="req">ขอแก้ไขข้อมูล</button>';
  acts += '<button class="btn ghost" data-a="print">⎙ พิมพ์</button>';
  v.innerHTML = (isMe ? '' : '<a class="back" href="#/people">‹ กลับไปรายชื่อบุคลากร</a>') +
    '<section class="profile-h card"><div class="pf-id"><span class="avatar lg">' + esc((p.firstName || '?').charAt(0)) + '</span><div><h1>' + esc(p.fullName) + ' ' + starHtml(p) + '</h1>' +
    '<p class="muted">รหัส <b class="mono">' + p.empCode + '</b> · ' + esc(p.positionName) + ' · ' + esc(p.wardCode + ' ' + p.wardName) + '</p><p>' + statusChip(p.status) +
    (p.level ? ' <span class="chip">Level ' + p.level + ' · ' + esc(p.levelName) + '</span>' : '') + (p.stepCode ? ' <span class="chip ' + (p.stepAlert ? 'alert' : 'info') + '">' + p.stepCode + ' · ' + p.stepYears + ' ปี</span>' : '') +
    (p.apiFlag ? ' <span class="chip warn">HR: ' + (p.apiFlag === 'NOT_FOUND' ? 'ไม่พบในระบบ HR — โปรดตรวจสอบสถานะ' : 'ครบวันพ้นสภาพตามระบบ HR') + '</span>' : '') + '</p></div></div>' +
    '<div class="pf-a">' + acts + '</div></section>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" class="tab' + (t[0] === tab ? ' on' : '') + '" data-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
    '<div class="card" id="tabBody"></div>';
  var body = $('#tabBody');
  var show = function (t) {
    tab = t; $$('.tab', v).forEach(function (b) { var on = b.getAttribute('data-tab') === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    body.innerHTML = profileTab(d, t); bindHref(body); bindProfileTab(body, d, t);
  };
  $$('.tab', v).forEach(function (b) { b.onclick = function () { show(b.getAttribute('data-tab')); }; });
  show(tab);
  $$('[data-a]', $('.pf-a', v)).forEach(function (b) {
    b.onclick = function () {
      var a = b.getAttribute('data-a');
      if (a === 'edit') personForm(d); else if (a === 'transfer') transferDialog(d); else if (a === 'status') statusDialog(d);
      else if (a === 'self') selfDialog(d); else if (a === 'req') requestDialog('PROFILE', d); else if (a === 'print') printProfile(d);
    };
  });
}
function profileTab(d, t) {
  var p = d.p, raw = d.raw;
  if (t === 'info') return '<div class="kvs">' + kv('คำนำหน้า', esc(p.title)) + kv('ชื่อ', esc(p.firstName)) + kv('นามสกุล', esc(p.lastName)) +
    kv('ชื่อ-นามสกุล (อังกฤษ)', esc([raw.firstNameEn, raw.lastNameEn].filter(Boolean).join(' '))) + kv('เบอร์โทรศัพท์', esc(raw.phone)) + kv('อีเมล', esc(raw.email)) +
    kv('ปีเกิด (พ.ศ.)', esc(raw.birthYear)) + kv('เลขที่ใบประกอบวิชาชีพ', esc(raw.licenseNo)) +
    kv('วันหมดอายุใบประกอบฯ', raw.licenseExp ? td(raw.licenseExp) + (p.licenseWarn ? ' <span class="chip warn">' + (p.licenseDays < 0 ? 'หมดอายุแล้ว' : 'อีก ' + p.licenseDays + ' วัน') + '</span>' : '') : '') +
    kv('ความประสงค์ในการปฏิบัติงาน', esc(raw.wish), 'full') + kv('หมายเหตุ', esc(raw.note), 'full') + '</div>' +
    '<p class="muted small">แหล่งข้อมูล: ' + esc({ API: 'SmartAPI (HR)', IMPORT: 'นำเข้าไฟล์', MANUAL: 'บันทึกในระบบ', DEMO: 'ข้อมูลสาธิต' }[raw.source] || raw.source || '-') +
    (raw.apiSyncAt ? ' · ซิงก์ HR ล่าสุด ' + esc(raw.apiSyncAt.replace('T', ' ')) : '') + ' · แก้ไขล่าสุด ' + esc((raw.updatedAt || '').replace('T', ' ')) + ' โดย ' + esc(raw.updatedBy) + '</p>';
  if (t === 'work') {
    var st = p.stepEligible ? '<div class="step-box' + (p.stepAlert ? ' alert' : '') + '"><div><span class="muted">ขั้นการทำงานในปัจจุบัน</span><b class="big">' + (p.stepCode || '-') + '</b></div>' +
      '<div><span class="muted">ปีที่ได้</span><b>' + (p.stepYear || '-') + '</b></div><div><span class="muted">ระยะเวลาที่ได้รับขั้น</span><b>' + (p.stepYears == null ? '-' : p.stepYears + ' ปี') + '</b></div>' +
      '<div><span class="muted">สถานะ</span><b>' + (p.stepAlert ? '<span class="star">★</span> ควรติดตาม' : p.stepCode ? '<span class="ok-t">ปกติ</span>' : '<span class="muted">ยังไม่ระบุ</span>') + '</b></div></div>' +
      (p.stepAlert ? '<p class="note-a">★ หมายถึง ได้รับขั้นการทำงานนี้เกิน ' + S.boot.settings.thresholds[p.stepCode] + ' ปีแล้ว และควรตรวจสอบ/ติดตามตามกระบวนการของหน่วยงาน — ระบบไม่เลื่อนขั้นให้อัตโนมัติ</p>' : '') +
      (p.stepError ? '<p class="note-w">' + esc(p.stepError) + '</p>' : '') + (p.mismatch ? '<p class="note-i">ⓘ ' + esc(p.mismatch) + '</p>' : '')
      : '<p class="muted">ตำแหน่ง ' + esc(p.positionName) + ' ไม่ใช้ขั้นการทำงาน C3–C9</p>';
    return st + '<div class="kvs">' + kv('หอ/หน่วยงาน', esc(p.wardCode + ' · ' + p.wardName)) + kv('ส่วนงาน/สายงาน', esc(p.divName)) + kv('ตำแหน่ง', esc(p.positionName)) +
      kv('ตำแหน่งตามระบบ HR', esc(raw.hrPosition)) + kv('หน่วยงานตามระบบ HR', esc(raw.hrOrgUnit)) + kv('วันเริ่มงาน รพ.', raw.startDate ? td(raw.startDate) : '') + kv('อายุงาน รพ.', esc(p.serviceText)) +
      kv('วันเริ่มปฏิบัติงานวิชาชีพ', raw.profStartDate ? td(raw.profStartDate) : '<span class="muted">ไม่ได้ระบุ (ใช้วันเริ่มงาน รพ.)</span>') + kv('อายุงานวิชาชีพ', esc(p.profText)) +
      kv('ระดับประสบการณ์', p.level ? 'Level ' + p.level + ' – ' + esc(p.levelName) : '') + kv('สถานะ', statusChip(p.status) + (raw.statusDate ? ' <span class="muted">ตั้งแต่ ' + td(raw.statusDate) + '</span>' : '')) + '</div>';
  }
  if (t === 'edu') return (d.can.edit ? '<div class="row-a"><button class="btn sm primary" data-ed="new">+ เพิ่มวุฒิการศึกษา</button></div>' : d.can.self ? '<div class="row-a"><button class="btn sm" data-req="EDUCATION">ขอเพิ่มวุฒิการศึกษา</button></div>' : '') +
    (d.education.length ? '<table class="tbl rows"><thead><tr><th>วุฒิการศึกษา</th><th>สาขาวิชา</th><th>สถาบัน</th><th>ปีที่จบ</th>' + (d.can.edit ? '<th></th>' : '') + '</tr></thead><tbody>' + d.education.map(function (e) {
      return '<tr><td data-l="วุฒิ">' + esc(e.degree) + '</td><td data-l="สาขา">' + esc(e.major) + '</td><td data-l="สถาบัน">' + esc(e.institute) + '</td><td data-l="ปีที่จบ">' + esc(e.gradYear) + '</td>' + (d.can.edit ? '<td class="r"><button class="btn sm ghost" data-ed="' + e.id + '">แก้ไข</button><button class="btn sm ghost danger-t" data-edx="' + e.id + '">ลบ</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table>' : empty('ยังไม่มีข้อมูลการศึกษา'));
  if (t === 'training') {
    var h = 0; d.training.forEach(function (x) { h += +x.hours || 0; });
    return '<div class="row-a"><span class="muted">รวม ' + d.training.length + ' รายการ · ' + num(h, 1) + ' ชั่วโมง</span><span class="sp"></span>' +
      (d.can.edit ? '<button class="btn sm primary" data-tr="new">+ บันทึกการอบรม</button>' : '') + (d.can.self ? '<button class="btn sm" data-req="TRAINING">แจ้งอบรมที่ไปมา</button>' : '') + '</div>' +
      (d.training.length ? '<table class="tbl rows"><thead><tr><th>วันที่</th><th>หลักสูตร</th><th>รูปแบบ</th><th>ผู้จัด / สถานที่</th><th class="r">ชม.</th>' + (d.can.edit ? '<th></th>' : '') + '</tr></thead><tbody>' + d.training.map(function (x) {
        return '<tr><td data-l="วันที่">' + td(x.date) + '</td><td data-l="หลักสูตร"><b>' + esc(x.name) + '</b></td><td data-l="รูปแบบ"><span class="chip">' + esc(S.boot.lists.trainTypes[x.type] || x.type) + '</span></td><td data-l="ผู้จัด">' + esc([x.organizer, x.location].filter(Boolean).join(' · ')) + '</td><td data-l="ชม." class="r">' + esc(x.hours) + '</td>' +
          (d.can.edit ? '<td class="r"><button class="btn sm ghost" data-tre="' + x.id + '">แก้ไข</button></td>' : '') + '</tr>';
      }).join('') + '</tbody></table>' : empty('ยังไม่มีประวัติการอบรม'));
  }
  if (t === 'comp') return d.competency.length ? '<table class="tbl rows"><thead><tr><th>รอบประเมิน</th>' + S.boot.lists.compCats.map(function (c) { return '<th class="r">' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + d.competency.map(function (x) {
    return '<tr><td data-l="รอบ"><b>' + esc(x.round) + '</b></td>' + S.boot.lists.compCats.map(function (c) { var y = x.data[c]; return '<td data-l="' + c + '" class="r">' + (y ? compBadge(y.avg) : '-') + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table><p class="muted small">ค่าเฉลี่ยรายหมวด · ต่ำกว่า ' + S.boot.settings.COMP_RED_MAX + ' = ต่ำกว่าเกณฑ์ · รายละเอียดรายข้อดูในระบบ Dashboard Competency</p>' : empty('ยังไม่มีข้อมูล Competency');
  if (t === 'att') {
    var a = d.attendance, types = a.types;
    return '<div class="row-a"><b>ปีงบประมาณ ' + a.fy + '</b><span class="sp"></span>' + (d.can.edit ? '<a class="btn sm primary" href="#/attendance?empCode=' + p.empCode + '&new=1">+ บันทึกขาด/ลา/สาย</a>' : '') + '</div>' +
      '<p class="att-sum">' + attTypeSummary(a.total, a.count, types) + '</p>' +
      '<div class="tbl-wrap"><table class="tbl cal"><thead><tr><th>ประเภท</th>' + a.months.map(function (m) { return '<th class="r">' + R.ymTh(m.ym).split(' ')[0] + '</th>'; }).join('') + '<th class="r">รวม</th></tr></thead><tbody>' +
      types.map(function (t2) { return '<tr><td>' + esc(t2.name) + '</td>' + a.months.map(function (m) { var x = m.d[t2.code]; return '<td class="r">' + (x ? (t2.unit === 'min' ? (m.n[t2.code] || 0) + '<small>/' + x + '′</small>' : num(x, 1)) : '<span class="muted">·</span>') + '</td>'; }).join('') + '<td class="r"><b>' + (a.total[t2.code] ? (t2.unit === 'min' ? (a.count[t2.code] || 0) + ' ครั้ง' : num(a.total[t2.code], 1)) : '-') + '</b></td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted small">มาสาย แสดงเป็น ครั้ง/นาที · ลาและขาดแสดงเป็นวัน</p>' +
      (a.recent.length ? '<h3>รายการล่าสุด</h3><ul class="list">' + a.recent.map(function (x) { var lt = leaveType(x.type); return '<li><b>' + td(x.date) + '</b> <span class="att-pill sm t-' + esc(x.type) + '">' + esc(lt.name) + '</span> ' + (lt.unit === 'min' ? x.minutes + ' นาที' : x.days + ' วัน') + (x.note ? ' <span class="muted">· ' + esc(x.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '');
  }
  if (t === 'hist') {
    var items = [];
    d.transfers.forEach(function (x) { items.push({ d: x.date, h: '<b>ย้ายหน่วยงาน</b> ' + esc(x.fromWard) + ' → ' + esc(x.toWard || x.toText + ' (นอกฝ่าย)') + (x.note ? ' <span class="muted">· ' + esc(x.note) + '</span>' : '') }); });
    d.statusLog.forEach(function (x) { items.push({ d: x.date, h: '<b>เปลี่ยนสถานะ</b> ' + esc(S.boot.lists.status[x.fromStatus] || x.fromStatus || '-') + ' → ' + esc(S.boot.lists.status[x.toStatus] || x.toStatus) + (x.reason ? ' · ' + esc(x.reason) : '') }); });
    d.steps.forEach(function (x) { items.push({ d: x.at.slice(0, 10), h: '<b>ขั้นการทำงาน</b> ' + (x.prevStep ? esc(x.prevStep + ' (' + x.prevYear + ')') + ' → ' : '') + esc(x.stepCode + ' (' + x.stepYear + ')') + (x.note ? ' <span class="muted">· ' + esc(x.note) + '</span>' : '') }); });
    items.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    return items.length ? '<ol class="timeline">' + items.map(function (x) { return '<li><span class="tl-d">' + td(x.d) + '</span><span>' + x.h + '</span></li>'; }).join('') + '</ol>' : empty('ยังไม่มีประวัติการย้าย การเปลี่ยนสถานะ หรือการเปลี่ยนขั้น');
  }
  if (t === 'health') return '<div id="hBox">' + skeleton(2) + '</div>';
  return '';
}
function compBadge(avg) { var s = S.boot.settings, b = avg < s.COMP_RED_MAX ? 'low' : avg <= s.COMP_YELLOW_MAX ? 'mid' : 'high'; return '<span class="cb ' + b + '">' + num(avg, 1) + '</span>'; }
function reloadProfile(d) { cacheClear(); render(); }
function bindProfileTab(body, d, t) {
  $$('[data-ed]', body).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-ed'); eduDialog(d, id === 'new' ? null : d.education.filter(function (e) { return e.id === id; })[0]); }; });
  $$('[data-edx]', body).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-edx'); confirmBox('ลบวุฒิการศึกษา', 'ต้องการลบรายการนี้หรือไม่', 'ลบ', 'danger').then(function () { api('deleteEducation', { id: id }).then(function () { toast('ลบแล้ว'); reloadProfile(); }).catch(fail); }); }; });
  $$('[data-req]', body).forEach(function (b) { b.onclick = function () { requestDialog(b.getAttribute('data-req'), d); }; });
  $$('[data-tr]', body).forEach(function (b) { b.onclick = function () { trainingForm(null, [{ empCode: d.p.empCode, fullName: d.p.fullName }]); }; });
  $$('[data-tre]', body).forEach(function (b) { b.onclick = function () { var x = d.training.filter(function (y) { return y.id === b.getAttribute('data-tre'); })[0]; trainingForm(x); }; });
  if (t === 'health') healthBox($('#hBox', body), d);
}

/* ================================================================ ฟอร์มเพิ่ม/แก้ไขบุคลากร */
function personForm(d) {
  var isNew = !d, p = d ? d.p : {}, raw = d ? d.raw : {}, ew = S.boot.editWards;
  var body = '<form id="pfm" class="form-grid" novalidate>' +
    '<h4 class="fg-h">A. ข้อมูลประจำตัว</h4>' +
    '<label class="fld"><span>รหัสพนักงาน (7 หลัก) *</span><input name="empCode" inputmode="numeric" maxlength="7" value="' + attr(p.empCode || '') + '"' + (isNew ? '' : ' readonly') + '></label>' +
    '<label class="fld"><span>คำนำหน้า</span><select name="title">' + opts(S.boot.lists.titles, p.title || '', 'เลือก') + '</select></label>' +
    '<label class="fld"><span>ชื่อ *</span><input name="firstName" value="' + attr(p.firstName || '') + '"></label>' +
    '<label class="fld"><span>นามสกุล *</span><input name="lastName" value="' + attr(p.lastName || '') + '"></label>' +
    '<label class="fld"><span>ชื่อ (อังกฤษ)</span><input name="firstNameEn" value="' + attr(raw.firstNameEn || '') + '"></label>' +
    '<label class="fld"><span>นามสกุล (อังกฤษ)</span><input name="lastNameEn" value="' + attr(raw.lastNameEn || '') + '"></label>' +
    '<label class="fld"><span>เลขที่ใบประกอบวิชาชีพ</span><input name="licenseNo" value="' + attr(raw.licenseNo || '') + '"></label>' +
    '<label class="fld"><span>วันหมดอายุใบประกอบฯ</span><input type="date" name="licenseExp" value="' + attr(raw.licenseExp || '') + '"></label>' +
    '<label class="fld"><span>เบอร์โทรศัพท์</span><input name="phone" inputmode="tel" value="' + attr(raw.phone || '') + '"></label>' +
    '<label class="fld"><span>อีเมล</span><input name="email" type="email" value="' + attr(raw.email || '') + '"></label>' +
    '<label class="fld"><span>ปีเกิด (พ.ศ.)</span><input name="birthYear" inputmode="numeric" maxlength="4" value="' + attr(raw.birthYear || '') + '"></label>' +
    '<h4 class="fg-h">B. ข้อมูลการปฏิบัติงาน</h4>' +
    (isNew ? '<label class="fld"><span>หอ/หน่วยงาน *</span><select name="wardCode">' + wardOpts(ew && ew.length === 1 ? ew[0] : '', 'เลือกหอ/หน่วย', ew) + '</select></label>'
      : '<div class="fld"><span>หอ/หน่วยงาน</span><div class="ro">' + esc(p.wardCode + ' · ' + p.wardName) + ' <span class="muted small">(เปลี่ยนด้วยปุ่ม "ย้ายหน่วยงาน")</span></div></div>') +
    '<label class="fld"><span>ตำแหน่ง *</span><select name="positionCode">' + posOpts(p.positionCode || '', 'เลือกตำแหน่ง') + '</select></label>' +
    '<label class="fld"><span>วันเริ่มงาน รพ.</span><input type="date" name="startDate" value="' + attr(raw.startDate || '') + '" max="' + isoToday() + '"></label>' +
    '<label class="fld"><span>วันเริ่มปฏิบัติงานวิชาชีพ <small class="muted">(รวมที่อื่น)</small></span><input type="date" name="profStartDate" value="' + attr(raw.profStartDate || '') + '" max="' + isoToday() + '"></label>' +
    '<div class="fld full"><span>อายุงาน / ระดับประสบการณ์ (คำนวณอัตโนมัติ)</span><div class="ro" id="lvOut">-</div></div>' +
    '<h4 class="fg-h">C. ขั้นการทำงานในปัจจุบัน</h4>' +
    '<label class="fld"><span>ขั้นการทำงาน</span><select name="stepCode">' + opts(R.STEPS, p.stepCode || '', 'ไม่ระบุ') + '</select></label>' +
    '<label class="fld"><span>ปีที่ได้ (พ.ศ.)</span><input name="stepYear" inputmode="numeric" maxlength="4" value="' + attr(p.stepYear || '') + '" placeholder="เช่น ' + (S.boot.nowBE - 2) + '"></label>' +
    '<div class="fld full"><span>ระยะเวลาที่ได้รับขั้น / สถานะ (คำนวณอัตโนมัติ แก้ไม่ได้)</span><div class="ro" id="stOut">-</div></div>' +
    '<label class="fld full"><span>หมายเหตุการเปลี่ยนขั้น (ถ้ามี)</span><input name="stepNote" placeholder="เช่น ตามคำสั่งที่ …"></label>' +
    '<h4 class="fg-h">D. อื่น ๆ</h4>' +
    '<label class="fld full"><span>ความประสงค์ในการปฏิบัติงาน</span><textarea name="wish" rows="2">' + esc(raw.wish || '') + '</textarea></label>' +
    '<label class="fld full"><span>หมายเหตุ</span><textarea name="note" rows="2">' + esc(raw.note || '') + '</textarea></label></form>';
  modal({ title: isNew ? 'เพิ่มบุคลากร' : 'แก้ไขข้อมูล · ' + p.fullName, wide: true, body: body,
    onOpen: function (box) {
      var f = $('#pfm', box);
      var calc = function () {
        var x = formData(f), pos = S.boot.positions.filter(function (q) { return q.code === x.positionCode; })[0], elig = pos && pos.stepEligible === 'TRUE';
        var m = R.monthsBetween(x.profStartDate || x.startDate, isoToday()), lv = R.levelOf(m);
        $('#lvOut', box).innerHTML = (x.startDate ? 'อายุงาน รพ. ' + esc(R.serviceText(R.monthsBetween(x.startDate, isoToday()))) : 'ยังไม่มีวันเริ่มงาน') + (lv ? ' · <b>Level ' + lv.level + ' – ' + lv.name + '</b> (จาก' + (x.profStartDate ? 'วันเริ่มวิชาชีพ' : 'วันเริ่มงาน รพ.') + ')' : '');
        f.stepCode.disabled = f.stepYear.disabled = !elig;
        if (!elig) { $('#stOut', box).innerHTML = pos ? 'ตำแหน่งนี้ไม่ใช้ขั้น C3–C9' : 'เลือกตำแหน่งก่อน'; return; }
        var si = R.stepInfo(x.stepCode, x.stepYear, S.boot.nowBE, x.stepCode ? S.boot.settings.thresholds[x.stepCode] : 2);
        if (!si.has) { $('#stOut', box).innerHTML = '<span class="muted">ยังไม่เลือกขั้น</span>'; return; }
        var mm = lv ? R.stepMismatch(lv.level, x.stepCode) : '';
        $('#stOut', box).innerHTML = si.error ? '<span class="err-t">' + esc(si.error) + '</span>' : 'ได้รับขั้น ' + x.stepCode + ' มาแล้ว <b>' + si.years + ' ปี</b> ' + (si.alert ? '<span class="star">★</span> เกินเกณฑ์ ' + S.boot.settings.thresholds[x.stepCode] + ' ปี' : '<span class="ok-t">ปกติ</span>') + (mm ? '<div class="note-i small">ⓘ ' + esc(mm) + '</div>' : '');
      };
      $$('input,select', f).forEach(function (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }); calc();
    },
    actions: [{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) {
      var x = formData($('#pfm', box)); x.isNew = isNew;
      if (!R.validEmpCode(x.empCode)) { toast('รหัสพนักงานต้องเป็นตัวเลข 7 หลัก', 'err'); return; }
      if (!$('#pfm', box).stepCode.disabled && x.stepCode && !x.stepYear) { toast('กรุณาระบุปีที่ได้ขั้น ' + x.stepCode, 'err'); return; }
      if ($('#pfm', box).stepCode.disabled) { x.stepCode = ''; x.stepYear = ''; }
      return api('savePerson', x).then(function (r) { close(); toast('บันทึกแล้ว'); cacheClear(); if (isNew) go('person/' + r.empCode); else render(); });
    } }] });
}
function addByCodesDialog() {
  modal({ title: 'เพิ่มบุคลากรจากรหัสพนักงาน (SmartAPI)', body: '<p class="muted">ระบบดึงชื่อ ตำแหน่ง หน่วยงาน และวันเริ่มงานจากระบบ HR ให้อัตโนมัติ</p>' +
    '<label class="fld"><span>รหัสพนักงาน (คั่นด้วยเว้นวรรค จุลภาค หรือขึ้นบรรทัดใหม่)</span><textarea id="abc" rows="5"></textarea></label>' +
    '<label class="fld"><span>หอ/หน่วยงาน (ถ้าระบบ HR ไม่ระบุ)</span><select id="abw">' + wardOpts('', 'ให้ระบบเทียบจากหน่วยงาน HR', S.boot.editWards) + '</select></label><div id="abr"></div>',
    actions: [{ label: 'ตรวจสอบ', onClick: function (close, box) {
      return api('addByCodes', { codes: $('#abc', box).value, ward: $('#abw', box).value, preview: true }).then(function (r) {
        $('#abr', box).innerHTML = '<p>พร้อมเพิ่ม ' + r.ok.length + ' คน' + (r.errors.length ? ' · <span class="err-t">มีปัญหา ' + r.errors.length + ' รายการ</span>' : '') + '</p>' +
          (r.errors.length ? '<ul class="errs">' + r.errors.map(function (e) { return '<li>' + esc(e.empCode) + ': ' + esc(e.msg) + '</li>'; }).join('') + '</ul>' : '') +
          (r.ok.length ? '<ul class="list">' + r.ok.slice(0, 10).map(function (o) { return '<li>' + esc(o.empCode + ' ' + o.firstName + ' ' + o.lastName + ' · ' + o.wardCode + ' · ' + o.positionCode) + (o.exists ? ' <span class="muted">(มีแล้ว — เติมช่องว่าง)</span>' : '') + '</li>'; }).join('') + '</ul>' : '');
      });
    } }, { label: 'เพิ่มเข้าระบบ', kind: 'primary', onClick: function (close, box) {
      return api('addByCodes', { codes: $('#abc', box).value, ward: $('#abw', box).value }).then(function (r) { close(); toast('เพิ่ม/ปรับปรุง ' + r.added + ' คน' + (r.errors.length ? ' · ข้าม ' + r.errors.length : '')); render(); });
    } }] });
}

/* ================================================================ การศึกษา / ย้าย / สถานะ / ตนเอง */
function eduFields(e) {
  e = e || {};
  return '<label class="fld"><span>วุฒิการศึกษา *</span><select name="degree">' + opts(S.boot.lists.degrees, e.degree || '', 'เลือก') + '</select></label>' +
    '<label class="fld"><span>สาขาวิชา</span><input name="major" value="' + attr(e.major || '') + '" placeholder="เช่น พยาบาลศาสตร์"></label>' +
    '<label class="fld"><span>สถาบันการศึกษา</span><input name="institute" value="' + attr(e.institute || '') + '"></label>' +
    '<label class="fld"><span>ปีที่จบ (พ.ศ.)</span><input name="gradYear" inputmode="numeric" maxlength="4" value="' + attr(e.gradYear || '') + '"></label>';
}
function eduDialog(d, e) {
  modal({ title: (e ? 'แก้ไข' : 'เพิ่ม') + 'วุฒิการศึกษา · ' + d.p.fullName, body: '<form id="edf">' + eduFields(e) + '</form>',
    actions: [{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) { var x = formData($('#edf', box)); x.empCode = d.p.empCode; if (e) x.id = e.id;
      return api('saveEducation', x).then(function () { close(); toast('บันทึกแล้ว'); reloadProfile(); }); } }] });
}
function transferDialog(d) {
  modal({ title: 'ย้ายหน่วยงาน · ' + d.p.fullName, body: '<p class="muted">หอปัจจุบัน: <b>' + esc(d.p.wardCode + ' ' + d.p.wardName) + '</b> · ระบบเก็บประวัติหอเดิมไว้เสมอ</p>' +
    '<form id="tff"><div class="seg"><label><input type="radio" name="where" value="in" checked> ย้ายภายในฝ่ายการพยาบาล</label><label><input type="radio" name="where" value="out"> ย้ายออกนอกฝ่าย</label></div>' +
    '<label class="fld" id="tfIn"><span>หอ/หน่วยงานปลายทาง *</span><select name="toWard">' + wardOpts('', 'เลือกหอปลายทาง') + '</select></label>' +
    '<label class="fld" id="tfOut" hidden><span>หน่วยงานปลายทาง (พิมพ์) *</span><input name="toText" placeholder="เช่น ฝ่ายเภสัชกรรม"></label>' +
    '<label class="fld"><span>วันที่ย้าย *</span><input type="date" name="date" value="' + isoToday() + '"></label><label class="fld"><span>หมายเหตุ</span><input name="note"></label>' +
    '<p class="note-w small" id="tfWarn" hidden>ย้ายออกนอกฝ่าย = สถานะเปลี่ยนเป็น "พ้นสภาพ" ในระบบนี้ (ข้อมูลไม่ถูกลบ)</p></form>',
    onOpen: function (box) { $$('[name=where]', box).forEach(function (r) { r.onchange = function () { var out = $('[name=where]:checked', box).value === 'out'; $('#tfIn', box).hidden = out; $('#tfOut', box).hidden = !out; $('#tfWarn', box).hidden = !out; }; }); },
    actions: [{ label: 'บันทึกการย้าย', kind: 'primary', onClick: function (close, box) { var x = formData($('#tff', box));
      return api('transferPerson', { empCode: d.p.empCode, outside: x.where === 'out', toWard: x.toWard, toText: x.toText, date: x.date, note: x.note }).then(function () { close(); toast('บันทึกการย้ายแล้ว'); reloadProfile(); }); } }] });
}
function statusDialog(d) {
  modal({ title: 'เปลี่ยนสถานะ · ' + d.p.fullName, body: '<p class="muted">สถานะปัจจุบัน: ' + statusChip(d.p.status) + ' · ไม่มีการลบข้อมูลบุคลากรออกจากฐานข้อมูล</p><form id="sff">' +
    '<label class="fld"><span>สถานะใหม่ *</span><select name="status">' + opts(Object.keys(S.boot.lists.status).filter(function (k) { return k !== d.p.status; }).map(function (k) { return { v: k, l: S.boot.lists.status[k] }; }), '') + '</select></label>' +
    '<label class="fld"><span>วันที่มีผล *</span><input type="date" name="date" value="' + isoToday() + '"></label>' +
    '<label class="fld"><span>เหตุผล (จำเป็นเมื่อพ้นสภาพ/ลาออก)</span><input name="reason" placeholder="เช่น ลาออก / เกษียณ / ลาศึกษาต่อ ป.โท"></label><label class="fld"><span>หมายเหตุ</span><input name="note"></label></form>',
    actions: [{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) { var x = formData($('#sff', box)); x.empCode = d.p.empCode;
      return api('setStatus', x).then(function () { close(); toast('เปลี่ยนสถานะแล้ว'); reloadProfile(); }); } }] });
}
function selfDialog(d) {
  modal({ title: 'แก้ไขเบอร์โทรศัพท์ / อีเมล', body: '<form id="slf"><label class="fld"><span>เบอร์โทรศัพท์</span><input name="phone" inputmode="tel" value="' + attr(d.raw.phone || '') + '"></label>' +
    '<label class="fld"><span>อีเมล</span><input name="email" type="email" value="' + attr(d.raw.email || '') + '"></label></form><p class="muted small">ข้อมูลอื่นใช้ปุ่ม "ขอแก้ไขข้อมูล" ให้หัวหน้าหออนุมัติ</p>',
    actions: [{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) { return api('selfUpdate', formData($('#slf', box))).then(function () { close(); toast('บันทึกแล้ว'); reloadProfile(); }); } }] });
}
function healthBox(host, d) {
  api('getPersonnelHealth', { empCode: d.p.empCode }).then(function (h) {
    host.innerHTML = '<p class="note-a">ข้อมูลอ่อนไหวตาม PDPA · ทุกการเปิดดูถูกบันทึกใน Audit Log</p><form id="hf"><label class="fld full"><span>ข้อจำกัดในการปฏิบัติงานที่เกี่ยวข้องกับสุขภาพ</span><textarea name="workLimit" rows="2">' + esc(h.workLimit) + '</textarea></label>' +
      '<label class="fld full"><span>หมายเหตุ</span><textarea name="note" rows="2">' + esc(h.note) + '</textarea></label><label class="fld"><span>วันที่บุคลากรให้ความยินยอม *</span><input type="date" name="consentDate" value="' + attr(h.consentDate) + '"></label>' +
      (d.can.decide ? '<button class="btn primary" type="submit">บันทึก</button>' : '') + '</form>';
    $('#hf', host).onsubmit = function (e) { e.preventDefault(); var x = formData(e.target); x.empCode = d.p.empCode; api('savePersonnelHealth', x).then(function () { toast('บันทึกแล้ว'); }).catch(fail); };
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
