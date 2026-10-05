/**
 * pages-admin.js — นำเข้าข้อมูล (Upload → Preview → Validate → Confirm → Import) · ตั้งค่าระบบ (ผู้ใช้ Master ค่าระบบ Audit Log สำรองข้อมูล)
 */
/** อ่านไฟล์ → หาแถวหัวคอลัมน์ (แถวที่มีคำว่า "รหัสพนักงาน") → {header, data} — ใช้ xlsx-read.js (ไม่พึ่ง CDN) */
function readSheet(file) {
  return XlsxRead.read(file).then(function (wb) {
    var name = wb.order.filter(function (n) { return /ข้อมูล|data/i.test(n); })[0] || wb.order[0], rows = wb.sheets[name] || [], hi = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) if ((rows[i] || []).some(function (c) { return /รหัสพนักงาน|^รหัส$/.test(String(c).replace(/\*/g, '').trim()); })) { hi = i; break; }
    if (hi < 0) throw new Error('ไม่พบแถวหัวคอลัมน์ "รหัสพนักงาน" ในชีท ' + name + ' — กรุณาใช้ไฟล์แม่แบบ');
    var head = rows[hi].map(function (h) { return String(h).trim(); });
    var data = rows.slice(hi + 1).filter(function (r) { return r && r.some(function (c) { return String(c).trim() !== ''; }); });
    // ข้ามแถวตัวอย่างของแม่แบบ (รหัส 9900999)
    data = data.filter(function (r) { return String(r[0]).trim() !== '9900999'; });
    return { header: head, data: data, sheet: name };
  });
}

route('import', function (v, r) {
  if (!can('edit')) { go('home'); return; }
  var kinds = S.boot.lists.importKinds, kind = r.q.kind || 'ATTENDANCE';
  var desc = { PERSON: 'รหัสพนักงาน 7 หลัก (+หอ/ตำแหน่ง ถ้า HR ไม่มี) ' + (can('smartapi') ? '· ระบบดึงชื่อ/ตำแหน่ง/วันเริ่มงานจาก SmartAPI ให้' : '· ใส่ชื่อ-สกุลมาด้วย (ยังไม่เปิด SmartAPI)'),
    EXTRA: 'หัวหน้าหอกรอกข้อมูลที่ HR ไม่มี: วันเริ่มวิชาชีพ ขั้น C ปีที่ได้ ใบประกอบฯ วุฒิ', TRAINING: 'ประวัติการอบรม หลายคน หลายหลักสูตรในไฟล์เดียว',
    COMPETENCY: 'ค่าเฉลี่ย CFC/SFC/SONE รายคน (สำนักงานฝ่ายเท่านั้น)', ATTENDANCE: 'ขาด ลา มาสาย รายเดือน · แต่ละหน่วยกรอกแล้วส่งเข้า' };
  v.innerHTML = pageHead('นำเข้าข้อมูล', 'อัปโหลด → ตรวจทุกแถว → แก้ไข/ยืนยัน → นำเข้า · ทุกครั้งบันทึก Audit Log') +
    '<div class="imp-kinds">' + Object.keys(kinds).filter(function (k) { return k !== 'COMPETENCY' || can('office'); }).map(function (k, i) {
      return '<a class="imp-k' + (k === kind ? ' on' : '') + '" href="#/import?kind=' + k + '"><b>' + (i + 1) + '. ' + esc(kinds[k].name) + '</b><span class="muted small">' + esc(desc[k]) + '</span></a>';
    }).join('') + '</div>' +
    '<section class="card"><div class="card-h"><h2>' + esc(kinds[kind].name) + '</h2><a class="btn sm" href="' + TEMPLATE_FILES[kind] + '" download>↓ ดาวน์โหลดไฟล์แม่แบบ</a></div>' +
    '<p class="muted small">คอลัมน์: ' + kinds[kind].cols.map(function (c) { return esc(c.label) + (c.req ? ' <b class="err-t">*</b>' : ''); }).join(' · ') + '<br>วันที่ใช้รูปแบบ วว/ดด/ปปปป (พ.ศ.) เช่น 05/10/2569 · ปีใช้ พ.ศ. · ระบบไม่รับเลขบัตรประชาชน</p>' +
    '<form id="imf" class="filters">' +
    (kind === 'ATTENDANCE' ? '<label class="fld sm"><span>เดือนของข้อมูล *</span><input type="month" name="ym" value="' + isoToday().slice(0, 7) + '" max="' + isoToday().slice(0, 7) + '"></label>' +
      '<label class="fld"><span>วิธีนำเข้า</span><select name="mode"><option value="add">เพิ่ม/แทนเฉพาะรายการซ้ำ (แนะนำ)</option><option value="replace">แทนที่ทั้งเดือนของหอที่อยู่ในไฟล์</option></select></label>' : '') +
    (kind === 'COMPETENCY' ? '<label class="fld"><span>วิธีนำเข้า</span><select name="mode"><option value="merge">รวมกับข้อมูลรอบเดิม</option><option value="replace">แทนที่ทั้งรอบ</option></select></label>' : '') +
    '<label class="fld grow"><span>ไฟล์ (.xlsx หรือ .csv)</span><input type="file" name="file" accept=".xlsx,.xls,.csv"></label></form><div id="imr"></div></section>' +
    '<section class="card"><div class="card-h"><h2>ประวัติการนำเข้าล่าสุด</h2></div><div id="imh" class="muted small">ดูได้ที่ ตั้งค่าระบบ › ระบบ</div></section>';
  var parsed = null, fileName = '';
  $('#imf [name=file]').onchange = function () {
    var file = this.files[0]; if (!file) return; fileName = file.name;
    $('#imr').innerHTML = skeleton(3);
    readSheet(file).then(function (x) { parsed = x; return preview(); }).catch(function (e) { fail(e); $('#imr').innerHTML = '<div class="alert">' + esc(e.message) + '</div>'; });
  };
  var extra = function () { var x = formData($('#imf')); delete x.file; return x; };
  var preview = function () {
    return api('previewImport', Object.assign({ kind: kind, header: parsed.header, data: parsed.data, file: fileName }, extra())).then(function (p) {
      $('#imr').innerHTML = '<div class="imp-sum"><div class="kpi"><span class="kpi-l">แถวในไฟล์</span><span class="kpi-v">' + p.total + '</span></div><div class="kpi ok"><span class="kpi-l">ผ่านการตรวจ</span><span class="kpi-v">' + p.okCount + '</span></div>' +
        '<div class="kpi ' + (p.errorCount ? 'alert' : '') + '"><span class="kpi-l">ผิดพลาด</span><span class="kpi-v">' + p.errorCount + '</span></div>' + (kind === 'PERSON' ? '<div class="kpi"><span class="kpi-l">บุคลากรใหม่</span><span class="kpi-v">' + p.news + '</span></div>' : '') + '</div>' +
        (p.warns.length ? '<div class="alert warn">' + p.warns.map(function (w) { return esc(w.msg); }).join('<br>') + '</div>' : '') +
        (p.errorCount ? '<h3>แถวที่ต้องแก้ไข</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>แถวที่</th><th>รหัส</th><th>ปัญหา</th></tr></thead><tbody>' + p.errors.map(function (e) { return '<tr><td>' + e.row + '</td><td class="mono">' + esc(e.empCode) + '</td><td class="err-t">' + esc(e.msg) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
        (p.sample.length ? '<h3>ตัวอย่างข้อมูลที่จะนำเข้า</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr>' + Object.keys(p.sample[0]).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          p.sample.map(function (s) { return '<tr>' + Object.keys(p.sample[0]).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return '<td>' + esc(s[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '') +
        '<div class="row-a">' + (p.errorCount && p.okCount ? '<label class="tog"><input type="checkbox" id="skipE"><span>นำเข้าเฉพาะ ' + p.okCount + ' แถวที่ถูกต้อง</span></label>' : '') +
        '<span class="sp"></span><button class="btn" id="reChk">ตรวจอีกครั้ง</button><button class="btn primary" id="doImp"' + (p.okCount ? '' : ' disabled') + '>ยืนยันนำเข้า</button></div>';
      $('#reChk').onclick = function () { preview().catch(fail); };
      $('#doImp').onclick = function () {
        var skip = $('#skipE') && $('#skipE').checked;
        if (p.errorCount && !skip) { toast('ยังมีแถวผิดพลาด — แก้ไฟล์ หรือเลือก "นำเข้าเฉพาะแถวที่ถูกต้อง"', 'err'); return; }
        askPassword('ยืนยันการนำเข้า', 'นำเข้า ' + p.okCount + ' แถว จากไฟล์ ' + fileName).then(function (pw) {
          return api('commitImport', Object.assign({ kind: kind, header: parsed.header, data: parsed.data, file: fileName, password: pw, skipErrors: skip }, extra())).then(function (res) {
            cacheClear(); toast('นำเข้าแล้ว ' + res.imported + ' รายการ' + (res.skipped ? ' · ข้าม ' + res.skipped + ' แถว' : ''));
            $('#imr').innerHTML = '<div class="alert ok">นำเข้าเรียบร้อย ' + res.imported + ' รายการ' + (res.skipped ? ' · ข้ามแถวผิดพลาด ' + res.skipped + ' แถว' : '') + '</div>';
          });
        }).catch(fail);
      };
    });
  };
});

/* ================================================================ ตั้งค่าระบบ */
route('admin', function (v, r) {
  if (!can('office')) { go('home'); return; }
  var tab = r.q.tab || 'users', T = [['users', 'ผู้ใช้และสิทธิ์'], ['masters', 'หอ / ส่วนงาน / ตำแหน่ง'], ['settings', 'ค่าระบบ'], ['audit', 'Audit Log'], ['system', 'ระบบและสำรองข้อมูล']];
  v.innerHTML = pageHead('ตั้งค่าระบบ', 'สำหรับสำนักงานฝ่ายการพยาบาลและผู้ดูแลระบบ') + '<div class="tabs">' + T.map(function (t) { return '<a class="tab' + (t[0] === tab ? ' on' : '') + '" href="#/admin?tab=' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div><div id="adm" class="card">' + skeleton(4) + '</div>';
  ({ users: admUsers, masters: admMasters, settings: admSettings, audit: admAudit, system: admSystem })[tab]($('#adm'), r.q);
});
function roleChips(roles) { return roles.map(function (k) { return '<span class="chip role-' + k + '">' + esc(S.boot.lists.roles[k]) + '</span>'; }).join(' '); }
function admUsers(host, q) {
  api('listUsers', { q: q.q || '', role: q.role || '' }).then(function (d) {
    host.innerHTML = '<div class="row-a"><form class="filters inline" id="uf"><label class="fld"><span>ค้นหา</span><input type="search" name="q" value="' + attr(q.q || '') + '"></label><label class="fld sm"><span>บทบาท</span><select name="role">' +
      opts(Object.keys(S.boot.lists.roles).filter(function (k) { return k !== 'USER'; }).map(function (k) { return { v: k, l: S.boot.lists.roles[k] + ' (' + (d.counts[k] || 0) + ')' }; }), q.role || '', 'ทุกบทบาท') + '</select></label></form><span class="sp"></span>' +
      '<button class="btn primary" id="uAdd">+ กำหนดสิทธิ์ให้บุคลากร</button></div>' +
      '<p class="muted small">บุคลากรทุกคนเข้าระบบได้ในฐานะ "บุคลากร" อัตโนมัติ (รหัสผ่านแรกเข้า = รหัสพนักงาน) · ตารางนี้แสดงเฉพาะผู้ที่มีบทบาทเพิ่ม · บัญชีทั้งหมด ' + d.totalAccounts + ' บัญชี</p>' +
      (d.rows.length ? '<div class="tbl-wrap"><table class="tbl rows"><thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>บทบาท</th><th>ขอบเขต</th><th>เข้าล่าสุด</th><th></th></tr></thead><tbody>' + d.rows.map(function (u) {
        return '<tr class="' + (u.active ? '' : 'off') + '"><td class="mono" data-l="รหัส">' + u.empCode + '</td><td data-l="ชื่อ">' + esc(u.fullName) + '<div class="muted small">' + esc(u.wardCode) + '</div></td><td data-l="บทบาท">' + roleChips(u.roles) + (u.active ? '' : ' <span class="chip st-INACTIVE">ปิดบัญชี</span>') + '</td>' +
          '<td data-l="ขอบเขต" class="small">' + (u.wards.length ? 'หอ ' + esc(u.wards.join(', ')) : '') + (u.divs.length ? ' ส่วนงาน ' + esc(u.divs.join(', ')) : '') + '</td><td data-l="เข้าล่าสุด" class="small">' + esc((u.lastLogin || '-').replace('T', ' ')) + '</td>' +
          '<td class="r"><button class="btn sm ghost" data-u="' + u.empCode + '">แก้ไข</button></td></tr>';
      }).join('') + '</tbody></table></div>' : empty('ไม่พบผู้ใช้'));
    $$('#uf select').forEach(function (s) { s.onchange = function () { go('admin', Object.assign({ tab: 'users' }, formData($('#uf')))); }; });
    $('#uf [name=q]').addEventListener('input', debounce(function () { go('admin', Object.assign({ tab: 'users' }, formData($('#uf')))); }, 500));
    $('#uAdd').onclick = function () { userForm(null); };
    $$('[data-u]', host).forEach(function (b) { b.onclick = function () { userForm(d.rows.filter(function (u) { return u.empCode === b.getAttribute('data-u'); })[0]); }; });
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
function userForm(u) {
  var pick = null, roles = Object.keys(S.boot.lists.roles).filter(function (k) { return k !== 'USER' && (k !== 'SYSTEM_ADMIN' || can('admin')); });
  var wardChecks = function (sel) { return '<div class="checks">' + S.boot.wards.map(function (w) { return '<label><input type="checkbox" name="wards" data-multi value="' + attr(w.code) + '"' + (sel.indexOf(w.code) >= 0 ? ' checked' : '') + '>' + esc(w.code) + '</label>'; }).join('') + '</div>'; };
  modal({ title: u ? 'สิทธิ์ของ ' + u.fullName : 'กำหนดสิทธิ์ให้บุคลากร', wide: true,
    body: (u ? '<p>รหัส <b class="mono">' + u.empCode + '</b> · ' + esc(u.fullName) + '</p>' : '<div class="fld"><span>บุคลากร *</span><div id="upp"></div></div>') + '<form id="usf">' +
      '<div class="fld"><span>บทบาท</span><div class="checks">' + roles.map(function (k) { return '<label><input type="checkbox" name="roles" data-multi value="' + k + '"' + (u && u.roles.indexOf(k) >= 0 ? ' checked' : '') + '>' + esc(S.boot.lists.roles[k]) + '</label>'; }).join('') + '</div></div>' +
      '<div class="fld"><span>หอที่รับผิดชอบ (สำหรับหัวหน้าหอ/ผู้บันทึก — ว่าง = หอของตนเอง)</span>' + wardChecks(u ? u.wards : []) + '</div>' +
      '<div class="fld"><span>ส่วนงานที่มอบหมาย (สำหรับผู้ตรวจการ)</span><div class="checks">' + S.boot.divisions.map(function (dv) { return '<label><input type="checkbox" name="divs" data-multi value="' + attr(dv.code) + '"' + (u && u.divs.indexOf(dv.code) >= 0 ? ' checked' : '') + '>' + esc(dv.code) + '</label>'; }).join('') + '</div></div>' +
      '<label class="tog"><input type="checkbox" name="active"' + (!u || u.active ? ' checked' : '') + '><span>เปิดใช้งานบัญชี</span></label><label class="fld"><span>หมายเหตุ</span><input name="note" value="' + attr(u ? u.note : '') + '"></label></form>',
    onOpen: function (box) { if (!u) pick = personPicker($('#upp', box), { single: true }); },
    actions: (u ? [{ label: 'รีเซ็ตรหัสผ่าน', onClick: function (close) { close(); askPassword('รีเซ็ตรหัสผ่านของ ' + u.empCode, 'รหัสผ่านจะกลับเป็นรหัสพนักงาน และบังคับเปลี่ยนเมื่อเข้าครั้งถัดไป').then(function (pw) { return api('resetPassword', { empCode: u.empCode, password: pw }); }).then(function () { toast('รีเซ็ตรหัสผ่านแล้ว'); }).catch(fail); } }] : [])
      .concat([{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) {
        var x = formData($('#usf', box)); x.empCode = u ? u.empCode : (pick.getValue()[0] || {}).empCode;
        if (!x.empCode) { toast('กรุณาเลือกบุคลากร', 'err'); return; }
        return api('saveUser', x).then(function () { close(); toast('บันทึกสิทธิ์แล้ว'); render(); });
      } }]) });
}
function admMasters(host) {
  api('getMasters', {}).then(function (m) {
    var sec = function (title, table, cols, rows, keyCol) {
      return '<section class="msec"><div class="card-h"><h3>' + esc(title) + ' <span class="muted small">(' + rows.length + ')</span></h3><button class="btn sm" data-add="' + table + '">+ เพิ่ม</button></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr class="' + (r.active === 'FALSE' ? 'off' : '') + '">' + cols.map(function (c) { var v = r[c[0]]; return '<td>' + esc(c[0] === 'stepEligible' || c[0] === 'active' ? (v === 'TRUE' ? '✓' : '–') : v) + (c[0] === keyCol && m.used[(table === 'Positions' ? 'P:' : '') + v] ? ' <span class="muted small">(' + m.used[(table === 'Positions' ? 'P:' : '') + v] + ' คน)</span>' : '') + '</td>'; }).join('') +
          '<td class="r"><button class="btn sm ghost" data-ed="' + table + '|' + attr(r[keyCol]) + '">แก้ไข</button></td></tr>'; }).join('') + '</tbody></table></div></section>';
    };
    var DEF = { Divisions: [['code', 'รหัส'], ['name', 'ชื่อส่วนงาน/สายงาน'], ['order', 'ลำดับ'], ['active', 'ใช้งาน']], Wards: [['code', 'รหัสหอ'], ['name', 'ชื่อหอ/หน่วย'], ['divCode', 'ส่วนงาน'], ['order', 'ลำดับ'], ['active', 'ใช้งาน']],
      Positions: [['code', 'รหัส'], ['name', 'ชื่อตำแหน่ง'], ['group', 'กลุ่ม'], ['stepEligible', 'ใช้ขั้น C3–C9'], ['order', 'ลำดับ'], ['active', 'ใช้งาน']], WardAlias: [['alias', 'ชื่อเรียกจากไฟล์/HR'], ['wardCode', 'รหัสหอ']], PosAlias: [['alias', 'ชื่อตำแหน่งจากไฟล์/HR'], ['positionCode', 'รหัสตำแหน่ง']] };
    var KEY = { Divisions: 'code', Wards: 'code', Positions: 'code', WardAlias: 'alias', PosAlias: 'alias' };
    host.innerHTML = '<p class="muted small">แก้ที่นี่ที่เดียว ใช้ทั้งระบบ (ไม่ hard-code) · หอ/ตำแหน่งที่มีบุคลากรอยู่ ให้ "ปิดใช้งาน" แทนการลบ · ชื่อเรียกอื่นใช้เทียบหน่วยงาน/ตำแหน่งจาก SmartAPI และไฟล์นำเข้า</p>' +
      sec('ส่วนงาน / สายงาน', 'Divisions', DEF.Divisions, m.Divisions, 'code') + sec('หอผู้ป่วย / หน่วยงาน', 'Wards', DEF.Wards, m.Wards, 'code') + sec('ตำแหน่ง', 'Positions', DEF.Positions, m.Positions, 'code') +
      sec('ชื่อเรียกอื่นของหอ', 'WardAlias', DEF.WardAlias, m.WardAlias, 'alias') + sec('ชื่อเรียกอื่นของตำแหน่ง', 'PosAlias', DEF.PosAlias, m.PosAlias, 'alias');
    var edit = function (table, row) {
      var isNew = !row; row = row || {};
      var f = DEF[table].map(function (c) {
        var k = c[0], val = row[k] == null ? '' : row[k];
        if (k === 'active' || k === 'stepEligible') return '<label class="tog"><input type="checkbox" name="' + k + '"' + (val === 'TRUE' || (isNew && k === 'active') ? ' checked' : '') + '><span>' + esc(c[1]) + '</span></label>';
        if (k === 'divCode') return '<label class="fld"><span>' + esc(c[1]) + '</span><select name="divCode">' + opts(m.Divisions.map(function (d) { return { v: d.code, l: d.code + ' · ' + d.name }; }), val, 'เลือก') + '</select></label>';
        if (k === 'wardCode') return '<label class="fld"><span>' + esc(c[1]) + '</span><select name="wardCode">' + opts(m.Wards.map(function (d) { return { v: d.code, l: d.code + ' · ' + d.name }; }), val, 'เลือก') + '</select></label>';
        if (k === 'positionCode') return '<label class="fld"><span>' + esc(c[1]) + '</span><select name="positionCode">' + opts(m.Positions.map(function (d) { return { v: d.code, l: d.code + ' · ' + d.name }; }), val, 'เลือก') + '</select></label>';
        return '<label class="fld"><span>' + esc(c[1]) + '</span><input name="' + k + '" value="' + attr(val) + '"' + (k === KEY[table] && !isNew ? ' readonly' : '') + '></label>';
      }).join('');
      modal({ title: (isNew ? 'เพิ่ม' : 'แก้ไข') + ' · ' + table, body: '<form id="msf">' + f + '</form>',
        actions: (isNew ? [] : [{ label: 'ลบ', kind: 'danger', onClick: function (close) { return api('deleteMaster', { table: table, id: row[KEY[table]] }).then(function () { close(); toast('ลบแล้ว'); render(); }); } }])
          .concat([{ label: 'บันทึก', kind: 'primary', onClick: function (close, box) { return api('saveMaster', { table: table, row: formData($('#msf', box)) }).then(function () { close(); toast('บันทึกแล้ว — ผู้ใช้จะเห็นค่าใหม่เมื่อเข้าระบบครั้งถัดไป'); render(); }); } }]) });
    };
    $$('[data-add]', host).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-add'), null); }; });
    $$('[data-ed]', host).forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-ed').split('|'), t = a[0], id = a.slice(1).join('|'); edit(t, m[t].filter(function (x) { return String(x[KEY[t]]) === id; })[0]); }; });
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
function admSettings(host) {
  api('getSettings', {}).then(function (d) {
    var v = d.values, ro = function (k) { return d.adminOnly.indexOf(k) >= 0 && !can('admin') ? ' disabled' : ''; };
    var inp = function (k, label, type, hint) { return '<label class="fld"><span>' + esc(label) + '</span><input name="' + k + '" type="' + (type || 'text') + '" value="' + attr(v[k]) + '"' + ro(k) + '>' + (hint ? '<small class="muted">' + hint + '</small>' : '') + '</label>'; };
    var chk = function (k, label, hint) { return '<label class="tog"><input type="checkbox" name="' + k + '"' + (v[k] ? ' checked' : '') + ro(k) + '><span>' + esc(label) + '</span></label>' + (hint ? '<p class="muted small">' + hint + '</p>' : ''); };
    host.innerHTML = '<form id="stf" class="form-grid"><h4 class="fg-h">หัวกระดาษเอกสาร</h4>' + inp('ORG_LINE1', 'บรรทัดที่ 1') + inp('ORG_LINE2', 'บรรทัดที่ 2') +
      chk('PRINT_SIGN_ON', 'แสดงช่องลงนามท้ายเอกสาร') + inp('PRINT_SIGN_1', 'ผู้ลงนาม 1') + inp('PRINT_SIGN_2', 'ผู้ลงนาม 2') + inp('PRINT_SIGN_3', 'ผู้ลงนาม 3') +
      '<div class="fld full"><span>โลโก้ (PNG/JPG ไม่เกิน 40KB)</span><input type="file" id="logoF" accept="image/png,image/jpeg">' + (v.LOGO_DATA ? '<img src="' + attr(v.LOGO_DATA) + '" class="logo-prev" alt="โลโก้ปัจจุบัน"> <button type="button" class="btn sm ghost" id="logoX">ลบโลโก้</button>' : '') + '<input type="hidden" name="LOGO_DATA" value="' + attr(v.LOGO_DATA) + '"></div>' +
      '<h4 class="fg-h">ขั้นการทำงาน ★</h4>' + inp('STEP_ALERT_YEARS', 'เกณฑ์กลาง: ★ เมื่อเกินกี่ปี', 'number') + R.STEPS.map(function (s) { return inp('STEP_ALERT_' + s, 'เกณฑ์เฉพาะ ' + s + ' (ว่าง = ใช้เกณฑ์กลาง)', 'number'); }).join('') +
      '<h4 class="fg-h">ขาด ลา มาสาย</h4><label class="fld full"><span>ประเภท (CODE:ชื่อ:day|min คั่นด้วย |)</span><textarea name="LEAVE_TYPES" rows="3">' + esc(v.LEAVE_TYPES) + '</textarea><small class="muted">day = นับเป็นวัน · min = นับเป็นนาที/ครั้ง · ห้ามเปลี่ยน CODE ที่มีข้อมูลแล้ว</small></label>' +
      inp('LATE_WATCH_TIMES', 'ต้องติดตามเมื่อสาย ≥ กี่ครั้ง/เดือน', 'number') + inp('ABSENT_WATCH_DAYS', 'ต้องติดตามเมื่อขาด ≥ กี่วัน/เดือน', 'number') +
      '<h4 class="fg-h">อื่น ๆ</h4>' + inp('COMP_RED_MAX', 'Competency ต่ำกว่าเกณฑ์เมื่อ <', 'number') + inp('COMP_YELLOW_MAX', 'Competency สูงกว่าเกณฑ์เมื่อ >', 'number') + inp('LICENSE_WARN_DAYS', 'เตือนใบประกอบฯ ล่วงหน้า (วัน)', 'number') +
      '<h4 class="fg-h">เฉพาะผู้ดูแลระบบ</h4>' + chk('SMARTAPI_ENABLED', 'เปิดใช้ SmartAPI (ต้องตั้ง Script Properties SMARTAPI_USER / SMARTAPI_PASS ก่อน)') +
      chk('SYNC_AUTO_INACTIVE', 'ซิงก์ HR: เปลี่ยนเป็นพ้นสภาพอัตโนมัติเมื่อไม่พบใน HR', 'ค่าแนะนำ: ปิด — ระบบติดธงให้หัวหน้ายืนยันแทน') +
      chk('HEALTH_ENABLED', 'เปิดใช้ข้อมูลสุขภาพ', 'เปิดได้หลังผ่านการพิจารณาของ DPO/PDPA และมีแบบขอความยินยอมแล้วเท่านั้น') + inp('BACKUP_KEEP_DAYS', 'เก็บไฟล์สำรองกี่วัน', 'number') +
      '<label class="fld"><span>รหัสผ่านแรกเข้า</span><select name="INIT_PASSWORD"' + ro('INIT_PASSWORD') + '>' + opts([{ v: 'EMPCODE', l: 'รหัสพนักงาน (บังคับเปลี่ยน)' }, { v: 'NONE', l: 'ปิด — ผู้ดูแลสร้างบัญชีให้เท่านั้น' }], v.INIT_PASSWORD) + '</select></label>' +
      '<div class="row-a full"><span class="sp"></span><button class="btn primary">บันทึกค่าระบบ</button></div></form>';
    $('#logoF').onchange = function () { var f = this.files[0]; if (!f) return; if (f.size > 40000) { toast('ไฟล์ใหญ่เกิน 40KB', 'err'); return; } var fr = new FileReader(); fr.onload = function () { $('#stf [name=LOGO_DATA]').value = fr.result; toast('เลือกโลโก้แล้ว กดบันทึก'); }; fr.readAsDataURL(f); };
    if ($('#logoX')) $('#logoX').onclick = function () { $('#stf [name=LOGO_DATA]').value = ''; toast('กดบันทึกเพื่อลบโลโก้'); };
    $('#stf').onsubmit = function (e) {
      e.preventDefault(); var x = formData(e.target), out = {};
      Object.keys(x).forEach(function (k) { var el = $('#stf [name=' + k + ']'); if (!el.disabled) out[k] = x[k]; });
      api('saveSettings', { values: out }).then(function (r) { toast('บันทึก ' + r.saved + ' ค่าแล้ว — มีผลทันทีกับผู้ใช้ที่เข้าระบบใหม่'); }).catch(fail);
    };
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
function admAudit(host, q) {
  var ym = q.ym || isoToday().slice(0, 7);
  api('getAuditLog', { ym: ym, action: q.action || '', q: q.q || '', result: q.result || '' }).then(function (d) {
    host.innerHTML = '<form class="filters" id="auf"><label class="fld sm"><span>เดือน</span><input type="month" name="ym" value="' + ym + '"></label>' +
      '<label class="fld sm"><span>การกระทำ</span><select name="action">' + opts(['LOGIN', 'LOGOUT', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'RESIGN', 'IMPORT', 'EXPORT', 'PRINT', 'APPROVE', 'REJECT', 'DENY', 'BACKUP', 'RESTORE', 'SYSTEM'], q.action || '', 'ทั้งหมด') + '</select></label>' +
      '<label class="fld sm"><span>ผล</span><select name="result">' + opts(['SUCCESS', 'FAILED', 'FORBIDDEN'], q.result || '', 'ทั้งหมด') + '</select></label><label class="fld grow"><span>ค้นหา</span><input type="search" name="q" value="' + attr(q.q || '') + '" placeholder="รหัสผู้ใช้ เป้าหมาย รายละเอียด"></label></form>' +
      '<p class="muted small">' + d.total + ' รายการ (แสดงล่าสุด 1,000) · เดือนเก่าย้ายไปเก็บใน Drive อัตโนมัติทุกคืน</p>' +
      '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>โมดูล</th><th>เป้าหมาย</th><th>รายละเอียด</th><th>ผล</th></tr></thead><tbody>' +
      d.rows.map(function (x) { return '<tr><td class="small">' + esc(x.at.replace('T', ' ')) + '</td><td class="mono">' + esc(x.empCode) + '</td><td><b>' + esc(x.action) + '</b></td><td>' + esc(x.module) + '</td><td class="small">' + esc(String(x.target).slice(0, 60)) + '</td><td class="small">' + esc(String(x.detail).slice(0, 120)) + '</td><td>' + (x.result === 'SUCCESS' ? '<span class="ok-t">✓</span>' : '<span class="err-t">' + esc(x.result) + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $$('#auf select, #auf input[type=month]').forEach(function (s) { s.onchange = function () { go('admin', Object.assign({ tab: 'audit' }, formData($('#auf')))); }; });
    $('#auf [name=q]').addEventListener('input', debounce(function () { go('admin', Object.assign({ tab: 'audit' }, formData($('#auf')))); }, 500));
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
function admSystem(host) {
  api('getSystemInfo', {}).then(function (d) {
    host.innerHTML = '<div class="kvs">' + kv('ระบบ', esc(d.app.NAME + ' v' + d.app.VERSION)) + kv('หลังบ้าน build', esc(d.app.BUILD + ' (' + d.app.BUILD_TH + ')')) + kv('หน้าเว็บ build', esc(APP_BUILD)) +
      kv('SmartAPI', d.smartapi.enabled ? '<span class="ok-t">เปิดใช้</span>' : 'ปิด' + (d.smartapi.hasCred ? ' (มีรหัสแล้ว)' : ' (ยังไม่ใส่รหัสใน Script Properties)')) + kv('งานอัตโนมัติ', esc(d.triggers.join(', ') || 'ยังไม่ติดตั้ง — Run installTriggers')) +
      (d.dbUrl ? kv('ไฟล์ฐานข้อมูล', '<a href="' + attr(d.dbUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a> <span class="muted small">(ห้ามแชร์)</span>') : '') + '</div>' +
      '<h3>จำนวนข้อมูล</h3><div class="kvs">' + Object.keys(d.counts).map(function (k) { return kv(k, num(d.counts[k], 0)); }).join('') + kv('ไฟล์ขาด/ลา/สาย (เดือน)', d.store.attendance.length) + kv('ไฟล์อบรม (ปี)', d.store.training.length) + kv('รอบ Competency', esc(d.store.competency.join(', ') || '-')) + '</div>' +
      '<h3>สำรองและกู้คืน</h3><p class="muted small">ระบบสำรองอัตโนมัติทุกคืน 01:00 (เก็บตามจำนวนวันที่ตั้งไว้) · ก่อนกู้คืนระบบสำรองสภาพปัจจุบันให้อีกชุดเสมอ · การกู้คืนไม่แตะบัญชีผู้ใช้</p>' +
      '<div class="row-a"><button class="btn primary" data-act="backup">สำรองข้อมูลตอนนี้</button>' + (can('admin') ? '<button class="btn" data-act="syncApi">ซิงก์ SmartAPI ตอนนี้</button><button class="btn" data-act="testApi">ทดสอบ SmartAPI</button><button class="btn" data-act="rebuildAtt">คำนวณสรุปขาด/ลา/สายใหม่</button><button class="btn ghost" data-act="clearCache">ล้างแคช</button>' : '') + '</div>' +
      (d.store.backup.length ? '<ul class="list">' + d.store.backup.map(function (b) { return '<li><span class="mono">' + esc(b) + '</span>' + (can('admin') ? ' <button class="btn sm ghost danger-t" data-restore="' + attr(b) + '">กู้คืน</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">ยังไม่มีไฟล์สำรอง</p>') +
      '<h3>ประวัติการนำเข้า</h3>' + (d.imports.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>เวลา</th><th>ผู้นำเข้า</th><th>ชนิด</th><th>ไฟล์</th><th class="r">แถว</th><th class="r">สำเร็จ</th><th class="r">ผิดพลาด</th></tr></thead><tbody>' +
        d.imports.map(function (x) { return '<tr><td class="small">' + esc(x.at.replace('T', ' ')) + '</td><td class="mono">' + esc(x.by) + '</td><td>' + esc(x.kind) + '</td><td class="small">' + esc(x.file) + '</td><td class="r">' + x.rows + '</td><td class="r">' + x.ok + '</td><td class="r">' + x.errors + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">ยังไม่มี</p>');
    $$('[data-act]', host).forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-act'); b.disabled = true;
      api('adminAction', { act: a }).then(function (r) { b.disabled = false; toast(a === 'backup' ? 'สำรองแล้ว: ' + r.name : a === 'testApi' ? 'SmartAPI: token ' + (r.tokenOk ? '✓' : '✗') + ' · พบข้อมูลทดสอบ ' + (r.found ? '✓' : '✗') + ' · ' + r.ms + ' ms' : a === 'syncApi' ? 'ตรวจ ' + r.checked + ' คน · ติดธง ' + r.flagged : 'เรียบร้อย'); if (a === 'backup') render(); })
        .catch(function (e) { b.disabled = false; fail(e); }); }; });
    $$('[data-restore]', host).forEach(function (b) { b.onclick = function () { var n = b.getAttribute('data-restore');
      askPassword('กู้คืนข้อมูลจาก ' + n, 'ข้อมูลปัจจุบันทั้งหมด (ยกเว้นบัญชีผู้ใช้) จะถูกแทนที่ด้วยไฟล์สำรองนี้ — ระบบสำรองสภาพปัจจุบันไว้ก่อน').then(function (pw) { return api('adminAction', { act: 'restore', name: n, password: pw }); }).then(function () { toast('กู้คืนแล้ว'); cacheClear(); render(); }).catch(fail); }; });
  }).catch(function (e) { host.innerHTML = empty(e.message); });
}
