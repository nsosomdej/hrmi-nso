/**
 * pages-home.js — หน้าแรก: Dashboard ตามขอบเขตสิทธิ์ (ทั้งฝ่าย/ส่วนงาน/หอ) หรือสรุปของตนเอง (บุคลากร)
 */
route('home', function (v, r) {
  var f = { div: r.q.div || '', ward: r.q.ward || '' };
  var payload = f.div || f.ward ? f : {};
  var draw = function (d) { if (d.self) drawSelfHome(v, d); else drawStaffHome(v, d, f); };
  api('getDashboard', payload, { fresh: true, onCache: draw }).then(draw).catch(function (e) { fail(e); v.innerHTML = empty('โหลดหน้าแรกไม่สำเร็จ', esc(e.message)); });
});

function kpi(label, value, sub, href, cls, icon) {
  return '<' + (href ? 'a href="' + attr(href) + '"' : 'div') + ' class="kpi' + (cls ? ' ' + cls : '') + '">' + (icon ? '<span class="kpi-ic">' + ic(icon) + '</span>' : '') + '<span class="kpi-l">' + esc(label) + '</span><span class="kpi-v">' + value + '</span>' + (sub ? '<span class="kpi-s">' + sub + '</span>' : '') + '</' + (href ? 'a' : 'div') + '>';
}
function attTypeSummary(total, count, types) {
  return types.map(function (t) {
    var v = total[t.code]; if (!v) return '';
    return '<span class="att-pill t-' + esc(t.code) + '"><b>' + esc(t.name) + '</b> ' + (t.unit === 'min' ? num(count[t.code] || 0, 0) + ' ครั้ง · ' + num(v, 0) + ' นาที' : num(v, 1) + ' วัน') + '</span>';
  }).join('') || '<span class="muted">ยังไม่มีรายการ</span>';
}

function drawStaffHome(v, d, f) {
  var scopeTxt = d.scope.all ? 'ทั้งฝ่ายการพยาบาล' : (S.boot.viewWards || []).length + ' หอ/หน่วยที่คุณดูแล';
  if (f.ward) scopeTxt = 'หอ ' + f.ward + ' ' + ward(f.ward); else if (f.div) scopeTxt = divName(f.div);
  var st = d.steps, ppl = d.people, att = d.attendance, tr = d.training, comp = d.competency;
  var stepMax = Math.max.apply(null, st.rows.map(function (x) { return x.n; }).concat([1]));
  var html = pageHead('ภาพรวม', esc(scopeTxt) + ' · ข้อมูล ณ ' + td(S.boot.today),
    '<form class="filters inline" id="homeF">' + scopeFilters(f) + '</form>') +
    (ppl.active + ppl.leave + ppl.inactive === 0 && !f.div && !f.ward ? onboardHtml() : '') +
    '<div class="kpis">' +
    kpi('บุคลากรปฏิบัติงาน', num(ppl.active, 0), 'ลาศึกษา/ลายาว ' + num(ppl.leave, 0) + ' · พ้นสภาพ ' + num(ppl.inactive, 0), '#/people' + qs(f), '', 'users') +
    kpi('ได้รับขั้นเกินเกณฑ์ ★', '<span class="star">★</span> ' + num(st.star, 0), 'จากพยาบาลวิชาชีพ ' + num(st.eligible, 0) + ' คน', '#/people' + qs(Object.assign({ alert: 1 }, f)), st.star ? 'alert' : '', 'star') +
    kpi('ยังไม่ระบุขั้นการทำงาน', num(st.noStep, 0), 'ข้อสังเกต Level–ขั้น ' + num(st.mismatch, 0) + ' คน', '#/people' + qs(Object.assign({ noStep: 1 }, f)), st.noStep ? 'warn' : '', 'layers') +
    kpi('อบรมปีงบ ' + tr.fy, num(tr.records, 0) + ' <small>รายการ</small>', num(tr.persons, 0) + ' คน · ' + num(tr.hours, 1) + ' ชั่วโมง', '#/training' + qs(f), '', 'book') +
    kpi('ใบประกอบฯ ใกล้หมดอายุ', num(d.license, 0), 'ภายใน ' + S.boot.settings.LICENSE_WARN_DAYS + ' วัน', '#/people' + qs(Object.assign({ license: 1 }, f)), d.license ? 'warn' : '', 'id') +
    (S.boot.can.decide ? kpi('คำขอรออนุมัติ', num(d.pending, 0), 'จากบุคลากร', '#/requests', d.pending ? 'warn' : '', 'inbox') : '') +
    '</div>' +
    '<div class="grid2">' +
    '<section class="card"><div class="card-h"><h2>ขั้นการทำงาน C3–C9</h2><a class="link" href="#/reports?type=STEP">พิมพ์รายงาน ›</a></div>' +
    '<div class="steps">' + st.rows.map(function (x) {
      return '<a class="step-col" href="#/people' + qs(Object.assign({ step: x.step }, f)) + '"><span class="step-n">' + num(x.n, 0) + '</span><span class="step-b"><span style="height:' + (x.n / stepMax * 100).toFixed(1) + '%"></span>' +
        (x.star ? '<span class="step-star" style="height:' + (x.star / stepMax * 100).toFixed(1) + '%"></span>' : '') + '</span><span class="step-l">' + x.step + '</span><span class="step-s">' + (x.star ? '★ ' + x.star : '&nbsp;') + '</span></a>';
    }).join('') + '</div><p class="legend"><span class="lg-dot a"></span>ทั้งหมด <span class="lg-dot b"></span>★ ได้รับขั้นเกินเกณฑ์ (ปรับเกณฑ์ได้ในตั้งค่า)</p></section>' +
    '<section class="card"><div class="card-h"><h2>รายชื่อที่ควรติดตาม ★</h2><a class="link" href="#/people' + qs(Object.assign({ alert: 1 }, f)) + '">ดูทั้งหมด ›</a></div>' +
    (st.starList.length ? '<table class="tbl compact"><thead><tr><th>ชื่อ-สกุล</th><th>หอ</th><th>ขั้น</th><th class="r">ระยะเวลา</th></tr></thead><tbody>' + st.starList.map(function (x) {
      return '<tr data-href="#/person/' + x.empCode + '" tabindex="0"><td>' + esc(x.fullName) + '<div class="muted small">' + x.empCode + '</div></td><td>' + esc(x.wardCode) + '</td><td><b>' + x.stepCode + '</b> <span class="muted">' + x.stepYear + '</span></td><td class="r">' + x.stepYears + ' ปี <span class="star">★</span></td></tr>';
    }).join('') + '</tbody></table>' : empty('ไม่มีรายชื่อ ★ ในขอบเขตนี้')) + '</section>' +
    '<section class="card"><div class="card-h"><h2>ระดับประสบการณ์</h2></div>' + barList(ppl.byLevel.map(function (x) { return { label: (x.level ? 'Level ' + x.level + ' · ' : '') + x.name, n: x.n, href: x.level ? '#/people' + qs(Object.assign({ level: x.level }, f)) : '' }; })) + '</section>' +
    '<section class="card"><div class="card-h"><h2>ตำแหน่ง</h2></div>' + barList(ppl.byPosition.map(function (x) { return { label: x.name, n: x.n, href: '#/people' + qs(Object.assign({ position: x.code }, f)) }; })) + '</section>' +
    '<section class="card wide"><div class="card-h"><h2>ขาด ลา มาสาย · ปีงบประมาณ ' + att.fy + '</h2><a class="link" href="#/attendance' + qs(f) + '">ดูรายละเอียด ›</a></div>' +
    '<p class="att-sum">' + attTypeSummary(att.total, att.count, att.types) + '</p>' +
    '<p class="muted small">เดือนนี้: ' + attTypeSummary(att.month, att.monthCount, att.types).replace(/att-pill/g, 'att-pill sm') + (att.watch ? ' · <a href="#/attendance' + qs(f) + '">ต้องติดตาม ' + att.watch + ' คน</a>' : '') + '</p>' +
    colChart(att.trend.map(function (m) { var s = 0; Object.keys(m.d).forEach(function (k) { if (k !== 'LATE') s += m.d[k]; }); return { label: R.ymTh(m.ym).split(' ')[0], n: s }; }), { label: 'จำนวนวันขาด/ลารายเดือน', dec: 1 }) +
    '<p class="legend">จำนวนวันขาดและลารวมรายเดือน (ไม่รวมมาสาย)</p></section>' +
    '<section class="card"><div class="card-h"><h2>การอบรม ปีงบ ' + tr.fy + '</h2></div>' +
    colChart(tr.byMonth.map(function (m) { return { label: R.ymTh(m.ym).split(' ')[0], n: m.n }; }), { label: 'จำนวนรายการอบรมรายเดือน' }) +
    '<p class="legend">Onsite ' + num(tr.byType.ONSITE || 0, 0) + ' · On Zoom ' + num(tr.byType.ZOOM || 0, 0) + ' รายการ</p></section>' +
    '<section class="card"><div class="card-h"><h2>Competency' + (comp.round ? ' รอบ ' + comp.round : '') + '</h2><a class="link" href="#/reports?type=COMPETENCY">รายงาน ›</a></div>' +
    (comp.round ? comp.cats.map(function (x) {
      var t = x.n || 1;
      return '<div class="comp"><div class="comp-h"><b>' + x.cat + '</b><span>เฉลี่ย <b>' + (x.avg == null ? '-' : num(x.avg, 1)) + '</b> · ' + num(x.n, 0) + ' คน</span></div>' +
        '<div class="stack"><span class="s-low" style="width:' + (x.low / t * 100) + '%"></span><span class="s-mid" style="width:' + (x.mid / t * 100) + '%"></span><span class="s-high" style="width:' + (x.high / t * 100) + '%"></span></div>' +
        '<div class="muted small">ต่ำกว่าเกณฑ์ ' + x.low + ' · เท่าเกณฑ์ ' + x.mid + ' · สูงกว่าเกณฑ์ ' + x.high + '</div></div>';
    }).join('') + '<p class="legend"><span class="lg-dot low"></span>&lt; ' + comp.bands.red + ' <span class="lg-dot mid"></span>' + comp.bands.red + '–' + comp.bands.yellow + ' <span class="lg-dot high"></span>&gt; ' + comp.bands.yellow + '</p>'
      : empty('ยังไม่มีข้อมูล Competency', 'นำเข้าได้ที่เมนู นำเข้าข้อมูล')) + '</section>' +
    (ppl.byDiv.length > 1 ? '<section class="card wide"><div class="card-h"><h2>แยกตามส่วนงาน</h2></div>' + barList(ppl.byDiv.map(function (x) { return { label: x.name, n: x.n, extra: x.star ? '<span class="star">★' + x.star + '</span>' : '', href: '#/home?div=' + encodeURIComponent(x.code) }; })) + '</section>' : '') +
    (!f.ward && ppl.byWard.length > 1 && ppl.byWard.length <= 30 ? '<section class="card wide"><div class="card-h"><h2>แยกตามหอ/หน่วย</h2></div>' + barList(ppl.byWard.map(function (x) { return { label: x.code + ' · ' + x.name, n: x.n, href: '#/home?ward=' + encodeURIComponent(x.code) }; })) + '</section>' : '') +
    '</div>';
  v.innerHTML = html; bindHref(v);
  $$('#homeF select').forEach(function (s) { s.onchange = function () { var x = formData($('#homeF')); if (s.name === 'div') x.ward = ''; go('home', x); }; });
}

function drawSelfHome(v, d) {
  if (!d.p) { v.innerHTML = pageHead('สวัสดีครับ', '') + empty('ยังไม่พบทะเบียนบุคลากรของคุณ', 'กรุณาติดต่อหัวหน้าหอหรือสำนักงานฝ่ายการพยาบาล'); return; }
  var p = d.p, a = d.attendance, tr = d.training;
  v.innerHTML = pageHead('สวัสดี ' + p.firstName, esc(p.positionName + ' · ' + p.wardCode + ' ' + p.wardName)) +
    '<div class="kpis">' +
    kpi('อายุงาน รพ.', esc(p.serviceText), 'ระดับประสบการณ์ ' + esc(p.levelName)) +
    (p.stepEligible ? kpi('ขั้นการทำงานปัจจุบัน', p.stepCode ? esc(p.stepCode) + ' ' + starHtml(p) : '-', p.stepCode ? 'ได้เมื่อ ' + p.stepYear + ' · ' + p.stepYears + ' ปี' : 'ยังไม่ระบุ — แจ้งหัวหน้าหอ', '', p.stepAlert ? 'alert' : '') : '') +
    kpi('อบรมปีงบ ' + tr.fy, num(tr.records, 0) + ' <small>รายการ</small>', num(tr.hours, 1) + ' ชั่วโมง', '#/me?tab=training') +
    kpi('คำขอรออนุมัติ', num(d.requests, 0), 'ดูสถานะที่เมนู คำขอแก้ไข', '#/requests') +
    '</div>' +
    '<div class="grid2"><section class="card wide"><div class="card-h"><h2>ขาด ลา มาสายของฉัน · ปีงบ ' + a.fy + '</h2></div><p class="att-sum">' + attTypeSummary(a.total, a.count, a.types) + '</p></section>' +
    '<section class="card"><div class="card-h"><h2>การอบรมล่าสุด</h2><a class="link" href="#/me?tab=training">ทั้งหมด ›</a></div>' +
    (tr.recent.length ? '<ul class="list">' + tr.recent.map(function (r) { return '<li><b>' + esc(r.name) + '</b><span class="muted small">' + td(r.date) + ' · ' + esc(S.boot.lists.trainTypes[r.type] || r.type) + (r.hours ? ' · ' + r.hours + ' ชม.' : '') + '</span></li>'; }).join('') + '</ul>' : empty('ยังไม่มีประวัติอบรม')) +
    '<a class="btn sm" href="#/requests?new=TRAINING">แจ้งอบรมที่ไปมา</a></section>' +
    '<section class="card"><div class="card-h"><h2>Competency ล่าสุด</h2></div>' +
    (d.competency.length ? '<div class="comp-me">' + S.boot.lists.compCats.map(function (cat) { var x = d.competency[0].data[cat]; return '<div><span class="muted">' + cat + '</span><b>' + (x ? num(x.avg, 1) : '-') + '</b></div>'; }).join('') + '</div><p class="muted small">รอบประเมิน ' + d.competency[0].round + '</p>' : empty('ยังไม่มีข้อมูล')) +
    '</section></div>';
}

/** ขั้นตอนเริ่มต้นใช้งาน — แสดงเมื่อทะเบียนยังว่าง */
function onboardHtml() {
  var office = can('office'), api = can('smartapi');
  var stp = function (n, t, d, btn) { return '<li class="onb-step"><span class="onb-n">' + n + '</span><div><b>' + t + '</b><p class="muted small">' + d + '</p>' + (btn || '') + '</div></li>'; };
  return '<section class="card onb"><div class="card-h"><h2>' + ic('zap') + ' เริ่มต้นใช้งาน — ทะเบียนบุคลากรยังว่าง</h2></div>' +
    (office ? '<ol class="onb-steps">' +
      stp(1, 'นำเข้ารายชื่อบุคลากร', 'ไปที่ นำเข้าข้อมูล › ทะเบียนบุคลากร แล้วเลือกไฟล์รายชื่อ (เช่น ไฟล์รหัสพนักงานตั้งต้น 1,031 คน) — ระบบตรวจทุกแถวก่อนบันทึก', '<a class="btn primary sm" href="#/import?kind=PERSON">' + ic('upload') + ' ไปหน้านำเข้า</a>') +
      stp(2, 'ดึงข้อมูลจากระบบ HR', api ? 'เติมชื่อ ตำแหน่ง หน่วยงาน วันเริ่มงานจาก SmartAPI ให้ทุกคน (มีแถบความคืบหน้า)' : 'ยังไม่ได้เปิดใช้ SmartAPI — เปิดที่ ตั้งค่าระบบ › ค่าระบบ', api ? '<button class="btn sm" type="button" onclick="hrSyncAll()">' + ic('cloud') + ' ดึงข้อมูลจาก HR</button>' : '<a class="btn sm" href="#/admin?tab=settings">' + ic('settings') + ' ตั้งค่า</a>') +
      stp(3, 'กำหนดสิทธิ์ผู้ใช้', 'กำหนดหัวหน้าหอ ผู้บันทึกข้อมูล และผู้ตรวจการ — บุคลากรทุกคนเข้าระบบด้วยรหัสพนักงานได้ทันที (รหัสผ่านแรก = รหัสพนักงาน)', '<a class="btn sm" href="#/admin?tab=users">' + ic('users') + ' ผู้ใช้และสิทธิ์</a>') + '</ol>'
      : '<p class="muted">ยังไม่มีรายชื่อบุคลากรในขอบเขตของคุณ — สำนักงานฝ่ายการพยาบาลกำลังนำเข้าข้อมูล หรือเพิ่มรายบุคคลได้ที่เมนู ทะเบียนบุคลากร</p>') + '</section>';
}
