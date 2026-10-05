/**
 * pages-records.js — การอบรม · ขาด ลา มาสาย (บันทึก + Dashboard) · คำขอแก้ไขข้อมูล
 */
var TEMPLATE_FILES = { PERSON: 'template_1_personnel_codes.xlsx', EXTRA: 'template_2_personnel_extra.xlsx', TRAINING: 'template_3_training.xlsx', COMPETENCY: 'template_4_competency.xlsx', ATTENDANCE: 'template_5_attendance.xlsx' };
function fyStart(fy) { return (fy - 544) + '-10-01'; }

/* ================================================================ การอบรม */
route('training', function (v, r) {
  if (!can('staff')) { go('me', { tab: 'training' }); return; }
  var fy = S.boot.fy, f = { from: r.q.from || fyStart(fy), to: r.q.to || isoToday(), div: r.q.div || '', ward: r.q.ward || '', type: r.q.type || '', q: r.q.q || '', page: +r.q.page || 1 };
  v.innerHTML = pageHead('การอบรม', 'ประวัติการอบรมของบุคลากร · Onsite / On Zoom',
    (can('edit') ? '<button class="btn primary" id="addT">+ บันทึกการอบรม</button><a class="btn" href="#/import?kind=TRAINING">⇪ นำเข้าจาก Excel</a>' : '') +
    '<a class="btn" href="#/reports' + qs({ type: 'TRAINING', from: f.from, to: f.to, div: f.div, ward: f.ward, ttype: f.type }) + '">⎙ พิมพ์ / ส่งออก</a>') +
    '<form class="filters" id="tf"><label class="fld sm"><span>ตั้งแต่</span><input type="date" name="from" value="' + f.from + '"></label><label class="fld sm"><span>ถึง</span><input type="date" name="to" value="' + f.to + '"></label>' +
    scopeFilters(f) + '<label class="fld sm"><span>รูปแบบ</span><select name="type">' + opts([{ v: 'ONSITE', l: 'Onsite' }, { v: 'ZOOM', l: 'On Zoom' }], f.type, 'ทั้งหมด') + '</select></label>' +
    '<label class="fld grow"><span>ค้นหา</span><input type="search" name="q" value="' + attr(f.q) + '" placeholder="หลักสูตร ชื่อ หรือรหัส"></label></form><div id="tl" class="card flush">' + skeleton(5) + '</div>';
  var apply = function () { var x = formData($('#tf')); go('training', x); };
  $$('#tf select, #tf input[type=date]').forEach(function (el) { el.onchange = function () { if (el.name === 'div') $('#tf [name=ward]').value = ''; apply(); }; });
  $('#tf [name=q]').addEventListener('input', debounce(apply, 450)); $('#tf').onsubmit = function (e) { e.preventDefault(); apply(); };
  if ($('#addT')) $('#addT').onclick = function () { trainingForm(null, []); };
  var draw = function (d) {
    $('#tl').innerHTML = '<div class="sum-row"><span><b>' + num(d.total, 0) + '</b> รายการ</span><span><b>' + num(d.persons, 0) + '</b> คน</span><span><b>' + num(d.hours, 1) + '</b> ชั่วโมง</span></div>' +
      (!d.rows.length ? empty('ไม่พบการอบรมในช่วงนี้') : '<div class="tbl-wrap"><table class="tbl rows"><thead><tr><th>วันที่</th><th>บุคลากร</th><th>หลักสูตร</th><th>รูปแบบ</th><th>ผู้จัด / สถานที่</th><th class="r">ชม.</th>' + (can('edit') ? '<th></th>' : '') + '</tr></thead><tbody>' +
        d.rows.map(function (x) { return '<tr><td data-l="วันที่">' + td(x.date) + '</td><td data-l="บุคลากร"><a href="#/person/' + x.empCode + '">' + esc(x.fullName) + '</a><div class="muted small">' + x.empCode + ' · ' + esc(x.wardCode) + '</div></td><td data-l="หลักสูตร"><b>' + esc(x.name) + '</b></td>' +
          '<td data-l="รูปแบบ"><span class="chip">' + esc(S.boot.lists.trainTypes[x.type] || x.type) + '</span></td><td data-l="ผู้จัด">' + esc([x.organizer, x.location].filter(Boolean).join(' · ')) + '</td><td class="r" data-l="ชม.">' + esc(x.hours) + '</td>' +
          (can('edit') ? '<td class="r"><button class="btn sm ghost" data-e="' + x.id + '">แก้ไข</button></td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>' + pager(d));
    bindPager($('#tl'), function (p) { go('training', Object.assign({}, f, { page: p })); });
    $$('[data-e]', $('#tl')).forEach(function (b) { b.onclick = function () { trainingForm(d.rows.filter(function (x) { return x.id === b.getAttribute('data-e'); })[0]); }; });
  };
  api('listTraining', f, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); $('#tl').innerHTML = empty(e.message); });
});

function trainingFields(x) {
  x = x || {};
  return '<label class="fld"><span>วันที่อบรม *</span><input type="date" name="date" value="' + attr(x.date || isoToday()) + '" max="' + isoToday() + '"></label>' +
    '<label class="fld"><span>รูปแบบ *</span><select name="type">' + opts([{ v: 'ONSITE', l: 'Onsite' }, { v: 'ZOOM', l: 'On Zoom' }], x.type || 'ONSITE') + '</select></label>' +
    '<label class="fld full"><span>หลักสูตร *</span><input name="name" value="' + attr(x.name || '') + '" placeholder="เช่น การช่วยฟื้นคืนชีพขั้นสูง (ACLS)"></label>' +
    '<label class="fld"><span>หน่วยงานผู้จัด</span><input name="organizer" value="' + attr(x.organizer || '') + '"></label>' +
    '<label class="fld"><span>สถานที่</span><input name="location" value="' + attr(x.location || '') + '"></label>' +
    '<label class="fld"><span>ชั่วโมงอบรม</span><input name="hours" inputmode="decimal" value="' + attr(x.hours == null ? '' : x.hours) + '"></label>' +
    '<label class="fld"><span>หมายเหตุ</span><input name="note" value="' + attr(x.note || '') + '"></label>';
}
function trainingForm(x, people) {
  var pick = null;
  modal({ title: x ? 'แก้ไขการอบรม · ' + (x.fullName || x.empCode) : 'บันทึกการอบรม', wide: true,
    body: (x ? '' : '<div class="fld full"><span>บุคลากรที่เข้าอบรม * <small class="muted">(เลือกได้หลายคน)</small></span><div id="tpp"></div></div>') + '<form id="trf" class="form-grid">' + trainingFields(x) + '</form>',
    onOpen: function (box) { if (!x) pick = personPicker($('#tpp', box), { edit: true, value: people || [] }); },
    actions: (x ? [{ label: 'ลบรายการ', kind: 'danger', onClick: function (close) { return api('deleteTraining', { id: x.id, date: x.date }).then(function () { close(); toast('ลบแล้ว'); cacheClear(); render(); }); } }] : []).concat([{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) {
      var d = formData($('#trf', box));
      if (x) { d.id = x.id; d.oldDate = x.date; }
      else { d.empCodes = pick.getValue().map(function (p) { return p.empCode; }); if (!d.empCodes.length) { toast('กรุณาเลือกบุคลากรอย่างน้อย 1 คน', 'err'); return; } }
      return api('saveTraining', d).then(function (r) { close(); toast('บันทึกแล้ว ' + (r.saved || 1) + ' รายการ'); cacheClear(); render(); });
    } }]) });
}

/* ================================================================ ขาด ลา มาสาย */
route('attendance', function (v, r) {
  if (!can('staff')) { go('me', { tab: 'att' }); return; }
  var tab = r.q.tab || (r.q.new || r.q.empCode ? 'list' : 'dash');
  v.innerHTML = pageHead('ขาด ลา มาสาย', 'บันทึกรายคน หรือนำเข้าจากแม่แบบ Excel ของแต่ละหน่วย · เก็บแยกไฟล์รายเดือนใน Google Drive',
    (can('edit') ? '<button class="btn primary" id="addA">+ บันทึกรายการ</button><a class="btn" href="#/import?kind=ATTENDANCE">⇪ นำเข้าจาก Excel</a><a class="btn ghost" href="' + TEMPLATE_FILES.ATTENDANCE + '" download>↓ แม่แบบ Excel</a>' : '')) +
    '<div class="tabs"><button class="tab' + (tab === 'dash' ? ' on' : '') + '" data-t="dash">Dashboard</button><button class="tab' + (tab === 'list' ? ' on' : '') + '" data-t="list">รายการรายเดือน</button></div><div id="ab"></div>';
  $$('.tabs .tab', v).forEach(function (b) { b.onclick = function () { go('attendance', Object.assign({}, r.q, { tab: b.getAttribute('data-t'), new: '' })); }; });
  if ($('#addA')) $('#addA').onclick = function () { attForm(null, r.q.empCode); };
  if (tab === 'dash') attDash($('#ab'), r.q); else attList($('#ab'), r.q);
  if (r.q.new && can('edit')) attForm(null, r.q.empCode);
});
function fyOpts(val) { var a = []; for (var y = S.boot.fy; y >= S.boot.fy - 3; y--) a.push({ v: y, l: 'ปีงบประมาณ ' + y }); return opts(a, val); }
function attDash(host, q) {
  var f = { fy: +q.fy || S.boot.fy, ym: q.ym || '', div: q.div || '', ward: q.ward || '' };
  host.innerHTML = '<form class="filters" id="adf"><label class="fld sm"><span>ปีงบประมาณ</span><select name="fy">' + fyOpts(f.fy) + '</select></label>' +
    '<label class="fld sm"><span>เดือน</span><select name="ym">' + opts(R.fyMonths(f.fy).map(function (ym) { return { v: ym, l: R.ymThLong(ym) }; }), f.ym, 'ทั้งปีงบประมาณ') + '</select></label>' + scopeFilters(f) + '</form><div id="adb">' + skeleton(5) + '</div>';
  $$('#adf select').forEach(function (s) { s.onchange = function () { var x = formData($('#adf')); if (s.name === 'div') x.ward = ''; if (s.name === 'fy') x.ym = ''; go('attendance', Object.assign({ tab: 'dash' }, x)); }; });
  var draw = function (d) {
    var types = d.types, cell = function (o, t) { var v = o.d[t.code]; return v ? (t.unit === 'min' ? (o.n[t.code] || 0) + '<small> ครั้ง/' + num(v, 0) + '′</small>' : num(v, 1)) : '<span class="muted">·</span>'; };
    var head = '<tr><th>' + '%' + '</th><th class="r">คน</th>' + types.map(function (t) { return '<th class="r">' + esc(t.name) + '</th>'; }).join('') + '</tr>';
    var tbl = function (rows, label, link) { return rows.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead>' + head.replace('%', label) + '</thead><tbody>' + rows.map(function (x) { return '<tr' + (link ? ' data-href="' + link(x) + '" tabindex="0"' : '') + '><td>' + esc(x.code + (x.name && x.name !== x.code ? ' · ' + x.name : '')) + '</td><td class="r">' + x.persons + '</td>' + types.map(function (t) { return '<td class="r">' + cell(x, t) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : empty('ไม่มีข้อมูล'); };
    $('#adb').innerHTML = '<div class="kpis att">' + types.map(function (t) { var v = d.total[t.code] || 0; return kpi(t.name, t.unit === 'min' ? num(d.count[t.code] || 0, 0) + ' <small>ครั้ง</small>' : num(v, 1) + ' <small>วัน</small>', t.unit === 'min' ? 'รวม ' + num(v, 0) + ' นาที' : num(d.count[t.code] || 0, 0) + ' รายการ', '', 't-' + t.code); }).join('') + '</div>' +
      '<div class="grid2"><section class="card wide"><div class="card-h"><h2>แนวโน้มรายเดือน · ปีงบ ' + d.fy + '</h2></div>' +
      '<div class="legend">' + types.map(function (t) { return '<span class="lg-sq t-' + t.code + '"></span>' + esc(t.name); }).join(' ') + '</div>' + stackChart(d.trend, types) + '</section>' +
      '<section class="card wide"><div class="card-h"><h2>ต้องติดตาม</h2><span class="muted small">สาย ≥ ' + d.watchRule.late + ' ครั้ง/เดือน หรือ ขาด ≥ ' + d.watchRule.absent + ' วัน/เดือน (ปรับได้ในตั้งค่า)</span></div>' +
      (d.watch.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>บุคลากร</th><th>หอ</th><th class="r">สาย (ครั้ง)</th><th class="r">สายสูงสุด/เดือน</th><th class="r">ขาด (วัน)</th></tr></thead><tbody>' + d.watch.map(function (x) {
        return '<tr data-href="#/person/' + x.empCode + '?tab=att" tabindex="0"><td>' + esc(x.fullName) + ' <span class="muted small">' + x.empCode + '</span></td><td>' + esc(x.wardCode) + '</td><td class="r">' + (x.n.LATE || 0) + '</td><td class="r">' + x.lateMonthMax + '</td><td class="r">' + (x.d.ABSENT || 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('ไม่มีรายชื่อที่ต้องติดตาม')) + '</section>' +
      (d.byDiv.length > 1 ? '<section class="card wide"><div class="card-h"><h2>แยกตามส่วนงาน/สายงาน</h2></div>' + tbl(d.byDiv, 'ส่วนงาน', function (x) { return '#/attendance' + qs({ tab: 'dash', fy: d.fy, ym: d.ym, div: x.code }); }) + '</section>' : '') +
      '<section class="card wide"><div class="card-h"><h2>แยกตามหอ/หน่วย</h2></div>' + tbl(d.byWard, 'หอ/หน่วย', function (x) { return '#/attendance' + qs({ tab: 'dash', fy: d.fy, ym: d.ym, ward: x.code }); }) + '</section>' +
      '<section class="card wide"><div class="card-h"><h2>รายคน (' + num(d.peopleTotal, 0) + ' คนที่มีรายการ)</h2><a class="link" href="#/reports' + qs({ type: 'ATTENDANCE', fy: d.fy, ym: d.ym, div: f.div, ward: f.ward }) + '">พิมพ์ / ส่งออก ›</a></div>' +
      (d.people.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>บุคลากร</th><th>หอ</th>' + types.map(function (t) { return '<th class="r">' + esc(t.name) + '</th>'; }).join('') + '</tr></thead><tbody>' + d.people.slice(0, 100).map(function (x) {
        return '<tr data-href="#/person/' + x.empCode + '?tab=att" tabindex="0"><td>' + esc(x.fullName) + ' <span class="muted small">' + x.empCode + '</span></td><td>' + esc(x.wardCode) + '</td>' + types.map(function (t) { return '<td class="r">' + cell(x, t) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + (d.people.length > 100 ? '<p class="muted small">แสดง 100 คนแรก — ดูทั้งหมดในรายงาน</p>' : '') : empty('ยังไม่มีรายการในช่วงนี้')) + '</section></div>';
    bindHref($('#adb'));
  };
  api('getAttendanceDashboard', f, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); $('#adb').innerHTML = empty(e.message); });
}
function stackChart(trend, types) {
  var tot = trend.map(function (m) { var s = 0; types.forEach(function (t) { if (t.unit !== 'min') s += m.d[t.code] || 0; }); return s; }), max = Math.max.apply(null, tot.concat([1]));
  var lateMax = Math.max.apply(null, trend.map(function (m) { return m.d.LATE || 0; }).concat([1]));
  return '<div class="cols stack-c">' + trend.map(function (m, i) {
    return '<div class="col" style="width:' + (100 / trend.length) + '%"><span class="col-v">' + (tot[i] ? num(tot[i], 1) : '') + '</span><span class="col-stack" style="height:' + (tot[i] / max * 100).toFixed(1) + '%">' +
      types.filter(function (t) { return t.unit !== 'min'; }).map(function (t) { var v = m.d[t.code] || 0; return v ? '<span class="t-' + t.code + '" style="flex:' + v + '" title="' + attr(t.name + ' ' + v + ' วัน') + '"></span>' : ''; }).join('') + '</span>' +
      '<span class="col-l">' + R.ymTh(m.ym).split(' ')[0] + '</span><span class="late-dot" title="มาสาย ' + (m.d.LATE || 0) + ' นาที" style="opacity:' + (m.d.LATE ? 0.35 + 0.65 * m.d.LATE / lateMax : 0) + '"></span></div>';
  }).join('') + '</div><p class="legend">แท่ง = จำนวนวันขาด/ลา · จุดใต้แท่ง = ความถี่ของการมาสาย (เข้ม = มาก)</p>';
}
function attList(host, q) {
  var f = { ym: q.ym || isoToday().slice(0, 7), ward: q.ward || '', div: q.div || '', type: q.type || '', empCode: q.empCode || '' };
  host.innerHTML = '<form class="filters" id="alf"><label class="fld sm"><span>เดือน</span><input type="month" name="ym" value="' + f.ym + '" max="' + isoToday().slice(0, 7) + '"></label>' + scopeFilters(f) +
    '<label class="fld sm"><span>ประเภท</span><select name="type">' + opts(S.boot.lists.leaveTypes.map(function (t) { return { v: t.code, l: t.name }; }), f.type, 'ทั้งหมด') + '</select></label>' +
    (f.empCode ? '<span class="chip pick">รหัส ' + esc(f.empCode) + ' <a href="#/attendance?tab=list&ym=' + f.ym + '" aria-label="ล้าง">✕</a></span>' : '') + '</form><div id="alb" class="card flush">' + skeleton(5) + '</div>';
  $$('#alf select, #alf input').forEach(function (s) { s.onchange = function () { var x = formData($('#alf')); if (s.name === 'div') x.ward = ''; go('attendance', Object.assign({ tab: 'list', empCode: f.empCode }, x)); }; });
  var draw = function (d) {
    $('#alb').innerHTML = '<div class="sum-row"><span>' + R.ymThLong(d.ym) + '</span><span><b>' + d.rows.length + '</b> รายการ</span></div>' + (!d.rows.length ? empty('ยังไม่มีรายการในเดือนนี้', can('edit') ? 'กด "+ บันทึกรายการ" หรือ "นำเข้าจาก Excel"' : '') :
      '<div class="tbl-wrap"><table class="tbl rows"><thead><tr><th>วันที่</th><th>บุคลากร</th><th>ประเภท</th><th class="r">จำนวน</th><th>หมายเหตุ</th><th>ที่มา</th>' + (d.canEdit ? '<th></th>' : '') + '</tr></thead><tbody>' +
      d.rows.map(function (x) { var t = leaveType(x.type); return '<tr><td data-l="วันที่">' + td(x.date) + '</td><td data-l="บุคลากร"><a href="#/person/' + x.empCode + '?tab=att">' + esc(x.fullName) + '</a><div class="muted small">' + x.empCode + ' · ' + esc(x.wardCode) + '</div></td>' +
        '<td data-l="ประเภท"><span class="att-pill sm t-' + esc(x.type) + '">' + esc(t.name) + '</span></td><td class="r" data-l="จำนวน">' + (t.unit === 'min' ? x.minutes + ' นาที' : x.days + ' วัน') + '</td><td data-l="หมายเหตุ">' + esc(x.note) + '</td>' +
        '<td data-l="ที่มา"><span class="muted small">' + esc({ UI: 'บันทึกหน้าจอ', IMPORT: 'นำเข้าไฟล์', DEMO: 'สาธิต' }[x.src] || x.src) + '</span></td>' + (d.canEdit ? '<td class="r"><button class="btn sm ghost" data-e="' + x.id + '">แก้ไข</button></td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>');
    $$('[data-e]', $('#alb')).forEach(function (b) { b.onclick = function () { attForm(d.rows.filter(function (x) { return x.id === b.getAttribute('data-e'); })[0]); }; });
  };
  api('listAttendance', f, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); $('#alb').innerHTML = empty(e.message); });
}
function attForm(x, empCode) {
  var pick = null, types = S.boot.lists.leaveTypes;
  modal({ title: x ? 'แก้ไขรายการ · ' + x.fullName : 'บันทึกขาด / ลา / มาสาย', body: (x ? '' : '<div class="fld"><span>บุคลากร *</span><div id="apick"></div></div>') +
    '<form id="atf" class="form-grid"><label class="fld"><span>วันที่ *</span><input type="date" name="date" value="' + attr(x ? x.date : isoToday()) + '" max="' + isoToday() + '"></label>' +
    '<label class="fld"><span>ประเภท *</span><select name="type">' + opts(types.map(function (t) { return { v: t.code, l: t.name }; }), x ? x.type : 'LATE') + '</select></label>' +
    '<label class="fld" id="fDays"><span>จำนวนวัน (0.5 = ครึ่งวัน)</span><input name="days" inputmode="decimal" value="' + attr(x && x.days ? x.days : 1) + '"></label>' +
    '<label class="fld" id="fMin"><span>นาทีที่มาสาย</span><input name="minutes" inputmode="numeric" value="' + attr(x && x.minutes ? x.minutes : '') + '"></label>' +
    '<label class="fld full"><span>หมายเหตุ</span><input name="note" value="' + attr(x ? x.note : '') + '"></label></form>',
    onOpen: function (box) {
      if (!x) { pick = personPicker($('#apick', box), { edit: true, single: true }); if (empCode) api('suggestPeople', { q: empCode, edit: true }).then(function (l) { if (l[0]) pick = personPicker($('#apick', box), { edit: true, single: true, value: [l[0]] }); }); }
      var sync = function () { var t = types.filter(function (y) { return y.code === $('[name=type]', box).value; })[0] || {}; $('#fDays', box).hidden = t.unit === 'min'; $('#fMin', box).hidden = t.unit !== 'min'; };
      $('[name=type]', box).onchange = sync; sync();
    },
    actions: (x ? [{ label: 'ลบ', kind: 'danger', onClick: function (close) { return api('deleteAttendance', { id: x.id, date: x.date }).then(function () { close(); toast('ลบแล้ว'); cacheClear(); render(); }); } }] : []).concat([{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) {
      var d = formData($('#atf', box));
      if (x) { d.id = x.id; d.oldDate = x.date; d.empCode = x.empCode; } else { var s = pick.getValue(); if (!s.length) { toast('กรุณาเลือกบุคลากร', 'err'); return; } d.empCode = s[0].empCode; }
      return api('saveAttendance', d).then(function () { close(); toast('บันทึกแล้ว'); cacheClear(); go('attendance', { tab: 'list', ym: d.date.slice(0, 7) }); render(); });
    } }]) });
}

/* ================================================================ คำขอแก้ไขข้อมูล */
route('requests', function (v, r) {
  var st = r.q.status || 'PENDING';
  v.innerHTML = pageHead('คำขอแก้ไขข้อมูล', can('decide') ? 'คำขอของบุคลากรในหอที่คุณรับผิดชอบ และคำขอของคุณเอง' : 'ส่งคำขอให้หัวหน้าหออนุมัติ และติดตามสถานะ',
    S.me.hasProfile ? '<button class="btn primary" data-new="PROFILE">ขอแก้ไขข้อมูล</button><button class="btn" data-new="EDUCATION">ขอเพิ่มวุฒิการศึกษา</button><button class="btn" data-new="TRAINING">แจ้งอบรมที่ไปมา</button>' : '') +
    '<div class="tabs">' + [['PENDING', 'รออนุมัติ'], ['APPROVED', 'อนุมัติแล้ว'], ['REJECTED', 'ไม่อนุมัติ'], ['ALL', 'ทั้งหมด']].map(function (t) { return '<button class="tab' + (st === t[0] ? ' on' : '') + '" data-st="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="rq">' + skeleton(4) + '</div>';
  $$('[data-st]', v).forEach(function (b) { b.onclick = function () { go('requests', { status: b.getAttribute('data-st') }); }; });
  $$('[data-new]', v).forEach(function (b) { b.onclick = function () { requestDialog(b.getAttribute('data-new')); }; });
  if (r.q.new) requestDialog(r.q.new);
  var KIND = { PROFILE: 'แก้ไขข้อมูล', EDUCATION: 'เพิ่มวุฒิการศึกษา', TRAINING: 'แจ้งการอบรม' }, STT = { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิก' };
  api('listRequests', { status: st }).then(function (d) {
    $('#rq').innerHTML = !d.rows.length ? empty('ไม่มีคำขอ' + (st !== 'ALL' ? 'ในสถานะนี้' : '')) : d.rows.map(function (x) {
      var detail = x.kind === 'PROFILE' ? Object.keys(x.payload).map(function (k) { return '<li><span class="muted">' + esc(x.labels[k] || k) + ':</span> <s class="muted">' + esc(x.current[k] || '-') + '</s> → <b>' + esc(/Date|Exp/.test(k) ? td(x.payload[k]) : x.payload[k]) + '</b></li>'; }).join('')
        : x.kind === 'EDUCATION' ? '<li>' + esc([x.payload.degree, x.payload.major, x.payload.institute, x.payload.gradYear].filter(Boolean).join(' · ')) + '</li>'
          : '<li>' + td(x.payload.date) + ' · <b>' + esc(x.payload.name) + '</b> · ' + esc(S.boot.lists.trainTypes[x.payload.type] || '') + (x.payload.hours ? ' · ' + x.payload.hours + ' ชม.' : '') + '</li>';
      return '<article class="card req"><div class="req-h"><div><b>' + esc(KIND[x.kind]) + '</b> · <a href="#/person/' + x.empCode + '">' + esc(x.fullName) + '</a> <span class="muted small">' + x.empCode + ' · ' + esc(x.wardCode) + '</span></div><span class="chip rq-' + x.status + '">' + STT[x.status] + '</span></div>' +
        '<ul class="req-d">' + detail + '</ul>' + (x.reason ? '<p class="muted small">เหตุผล: ' + esc(x.reason) + '</p>' : '') +
        '<p class="muted small">ส่งเมื่อ ' + esc(x.at.replace('T', ' ')) + (x.decidedAt ? ' · ดำเนินการ ' + esc(x.decidedAt.replace('T', ' ')) + ' โดย ' + esc(x.decidedBy) : '') + (x.decideNote ? ' · ' + esc(x.decideNote) : '') + '</p>' +
        (x.canDecide ? '<div class="row-a"><button class="btn sm primary" data-ok="' + x.id + '">อนุมัติ</button><button class="btn sm danger" data-no="' + x.id + '">ไม่อนุมัติ</button></div>' : '') +
        (x.mine && x.status === 'PENDING' ? '<div class="row-a"><button class="btn sm ghost" data-cancel="' + x.id + '">ยกเลิกคำขอ</button></div>' : '') + '</article>';
    }).join('');
    $$('[data-ok]', v).forEach(function (b) { b.onclick = function () { api('decideRequest', { id: b.getAttribute('data-ok'), approve: true }).then(function () { toast('อนุมัติแล้ว'); S.boot.pending = Math.max(0, (S.boot.pending || 1) - 1); render(); }).catch(fail); }; });
    $$('[data-no]', v).forEach(function (b) { b.onclick = function () { modal({ title: 'ไม่อนุมัติคำขอ', body: '<label class="fld"><span>เหตุผล *</span><input id="rjn"></label>', actions: [{ label: 'ยืนยันไม่อนุมัติ', kind: 'danger', onClick: function (close, box) { return api('decideRequest', { id: b.getAttribute('data-no'), approve: false, note: $('#rjn', box).value }).then(function () { close(); toast('บันทึกแล้ว'); S.boot.pending = Math.max(0, (S.boot.pending || 1) - 1); render(); }); } }] }); }; });
    $$('[data-cancel]', v).forEach(function (b) { b.onclick = function () { api('cancelRequest', { id: b.getAttribute('data-cancel') }).then(function () { toast('ยกเลิกแล้ว'); render(); }).catch(fail); }; });
  }).catch(function (e) { fail(e); $('#rq').innerHTML = empty(e.message); });
});
function requestDialog(kind, d) {
  var L = S.boot.lists.requestLabels, body;
  if (kind === 'PROFILE') body = '<p class="muted">กรอกเฉพาะช่องที่ต้องการแก้ ระบบส่งให้หัวหน้าหออนุมัติ</p><form id="rqf" class="form-grid">' + S.boot.lists.requestFields.map(function (k) {
    var t = /Date|Exp/.test(k) ? 'date' : 'text';
    return '<label class="fld' + (k === 'wish' ? ' full' : '') + '"><span>' + esc(L[k]) + '</span><input type="' + t + '" name="' + k + '"' + (k === 'birthYear' ? ' inputmode="numeric" maxlength="4"' : '') + '></label>';
  }).join('') + '<label class="fld full"><span>เหตุผล / หลักฐานประกอบ</span><input name="_reason"></label></form>';
  else if (kind === 'EDUCATION') body = '<form id="rqf" class="form-grid">' + eduFields() + '<label class="fld full"><span>หมายเหตุ</span><input name="_reason"></label></form>';
  else body = '<form id="rqf" class="form-grid">' + trainingFields() + '<label class="fld full"><span>หมายเหตุถึงหัวหน้าหอ</span><input name="_reason"></label></form>';
  modal({ title: { PROFILE: 'ขอแก้ไขข้อมูล', EDUCATION: 'ขอเพิ่มวุฒิการศึกษา', TRAINING: 'แจ้งการอบรมที่ไปมา' }[kind], wide: kind !== 'EDUCATION', body: body,
    actions: [{ label: 'ส่งคำขอ', kind: 'primary', onClick: function (close, box) {
      var x = formData($('#rqf', box)), reason = x._reason; delete x._reason;
      if (kind === 'PROFILE') Object.keys(x).forEach(function (k) { if (x[k] === '') delete x[k]; });
      return api('createRequest', { kind: kind, payload: x, reason: reason }).then(function () { close(); toast('ส่งคำขอแล้ว รอหัวหน้าหออนุมัติ'); go('requests'); });
    } }] });
}
