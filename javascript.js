/**
 * javascript.js — แกนกลางหน้าเว็บ HRMi for NSO
 * เครือข่าย (ไม่มี preflight · จำกัด 4 คำขอ · ลองซ้ำเฉพาะคำสั่งอ่าน) · แคช SWR · ล็อกอินรอบเดียว · เมนู/เส้นทาง · ชิ้นส่วน UI
 * ⚠ BUILD ต้องตรง 3 ที่: Config.gs · javascript.js (APP_BUILD) · version.json
 */
var APP_BUILD = '2569-10-05.1', APP_BUILD_TH = '5 ต.ค. 2569', APP_VERSION = '1.2569';
var S = { token: null, boot: null, me: null, dv: null, route: null, busy: 0 };

/* ================================================================ เครือข่าย */
var NET = { active: 0, queue: [], MAX: 4 };
function netSlot() { return new Promise(function (res) { if (NET.active < NET.MAX) { NET.active++; res(); } else NET.queue.push(res); }); }
function netDone() { var n = NET.queue.shift(); if (n) n(); else NET.active = Math.max(0, NET.active - 1); }
function isRead(a) { return /^(get|list|bootstrap|ping|suggest|preview)/.test(a); }
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
  return rawCall(action, payload).then(function (res) {
    busy(-1);
    if (res.dv && S.dv && res.dv !== S.dv) { var keep = MEMO[k]; cacheClear(); if (keep) MEMO[k] = keep; }
    if (res.dv) S.dv = res.dv;
    if (res.ok) { if (read && opt.fresh) { MEMO[k] = res.data; MEMO_T[k] = Date.now(); pcSet(k, res.data); } return res.data; }
    if (res.code === 'UNAUTHORIZED') { sessionEnd('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง'); }
    if (res.code === 'MUST_CHANGE') { showChangePassword(true); }
    var e = new Error(res.error || 'เกิดข้อผิดพลาด'); e.code = res.code; throw e;
  }, function (e) { busy(-1); throw e; });
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
      if (!list.length) { pop.innerHTML = '<div class="pp-item muted">ไม่พบ</div>'; }
      else pop.innerHTML = list.map(function (p, i) { return '<button type="button" class="pp-item" data-k="' + i + '"><b>' + esc(p.empCode) + '</b> ' + esc(p.fullName) + ' <span class="muted">' + esc(p.wardCode + ' · ' + p.positionName) + '</span></button>'; }).join('');
      place(); pop.hidden = false;
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

/* ================================================================ เริ่มระบบ / เมนู */
var ROUTES = {};
function route(name, fn) { ROUTES[name] = fn; }
function navItems() {
  var b = S.boot, it = [{ k: 'home', l: 'หน้าแรก', ic: '⌂' }];
  if (b.me.hasProfile) it.push({ k: 'me', l: 'ข้อมูลของฉัน', ic: '☺' });
  if (b.can.staff) it.push({ k: 'people', l: 'บุคลากร', ic: '☷' }, { k: 'training', l: 'การอบรม', ic: '✎' }, { k: 'attendance', l: 'ขาด ลา มาสาย', ic: '◷' });
  it.push({ k: 'requests', l: 'คำขอแก้ไข', ic: '✉', badge: b.pending || 0 });
  if (b.can.staff) it.push({ k: 'reports', l: 'รายงานและพิมพ์', ic: '⎙' });
  if (b.can.edit) it.push({ k: 'import', l: 'นำเข้าข้อมูล', ic: '⇪' });
  if (b.can.office) it.push({ k: 'admin', l: 'ตั้งค่าระบบ', ic: '⚙' });
  return it;
}
function startApp(boot, home) {
  if (boot.me && boot.me.mustChange) { showLogin(''); showChangePassword(true); return; }
  S.boot = boot; S.me = boot.me; S.dv = boot.dv;
  if (home) { var k = mkey('getDashboard', {}); MEMO[k] = home; MEMO_T[k] = Date.now(); pcSet(k, home); }
  document.body.className = '';
  $('#app').innerHTML =
    '<header class="top"><button class="icon-btn menu-btn" id="menuBtn" aria-label="เมนู">☰</button>' +
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
    return '<a href="#/' + n.k + '" class="nav' + (cur === n.k || (cur === 'person' && n.k === 'people') ? ' on' : '') + '"><span class="nav-ic" aria-hidden="true">' + n.ic + '</span><span>' + esc(n.l) + '</span>' + (n.badge ? '<span class="badge">' + n.badge + '</span>' : '') + '</a>';
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
  var r = parseHash(); S.route = r; drawNav(); document.body.classList.remove('nav-open');
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
  api('bootstrap', {}).then(function (b) { startApp(b, null); }).catch(function (e) { if (e.code !== 'UNAUTHORIZED') showLogin(e.code === 'MUST_CHANGE' ? '' : e.message); });
});
