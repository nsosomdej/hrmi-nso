/**
 * javascript.js — แกนกลางหน้าเว็บ HRMi for NSO
 * เครือข่าย (ไม่มี preflight · จำกัด 4 คำขอ · ลองซ้ำเฉพาะคำสั่งอ่าน) · แคช SWR · ล็อกอินรอบเดียว · เมนู/เส้นทาง · ชิ้นส่วน UI
 * ⚠ BUILD ต้องตรง 3 ที่: Config.gs · javascript.js (APP_BUILD) · version.json
 */
var APP_BUILD = '2569-10-05.2', APP_BUILD_TH = '5 ต.ค. 2569', APP_VERSION = '1.2569';
var S = { token: null, boot: null, me: null, dv: null, route: null, busy: 0, navId: 0 };
/** เก็บเวลาตอบสนอง (ดูได้ที่ ตั้งค่าระบบ › ระบบ) */
var PERF = [];
function perfLog(action, total, server) { PERF.unshift({ a: action, t: total, s: server || 0, at: new Date().toTimeString().slice(0, 8) }); if (PERF.length > 40) PERF.pop(); }

/* ================================================================ เครือข่าย */
var NET = { active: 0, queue: [], MAX: 4 };
function netSlot() { return new Promise(function (res) { if (NET.active < NET.MAX) { NET.active++; res(); } else NET.queue.push(res); }); }
function netDone() { var n = NET.queue.shift(); if (n) n(); else NET.active = Math.max(0, NET.active - 1); }
function isRead(a) { return /^(get|list|bootstrap|boot|ping|suggest|preview|lookup)/.test(a); }
function fetchOnce(action, payload) {
  return fetch(API_URL, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store',
    body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }) })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      if (String(t).trim().charAt(0) === '<') { var e = new Error('เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว กรุณาลองใหม่'); e.busy = true; throw e; }
      return JSON.parse(t);
    });
}
function rawCall(action, payload) {
  var waits = [800, 1800, 3500], tries = 0, read = isRead(action);
  var attempt = function () {
    return netSlot().then(function () { return fetchOnce(action, payload); })
      .then(function (x) { netDone(); return x; }, function (e) {
        netDone();
        if (read && tries < waits.length) { var w = waits[tries++]; return new Promise(function (r) { setTimeout(r, w); }).then(attempt); }
        if (!e.busy) e.message = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่';
        throw e;
      });
  };
  return attempt();
}

/* ================================================================ แคช (หน่วยความจำ + sessionStorage ปิดแท็บแล้วหาย) */
var MEMO = {}, MEMO_T = {}, PC = 'hn_c:';
function mkey(a, p) { return a + '|' + JSON.stringify(p || {}); }
function pcKey(k) { return PC + (S.me ? S.me.empCode : '') + ':' + k; }
function pcGet(k) { try { var v = sessionStorage.getItem(pcKey(k)); if (!v) return null; v = JSON.parse(v); return v.dv === S.dv ? v.d : null; } catch (e) { return null; } }
function pcSet(k, d) { try { var s = JSON.stringify({ dv: S.dv, d: d }); if (s.length < 600000) sessionStorage.setItem(pcKey(k), s); } catch (e) { } }
function cacheClear() { MEMO = {}; MEMO_T = {}; try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf(PC) === 0) sessionStorage.removeItem(k); }); } catch (e) { } }

/** api(action, payload, {fresh:true, onCache:fn}) — onCache วาดข้อมูลเดิมทันที แล้ว then วาดข้อมูลจริง */
function api(action, payload, opt) {
  opt = opt || {};
  var k = mkey(action, payload), read = isRead(action);
  if (read && opt.fresh) {
    var cd = MEMO[k] || pcGet(k);
    if (cd && opt.onCache) try { opt.onCache(cd); } catch (e) { console.error(e); }
    if (MEMO[k] && Date.now() - MEMO_T[k] < 15000) return Promise.resolve(MEMO[k]);
  }
  if (!read) cacheClear();
  busy(1);
  var nav = S.navId, t0 = Date.now(), NEVER = new Promise(function () { });
  return rawCall(action, payload).then(function (res) {
    busy(-1);
    perfLog(action, Date.now() - t0, res.ms);
    // ผลของคำสั่งอ่านที่กลับมาหลังผู้ใช้เปลี่ยนหน้าไปแล้ว → ไม่ต้องวาด (กัน error "null is not an object")
    if (read && nav !== S.navId && !opt.keep) return NEVER;
    if (res.dv && S.dv && res.dv !== S.dv) { var keep = MEMO[k]; cacheClear(); if (keep) MEMO[k] = keep; }
    if (res.dv) S.dv = res.dv;
    if (res.ok) { if (read && opt.fresh) { MEMO[k] = res.data; MEMO_T[k] = Date.now(); pcSet(k, res.data); } return res.data; }
    if (res.code === 'UNAUTHORIZED') { sessionEnd('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง'); }
    if (res.code === 'MUST_CHANGE') { showChangePassword(true); }
    var e = new Error(res.error || 'เกิดข้อผิดพลาด'); e.code = res.code; throw e;
  }, function (e) { busy(-1); if (read && nav !== S.navId && !opt.keep) return NEVER; throw e; });
}
function busy(d) { S.busy = Math.max(0, S.busy + d); var b = document.getElementById('netbar'); if (b) b.classList.toggle('on', S.busy > 0); }

/* ================================================================ ตัวช่วยทั่วไป */
function $(s, root) { return (root || document).querySelector(s); }
function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function attr(s) { return esc(s); }
function num(n, d) { if (n === '' || n == null || isNaN(n)) return '-'; return (+n).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 2 : d }); }
function td(iso) { return R.thaiDate(iso); }
function ward(code) { var w = (S.boot.wards || []).filter(function (x) { return x.code === code; })[0]; return w ? w.name : code; }
function divName(code) { var d = (S.boot.divisions || []).filter(function (x) { return x.code === code; })[0]; return d ? d.name : code; }
function posName(code) { var p = (S.boot.positions || []).filter(function (x) { return x.code === code; })[0]; return p ? p.name : code; }
function has(r) { return S.me && S.me.roles.indexOf(r) >= 0; }
function can(k) { return S.boot && S.boot.can && S.boot.can[k]; }
function debounce(fn, ms) { var t; return function () { var a = arguments, th = this; clearTimeout(t); t = setTimeout(function () { fn.apply(th, a); }, ms); }; }
function qs(o) { var a = []; Object.keys(o || {}).forEach(function (k) { if (o[k] !== '' && o[k] != null && o[k] !== false) a.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); }); return a.length ? '?' + a.join('&') : ''; }
function go(path, q) { location.hash = '#/' + path + qs(q); }
function isoToday() { return S.boot ? S.boot.today : R.todayIso(); }
function leaveType(code) { return (S.boot.lists.leaveTypes || []).filter(function (t) { return t.code === code; })[0] || { code: code, name: code, unit: 'day' }; }
function starHtml(d) { return d && d.stepAlert ? '<span class="star" title="ได้รับขั้นนี้เกินเกณฑ์แล้ว ควรตรวจสอบ/ติดตาม">★</span>' : ''; }
function stepCell(d) {
  if (!d.stepEligible) return '<span class="muted">-</span>';
  if (!d.stepCode) return '<span class="chip warn">ยังไม่ระบุ</span>';
  return '<b>' + esc(d.stepCode) + '</b> <span class="muted">' + esc(d.stepYear) + (d.stepYears != null ? ' · ' + d.stepYears + ' ปี' : '') + '</span> ' + starHtml(d);
}
function statusChip(st) { return '<span class="chip st-' + esc(st) + '">' + esc(S.boot.lists.status[st] || st) + '</span>'; }

/* ================================================================ แจ้งเตือน / กล่องโต้ตอบ */
function toast(msg, kind) {
  var t = document.createElement('div'); t.className = 'toast ' + (kind || 'ok'); t.setAttribute('role', 'status'); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'err' ? 6000 : 3200);
}
function fail(e) { console.error(e); toast(e && e.message ? e.message : String(e), 'err'); }
/** modal({title, body(html), wide, actions:[{label, kind, onClick(close, box) → Promise|void}]}) */
function modal(o) {
  var wrap = document.createElement('div'); wrap.className = 'modal-wrap'; wrap.innerHTML =
    '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + attr(o.title) + '">' +
    '<div class="modal-h"><h3>' + esc(o.title) + '</h3><button class="icon-btn" data-x aria-label="ปิด">✕</button></div>' +
    '<div class="modal-b">' + (o.body || '') + '</div>' +
    '<div class="modal-f">' + (o.actions || []).map(function (a, i) { return '<button class="btn ' + (a.kind || '') + '" data-i="' + i + '">' + esc(a.label) + '</button>'; }).join('') +
    '<button class="btn ghost" data-x>' + esc(o.cancel || 'ยกเลิก') + '</button></div></div>';
  document.body.appendChild(wrap);
  var close = function () { wrap.remove(); document.removeEventListener('keydown', onKey); };
  var onKey = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $$('[data-x]', wrap).forEach(function (b) { b.onclick = close; });
  wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && !o.sticky) close(); });
  $$('[data-i]', wrap).forEach(function (b) {
    b.onclick = function () {
      var a = o.actions[+b.getAttribute('data-i')], r;
      try { r = a.onClick(close, $('.modal', wrap)); } catch (e) { fail(e); return; }
      if (r && r.then) { b.disabled = true; b.classList.add('loading'); r.then(function () { b.disabled = false; b.classList.remove('loading'); }, function (e) { b.disabled = false; b.classList.remove('loading'); fail(e); }); }
    };
  });
  var f = $('input,select,textarea', wrap); if (f) setTimeout(function () { f.focus(); }, 30);
  if (o.onOpen) o.onOpen($('.modal', wrap), close);
  return { close: close, box: $('.modal', wrap) };
}
function confirmBox(title, html, okLabel, kind) {
  return new Promise(function (res) { modal({ title: title, body: html, actions: [{ label: okLabel || 'ยืนยัน', kind: kind || 'primary', onClick: function (close) { close(); res(true); } }] }); });
}
function askPassword(title, note) {
  return new Promise(function (res) {
    modal({ title: title, body: '<p class="muted">' + esc(note || 'กรุณายืนยันรหัสผ่านของคุณเพื่อดำเนินการ') + '</p><label class="fld"><span>รหัสผ่าน</span><input type="password" id="cfpw" autocomplete="current-password"></label>',
      actions: [{ label: 'ยืนยัน', kind: 'primary', onClick: function (close, box) { var v = $('#cfpw', box).value; if (!v) { toast('กรุณากรอกรหัสผ่าน', 'err'); return; } close(); res(v); } }] });
  });
}
/** อ่านค่าฟอร์มตาม name */
function formData(root) {
  var o = {};
  $$('[name]', root).forEach(function (el) {
    if (el.type === 'checkbox') { if (el.hasAttribute('data-multi')) { o[el.name] = o[el.name] || []; if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  });
  return o;
}
function opts(list, val, empty) {
  return (empty != null ? '<option value="">' + esc(empty) + '</option>' : '') + list.map(function (x) {
    var v = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x; return '<option value="' + attr(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('');
}
function wardOpts(val, empty, onlyCodes) {
  var set = onlyCodes ? {} : null; if (onlyCodes) onlyCodes.forEach(function (c) { set[c] = 1; });
  var byDiv = {}; S.boot.wards.forEach(function (w) { if (set && !set[w.code]) return; (byDiv[w.divCode] = byDiv[w.divCode] || []).push(w); });
  return (empty != null ? '<option value="">' + esc(empty) + '</option>' : '') + S.boot.divisions.filter(function (d) { return byDiv[d.code]; }).map(function (d) {
    return '<optgroup label="' + attr(d.name) + '">' + byDiv[d.code].map(function (w) { return '<option value="' + attr(w.code) + '"' + (w.code === val ? ' selected' : '') + '>' + esc(w.code + ' · ' + w.name) + '</option>'; }).join('') + '</optgroup>';
  }).join('');
}
function divOpts(val, empty, only) { return opts(S.boot.divisions.filter(function (d) { return !only || only.indexOf(d.code) >= 0; }).map(function (d) { return { v: d.code, l: d.name }; }), val, empty); }
function posOpts(val, empty) { return opts(S.boot.positions.map(function (p) { return { v: p.code, l: p.name }; }), val, empty); }
/** หอที่ผู้ใช้ดูได้ (null = ทั้งหมด) สำหรับตัวกรอง */
function myViewWards() { return S.boot.viewWards; }
function myViewDivs() {
  var vw = S.boot.viewWards; if (vw === null) return null;
  var o = {}; S.boot.wards.forEach(function (w) { if (vw.indexOf(w.code) >= 0) o[w.divCode] = 1; }); return Object.keys(o);
}
function scopeFilters(f, onChange) {
  var vw = myViewWards(), dv = myViewDivs();
  return '<label class="fld sm"><span>ส่วนงาน</span><select name="div">' + divOpts(f.div || '', 'ทั้งหมด', dv) + '</select></label>' +
    '<label class="fld sm"><span>หอ/หน่วย</span><select name="ward">' + wardOpts(f.ward || '', 'ทั้งหมด', vw === null ? (f.div ? S.boot.wards.filter(function (w) { return w.divCode === f.div; }).map(function (w) { return w.code; }) : null) : vw.filter(function (c) { return !f.div || (S.boot.wards.filter(function (w) { return w.code === c; })[0] || {}).divCode === f.div; })) + '</select></label>';
}
function pager(d, onPage) {
  if (!d || d.pages <= 1) return '<div class="pager"><span class="muted">ทั้งหมด ' + num(d ? d.total : 0, 0) + ' รายการ</span></div>';
  var b = function (p, l, dis) { return '<button class="btn sm ghost" data-page="' + p + '"' + (dis ? ' disabled' : '') + '>' + l + '</button>'; };
  return '<div class="pager"><span class="muted">ทั้งหมด ' + num(d.total, 0) + ' รายการ · หน้า ' + d.page + '/' + d.pages + '</span><span class="sp"></span>' +
    b(1, '«', d.page === 1) + b(d.page - 1, '‹ ก่อนหน้า', d.page === 1) + b(d.page + 1, 'ถัดไป ›', d.page === d.pages) + b(d.pages, '»', d.page === d.pages) + '</div>';
}
function bindPager(root, fn) { $$('[data-page]', root).forEach(function (b) { b.onclick = function () { fn(+b.getAttribute('data-page')); }; }); }
function empty(msg, sub) { return '<div class="empty"><div class="empty-ic">◌</div><p>' + esc(msg) + '</p>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div>'; }
function skeleton(n) { var s = ''; for (var i = 0; i < (n || 4); i++) s += '<div class="sk"></div>'; return '<div class="sk-wrap">' + s + '</div>'; }

/** ช่องเลือกบุคลากร (พิมพ์ชื่อ/รหัส ≥ 2 ตัว) — คืนรายการที่เลือกผ่าน getValue() */
function personPicker(host, o) {
  o = o || {}; var sel = [];
  host.innerHTML = '<div class="pp"><div class="pp-chips"></div><input type="search" class="pp-in" placeholder="' + attr(o.placeholder || 'พิมพ์ชื่อหรือรหัสพนักงาน') + '" autocomplete="off"></div>';
  var inp = $('.pp-in', host), chips = $('.pp-chips', host), pop = document.createElement('div'); pop.className = 'pp-pop'; document.body.appendChild(pop); pop.hidden = true;
  var draw = function () { chips.innerHTML = sel.map(function (p, i) { return '<span class="chip pick">' + esc(p.empCode + ' ' + p.fullName) + ' <button type="button" data-rm="' + i + '" aria-label="เอาออก">✕</button></span>'; }).join('');
    $$('[data-rm]', chips).forEach(function (b) { b.onclick = function () { sel.splice(+b.getAttribute('data-rm'), 1); draw(); }; }); };
  var place = function () { var r = inp.getBoundingClientRect(); pop.style.left = (r.left + window.scrollX) + 'px'; pop.style.top = (r.bottom + window.scrollY + 4) + 'px'; pop.style.width = Math.max(260, r.width) + 'px'; };
  var search = debounce(function () {
    var q = inp.value.trim(); if (q.length < 2) { pop.hidden = true; return; }
    api('suggestPeople', { q: q, edit: !!o.edit }).then(function (list) {
      var hrOk = /^\d{7}$/.test(q) && can('smartapi') && (can('edit') || can('office'));
      if (!list.length) { pop.innerHTML = hrOk ? '<button type="button" class="pp-item hr" data-hr>' + ic('cloud') + ' ไม่พบ ' + esc(q) + ' ในทะเบียน — <b>ค้นจากระบบ HR</b></button>' : '<div class="pp-item muted">ไม่พบในทะเบียน' + (/^\d{7}$/.test(q) ? ' (รหัส ' + esc(q) + ')' : '') + '</div>'; }
      else pop.innerHTML = list.map(function (p, i) { return '<button type="button" class="pp-item" data-k="' + i + '"><b>' + esc(p.empCode) + '</b> ' + esc(p.fullName) + ' <span class="muted">' + esc(p.wardCode + ' · ' + p.positionName) + '</span></button>'; }).join('');
      place(); pop.hidden = false;
      var hb = $('[data-hr]', pop); if (hb) hb.onmousedown = function (e) { e.preventDefault(); pop.hidden = true;
        hrLookupDialog(q, function (p) { if (o.single) sel = [p]; else sel.push(p); inp.value = ''; draw(); if (o.onChange) o.onChange(sel); }); };
      $$('[data-k]', pop).forEach(function (b) { b.onmousedown = function (e) { e.preventDefault(); var p = list[+b.getAttribute('data-k')];
        if (o.single) sel = [p]; else if (!sel.some(function (x) { return x.empCode === p.empCode; })) sel.push(p);
        inp.value = ''; pop.hidden = true; draw(); if (o.onChange) o.onChange(sel); }; });
    }).catch(function () { });
  }, 250);
  inp.addEventListener('input', search); inp.addEventListener('blur', function () { setTimeout(function () { pop.hidden = true; }, 150); });
  if (o.value) { sel = o.value.slice(); draw(); }
  var obs = new MutationObserver(function () { if (!document.body.contains(host)) { pop.remove(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
  return { getValue: function () { return sel; }, clear: function () { sel = []; draw(); } };
}

/* ================================================================ ระบบ HR (SmartAPI) — ค้น 1 คน / เพิ่มจาก HR / ดึงข้อมูลทั้งหมดพร้อมแถบความคืบหน้า */
function hrCardHtml(r) {
  if (!r.ok) return '<div class="alert ' + (r.notFound ? 'warn' : 'err') + '">' + esc(r.error) + (r.ms ? ' <span class="muted small">(' + r.ms + ' ms)</span>' : '') + '</div>';
  var x = r.row;
  return '<div class="hr-card"><div class="hr-av">' + ic('user') + '</div><div class="hr-b"><b>' + esc(x.fullName) + '</b> <span class="mono muted">' + esc(x.empCode) + '</span>' +
    '<div class="muted small">' + esc(x.hrPosition || '-') + ' · ' + esc(x.hrOrgUnit || '-') + '</div>' +
    '<div class="small">เริ่มงาน ' + (x.startDate ? td(x.startDate) : '-') + ' · หอในระบบ: ' + (x.wardCode ? '<b>' + esc(x.wardCode + ' ' + x.wardName) + '</b>' : '<span class="warn-t">ยังเทียบไม่ได้ — โปรดเลือก</span>') + '</div>' +
    (r.exists ? '<div class="chip ok">มีในทะเบียนแล้ว</div>' : '') + '</div><span class="muted small">' + r.ms + ' ms</span></div>';
}
function hrLookupDialog(code, onAdded) {
  var last = null;
  var m = modal({ title: 'ค้นข้อมูลจากระบบ HR (SmartAPI)', body: '<form id="hrf" class="row-a"><input id="hrc" class="in" inputmode="numeric" maxlength="7" placeholder="รหัสพนักงาน 7 หลัก" value="' + attr(code || '') + '"><button class="btn" type="submit">' + ic('search') + ' ค้นหา</button></form><div id="hrr" class="mt"></div>',
    actions: [{ label: 'เพิ่มเข้าทะเบียน', kind: 'primary', onClick: function (close, box) {
      if (!last || !last.ok) { toast('กรุณาค้นหารหัสที่พบในระบบ HR ก่อน', 'err'); return; }
      if (last.exists) { close(); if (onAdded) onAdded(last.row); else go('person/' + last.row.empCode); return; }
      var w = $('#hrw', box) ? $('#hrw', box).value : last.row.wardCode, pc = $('#hrp', box) ? $('#hrp', box).value : last.row.positionCode;
      if (!w) { toast('กรุณาเลือกหอ/หน่วยงาน', 'err'); return; } if (!pc) { toast('กรุณาเลือกตำแหน่ง', 'err'); return; }
      return api('addFromHr', { empCode: last.row.empCode, wardCode: w, positionCode: pc }).then(function () {
        close(); cacheClear(); toast('เพิ่ม ' + last.row.fullName + ' เข้าทะเบียนแล้ว');
        var pos = (S.boot.positions.filter(function (q) { return q.code === pc; })[0] || {}).name || '';
        if (onAdded) onAdded({ empCode: last.row.empCode, fullName: last.row.fullName, wardCode: w, positionName: pos }); else go('person/' + last.row.empCode);
      });
    } }] });
  var box = m.box, run = function () {
    var c = $('#hrc', box).value.trim(); if (!/^\d{7}$/.test(c)) { toast('รหัสพนักงานต้องเป็นตัวเลข 7 หลัก', 'err'); return; }
    $('#hrr', box).innerHTML = '<div class="loading-line">' + ic('cloud') + ' กำลังถามระบบ HR…</div>';
    api('lookupHr', { code: c }, { keep: true }).then(function (r) {
      last = r; var x = r.row || {};
      $('#hrr', box).innerHTML = hrCardHtml(r) + (r.ok && !r.exists ? '<div class="form-grid mt">' +
        (!x.wardCode || !x.canAdd ? '<label class="fld"><span>หอ/หน่วยงาน *</span><select id="hrw">' + wardOpts(x.wardCode || '', 'เลือกหอ/หน่วย', S.boot.editWards) + '</select></label>' : '') +
        (!x.positionCode ? '<label class="fld"><span>ตำแหน่ง *</span><select id="hrp">' + posOpts('', 'เลือกตำแหน่ง') + '</select></label>' : '') + '</div>' : '');
    }).catch(function (e) { last = null; $('#hrr', box).innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  };
  $('#hrf', box).onsubmit = function (e) { e.preventDefault(); run(); };
  if (code) run();
}
/** ดึง/ตรวจข้อมูลทุกคนกับ HR ทีละ 200 คน พร้อมแถบความคืบหน้า (เรียก syncApi ซ้ำตาม offset) */
function hrSyncAll(onDone) {
  var stop = false, tot = { checked: 0, found: 0, flagged: 0, filledStart: 0 };
  var m = modal({ title: 'ดึงข้อมูลจากระบบ HR ทั้งหมด', sticky: true, cancel: 'หยุด / ปิด', body: '<p class="muted">ระบบเติมวันเริ่มงาน ตำแหน่งตาม HR และหน่วยงาน และติดธงคนที่ไม่พบใน HR (ไม่เปลี่ยนสถานะเองถ้าไม่ได้ตั้งค่าไว้) — ทำทีละ 200 คน ปิดหน้าต่างนี้ได้ ข้อมูลที่ทำแล้วไม่หาย</p>' +
    '<div class="progress"><span id="sbar" style="width:0%"></span></div><p id="stxt" class="small">กำลังเริ่ม…</p><ul class="steps-log" id="slog"></ul>' });
  var box = m.box, wrap = box.parentNode, t0 = Date.now();
  new MutationObserver(function () { if (!document.body.contains(wrap)) stop = true; }).observe(document.body, { childList: true });
  var step = function (off) {
    if (stop) return;
    api('adminAction', { act: 'syncApi', offset: off, limit: 200 }, { keep: true }).then(function (r) {
      ['checked', 'found', 'flagged', 'filledStart'].forEach(function (k) { tot[k] += r[k] || 0; });
      var done = r.next == null ? r.total : r.next, pct = r.total ? Math.round(done / r.total * 100) : 100;
      $('#sbar', box).style.width = pct + '%';
      $('#stxt', box).innerHTML = '<b>' + num(done, 0) + ' / ' + num(r.total, 0) + '</b> คน (' + pct + '%) · พบใน HR ' + num(tot.found, 0) + ' · เติมวันเริ่มงาน ' + num(tot.filledStart, 0) + ' · ติดธง ' + num(tot.flagged, 0) + ' · ' + Math.round((Date.now() - t0) / 1000) + ' วินาที';
      $('#slog', box).insertAdjacentHTML('afterbegin', '<li>' + ic('check', 'ok-t') + ' ลำดับ ' + (off + 1) + '–' + done + ' · พบ ' + (r.found || 0) + ' · ติดธง ' + (r.flagged || 0) + '</li>');
      if (r.next != null) step(r.next);
      else { cacheClear(); $('#stxt', box).insertAdjacentHTML('beforeend', '<div class="alert ok mt">เสร็จเรียบร้อย</div>'); toast('ดึงข้อมูลจาก HR เสร็จ: ' + num(tot.found, 0) + ' คน'); if (onDone) onDone(tot); }
    }).catch(function (e) { $('#stxt', box).insertAdjacentHTML('beforeend', '<div class="alert err mt">หยุดที่ลำดับ ' + (off + 1) + ': ' + esc(e.message) + ' <button class="btn sm" id="sretry">ลองต่อ</button></div>'); var b = $('#sretry', box); if (b) b.onclick = function () { b.parentNode.remove(); step(off); }; });
  };
  step(0);
}
/** ทดสอบ SmartAPI ทีละขั้น (token → emp-info) แสดงผล ok/รายละเอียด/เวลา */
function hrTestDialog() {
  var m = modal({ title: 'ทดสอบการเชื่อมต่อ SmartAPI', wide: true, body: '<form id="tf" class="row-a"><input id="tc" class="in" inputmode="numeric" maxlength="7" placeholder="รหัสพนักงานที่ยังทำงาน (ค่าเริ่มต้น = รหัสของคุณ)" value="' + attr(S.me.empCode) + '"><button class="btn primary" type="submit">' + ic('zap') + ' ทดสอบ</button></form><div id="tr" class="mt"></div>' });
  var box = m.box;
  $('#tf', box).onsubmit = function (e) { e.preventDefault();
    $('#tr', box).innerHTML = '<div class="loading-line">กำลังทดสอบ…</div>';
    api('adminAction', { act: 'testApi', code: $('#tc', box).value.trim() }, { keep: true }).then(function (r) {
      $('#tr', box).innerHTML = '<div class="kvs">' + kv('ที่อยู่ API', '<span class="mono small">' + esc(r.base + r.pathEmp) + '</span>') + kv('SMARTAPI_USER', r.hasUser ? '<span class="ok-t">มีแล้ว</span>' : '<span class="err-t">ยังไม่มีใน Script Properties</span>') +
        kv('SMARTAPI_PASS', r.hasPass ? '<span class="ok-t">มีแล้ว</span>' : '<span class="err-t">ยังไม่มีใน Script Properties</span>') + kv('เปิดใช้ในค่าระบบ', r.enabled ? '<span class="ok-t">เปิด</span>' : '<span class="err-t">ปิด — เปิดที่ ค่าระบบ</span>') + '</div>' +
        '<ul class="steps-log big">' + r.steps.map(function (x) { return '<li class="' + (x.ok ? 'ok' : 'bad') + '">' + ic(x.ok ? 'check' : 'alert', x.ok ? 'ok-t' : 'err-t') + ' <b>' + esc(x.step) + '</b> <span class="muted small">' + x.ms + ' ms</span><div class="small mono wrap">' + esc(x.detail) + '</div></li>'; }).join('') + '</ul>';
    }).catch(function (e) { $('#tr', box).innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  };
  $('#tf', box).onsubmit(new Event('submit'));
}

/* ================================================================ กราฟแท่งเรียบง่าย (SVG/CSS ไม่ใช้ไลบรารี) */
function barList(rows, o) {
  o = o || {}; var max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
  return '<div class="bars">' + rows.map(function (r) {
    return '<div class="bar-row"' + (r.href ? ' data-href="' + attr(r.href) + '" tabindex="0" role="link"' : '') + '><span class="bar-l" title="' + attr(r.label) + '">' + esc(r.label) + '</span><span class="bar-t"><span class="bar-f' + (r.cls ? ' ' + r.cls : '') + '" style="width:' + (r.n / max * 100).toFixed(1) + '%"></span></span><span class="bar-v">' + num(r.n, o.dec == null ? 0 : o.dec) + (r.extra ? ' ' + r.extra : '') + '</span></div>';
  }).join('') + '</div>';
}
function colChart(rows, o) {
  o = o || {}; var max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1])), W = 100 / rows.length;
  return '<div class="cols" role="img" aria-label="' + attr(o.label || '') + '">' + rows.map(function (r) {
    return '<div class="col" style="width:' + W + '%"><span class="col-v">' + (r.n ? num(r.n, o.dec == null ? 0 : o.dec) : '') + '</span><span class="col-b" style="height:' + (r.n / max * 100).toFixed(1) + '%"></span><span class="col-l">' + esc(r.label) + '</span></div>';
  }).join('') + '</div>';
}
function bindHref(root) { $$('[data-href]', root).forEach(function (el) { var f = function () { location.hash = el.getAttribute('data-href'); }; el.onclick = f; el.onkeydown = function (e) { if (e.key === 'Enter') f(); }; }); }

/* ================================================================ ล็อกอิน */
function showLogin(msg) {
  document.body.className = 'is-login';
  $('#app').innerHTML =
    '<div class="login"><div class="login-card"><div class="brand-lg"><span class="nso-mark">NSO</span><div><h1>HRMi for NSO</h1><p>ระบบบริหารข้อมูลบุคลากร ฝ่ายการพยาบาล</p></div></div>' +
    '<p class="login-org">โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา สภากาชาดไทย</p>' +
    (msg ? '<div class="alert">' + esc(msg) + '</div>' : '') +
    '<form id="loginForm" novalidate><label class="fld"><span>รหัสพนักงาน (7 หลัก)</span><input name="empCode" id="lgCode" inputmode="numeric" maxlength="7" autocomplete="username" required></label>' +
    '<label class="fld"><span>รหัสผ่าน</span><input name="password" type="password" autocomplete="current-password" required></label>' +
    '<button class="btn primary block" id="lgBtn">เข้าสู่ระบบ</button><div class="login-bar"><span></span></div>' +
    '<p class="muted small">เข้าครั้งแรกใช้รหัสผ่านเป็นรหัสพนักงาน แล้วระบบจะให้ตั้งรหัสผ่านใหม่ · ลืมรหัสผ่านติดต่อสำนักงานฝ่ายการพยาบาล</p></form>' +
    '<p class="conn muted small" id="conn">กำลังตรวจการเชื่อมต่อ…</p></div><p class="foot muted small">v' + APP_VERSION + ' · build ' + APP_BUILD + '</p></div>';
  try { var last = localStorage.getItem('hn_last'); if (last) $('#lgCode').value = last; } catch (e) { }
  rawCall('ping', {}).then(function (r) {
    var c = $('#conn'); if (!c) return;
    if (r.ok) { c.textContent = '● เชื่อมต่อระบบแล้ว (หลังบ้าน build ' + r.data.build + ')'; c.className = 'conn ok small'; if (r.data.build !== APP_BUILD) { c.textContent += ' — ไม่ตรงกับหน้าเว็บ ' + APP_BUILD; c.className = 'conn warn small'; } }
  }).catch(function () { var c = $('#conn'); if (c) { c.textContent = '● ยังเชื่อมต่อหลังบ้านไม่ได้ — ตรวจ API_URL ใน config.js'; c.className = 'conn bad small'; } });
  $('#loginForm').onsubmit = function (e) {
    e.preventDefault(); var f = formData(e.target);
    if (!R.validEmpCode(f.empCode)) { toast('รหัสพนักงานต้องเป็นตัวเลข 7 หลัก', 'err'); return; }
    if (!f.password) { toast('กรุณากรอกรหัสผ่าน', 'err'); return; }
    var btn = $('#lgBtn'); btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…'; $('.login-bar').classList.add('on');
    api('login', { empCode: f.empCode, password: f.password, withBoot: true }).then(function (r) {
      S.token = r.token; try { localStorage.setItem('hn_token', r.token); localStorage.setItem('hn_last', f.empCode); } catch (e2) { }
      if (r.mustChange) { showChangePassword(true); return; }
      startApp(r.boot, r.home);
    }).catch(function (err) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; $('.login-bar').classList.remove('on'); fail(err); });
  };
}
function showChangePassword(forced) {
  modal({ title: forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน', sticky: forced, cancel: forced ? 'ออกจากระบบ' : 'ยกเลิก',
    body: '<p class="muted">รหัสผ่านใหม่ยาวอย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข และต้องไม่ซ้ำรหัสพนักงาน</p>' +
      '<label class="fld"><span>รหัสผ่านเดิม' + (forced ? ' (รหัสพนักงาน หากเข้าครั้งแรก)' : '') + '</span><input type="password" id="pwOld" autocomplete="current-password"></label>' +
      '<label class="fld"><span>รหัสผ่านใหม่</span><input type="password" id="pwNew" autocomplete="new-password"></label>' +
      '<label class="fld"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" id="pwNew2" autocomplete="new-password"></label>',
    actions: [{ label: 'บันทึกรหัสผ่าน', kind: 'primary', onClick: function (close, box) {
      var a = $('#pwOld', box).value, b = $('#pwNew', box).value, c = $('#pwNew2', box).value;
      if (b !== c) { toast('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน', 'err'); return; }
      return api('changePassword', { oldPassword: a, newPassword: b, withBoot: true }).then(function (r) { close(); toast('เปลี่ยนรหัสผ่านแล้ว'); if (forced || !S.boot) startApp(r.boot, r.home); });
    } }],
    onOpen: function (box) { if (forced) $$('[data-x]', box.parentNode).forEach(function (x) { x.onclick = function () { logout(); }; }); }
  });
}
function sessionEnd(msg) { S.token = null; S.boot = null; cacheClear(); try { localStorage.removeItem('hn_token'); } catch (e) { } $$('.modal-wrap').forEach(function (m) { m.remove(); }); showLogin(msg); }
function logout() { if (S.token) api('logout', {}).catch(function () { }); sessionEnd(''); }


/* ================================================================ ไอคอนเส้น (SVG ในตัว ไม่โหลดภายนอก) */
var ICP = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14c2.2.6 3.5 2.8 3.5 6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V4.5"/><path d="M8 7h8M8 11h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
  printer: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h4M14 13h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'
};
function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICP[name] || '') + '</svg>'; }

/* ================================================================ เริ่มระบบ / เมนู */
var ROUTES = {};
function route(name, fn) { ROUTES[name] = fn; }
function navItems() {
  var b = S.boot, it = [{ k: 'home', l: 'ภาพรวม', ic: 'home' }];
  if (b.me.hasProfile) it.push({ k: 'me', l: 'ข้อมูลของฉัน', ic: 'user' });
  if (b.can.staff) it.push({ sec: 'บุคลากร' }, { k: 'people', l: 'ทะเบียนบุคลากร', ic: 'users' }, { k: 'training', l: 'การอบรม', ic: 'book' }, { k: 'attendance', l: 'ขาด ลา มาสาย', ic: 'clock' });
  it.push({ k: 'requests', l: 'คำขอแก้ไข', ic: 'inbox', badge: b.pending || 0 });
  if (b.can.staff || b.can.edit || b.can.office) it.push({ sec: 'เครื่องมือ' });
  if (b.can.staff) it.push({ k: 'reports', l: 'รายงานและพิมพ์', ic: 'printer' });
  if (b.can.edit) it.push({ k: 'import', l: 'นำเข้าข้อมูล', ic: 'upload' });
  if (b.can.office) it.push({ k: 'admin', l: 'ตั้งค่าระบบ', ic: 'settings' });
  return it;
}
function startApp(boot, home) {
  if (boot.me && boot.me.mustChange) { showLogin(''); showChangePassword(true); return; }
  S.boot = boot; S.me = boot.me; S.dv = boot.dv;
  if (home) { var k = mkey('getDashboard', {}); MEMO[k] = home; MEMO_T[k] = Date.now(); pcSet(k, home); }
  document.body.className = '';
  $('#app').innerHTML =
    '<header class="top"><button class="icon-btn menu-btn" id="menuBtn" aria-label="เมนู">' + ic('menu') + '</button>' +
    '<a class="brand" href="#/home"><span class="nso-mark sm">NSO</span><span class="brand-t"><b>HRMi for NSO</b><small>ฝ่ายการพยาบาล</small></span></a><span class="sp"></span>' +
    '<button class="user-btn" id="userBtn" aria-haspopup="true"><span class="avatar">' + esc((S.me.fullName.replace(/^(นาย|นางสาว|นาง)\s*/, '') || '?').charAt(0)) + '</span><span class="user-t"><b>' + esc(S.me.fullName) + '</b><small>' + esc(S.me.roleNames.filter(function (x, i) { return i > 0 || S.me.roles.length === 1; }).join(' · ')) + '</small></span></button></header>' +
    '<div id="netbar" class="netbar"></div><div class="shell"><nav class="side" id="side" aria-label="เมนูหลัก"></nav><main id="view" tabindex="-1"></main></div><div class="scrim" id="scrim"></div>';
  drawNav();
  $('#menuBtn').onclick = function () { document.body.classList.toggle('nav-open'); };
  $('#scrim').onclick = function () { document.body.classList.remove('nav-open'); };
  $('#userBtn').onclick = userMenu;
  window.onhashchange = render;
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/home'; else render();
  checkVersion(); setInterval(checkVersion, 600000);
}
function drawNav() {
  var cur = (S.route || {}).name;
  $('#side').innerHTML = navItems().map(function (n) {
    if (n.sec) return '<div class="nav-sec">' + esc(n.sec) + '</div>';
    return '<a href="#/' + n.k + '" class="nav' + (cur === n.k || (cur === 'person' && n.k === 'people') ? ' on' : '') + '">' + ic(n.ic, 'nav-ic') + '<span>' + esc(n.l) + '</span>' + (n.badge ? '<span class="badge">' + n.badge + '</span>' : '') + '</a>';
  }).join('') + '<div class="side-foot muted small">' + esc(S.boot.app.org) + '<br>v' + APP_VERSION + ' · ' + APP_BUILD_TH + '</div>';
}
function userMenu() {
  modal({ title: S.me.fullName, body: '<p>รหัสพนักงาน <b>' + esc(S.me.empCode) + '</b>' + (S.me.wardCode ? ' · ' + esc(S.me.wardCode + ' ' + S.me.wardName) : '') + '</p>' +
    '<p class="muted">บทบาท: ' + esc(S.me.roleNames.join(', ')) + '</p>' +
    (S.boot.editWards && S.boot.editWards.length ? '<p class="muted">หอที่รับผิดชอบ: ' + esc(S.boot.editWards.join(', ')) + '</p>' : '') +
    (S.me.divs.length ? '<p class="muted">ส่วนงานที่มอบหมาย: ' + esc(S.me.divs.join(', ')) + '</p>' : ''),
    actions: [{ label: 'เปลี่ยนรหัสผ่าน', onClick: function (close) { close(); showChangePassword(false); } }, { label: 'ออกจากระบบ', kind: 'danger', onClick: function (close) { close(); logout(); } }], cancel: 'ปิด' });
}
function parseHash() {
  var h = location.hash.replace(/^#\/?/, ''), qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, q = {};
  if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) q[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
  var parts = path.split('/'); return { name: parts[0] || 'home', arg: parts[1] || '', q: q };
}
function render() {
  if (!S.boot) return;
  var r = parseHash(); S.route = r; S.navId++; drawNav(); document.body.classList.remove('nav-open');
  var fn = ROUTES[r.name] || ROUTES.home, v = $('#view');
  v.innerHTML = skeleton(5); window.scrollTo(0, 0);
  try { fn(v, r); } catch (e) { fail(e); v.innerHTML = empty('เปิดหน้านี้ไม่ได้', esc(e.message)); }
  setTimeout(function () { try { v.focus({ preventScroll: true }); } catch (e) { } }, 0);
}
function pageHead(title, sub, actions) {
  return '<div class="ph"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div><div class="ph-a">' + (actions || '') + '</div></div>';
}
function checkVersion() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
    if (v.build && v.build !== APP_BUILD && !$('#verbar')) {
      var d = document.createElement('div'); d.id = 'verbar'; d.className = 'verbar';
      d.innerHTML = 'มีระบบรุ่นใหม่ (build ' + esc(v.build) + ') <button class="btn sm">โหลดใหม่</button>'; $('button', d).onclick = function () { location.reload(); }; document.body.appendChild(d);
    }
  }).catch(function () { });
  if (S.token) rawCall('ping', {}).then(function (r) {
    if (r.ok && r.data.build !== APP_BUILD && !$('#bebar')) { var d = document.createElement('div'); d.id = 'bebar'; d.className = 'verbar warn'; d.textContent = 'หลังบ้านเป็น build ' + r.data.build + ' แต่หน้าเว็บเป็น ' + APP_BUILD + ' — ผู้ดูแลระบบต้อง Deploy New version'; document.body.appendChild(d); }
  }).catch(function () { });
}

/* ================================================================ เริ่มต้น */
document.addEventListener('DOMContentLoaded', function () {
  var tok = null; try { tok = localStorage.getItem('hn_token'); } catch (e) { }
  if (!tok) { showLogin(''); return; }
  S.token = tok;
  $('#app').innerHTML = '<div class="boot"><span class="nso-mark">NSO</span><p>กำลังเปิดระบบ…</p><div class="login-bar on"><span></span></div></div>';
  api('boot', {}, { keep: true }).then(function (b) { startApp(b.boot, b.home); }).catch(function (e) { if (e.code !== 'UNAUTHORIZED') showLogin(e.code === 'MUST_CHANGE' ? '' : e.message); });
});
