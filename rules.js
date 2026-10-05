/**
 * Rules.gs — กฎคำนวณกลาง (Single Source of Truth) ของ HRMi for NSO
 * ไฟล์นี้ใช้ "เนื้อหาเดียวกัน" ทั้งหลังบ้าน (Rules.gs) และหน้าเว็บ (rules.js)
 * ห้ามเรียก API ของ Google ในไฟล์นี้ · แก้ที่ใดต้องคัดลอกไปอีกที่ด้วย (ชุดทดสอบตรวจว่าเหมือนกัน)
 *
 * วันที่เก็บเป็น ISO ค.ศ. 'yyyy-MM-dd' เสมอ · แสดงผลเป็น พ.ศ.
 */
var R = (function () {
  var MONTH_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var MONTH_L = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  /** ระดับประสบการณ์ (สเปก 7.1) — เกณฑ์เป็น "มากกว่า" ปี ตามตาราง: 0–1, >1–3, >3–5, >5–10, >10 */
  var LEVELS = [
    { level: 1, name: 'Novice', th: 'ผู้เริ่มต้น', max: 12 },
    { level: 2, name: 'Advanced Beginner', th: 'ผู้เริ่มมีประสบการณ์', max: 36 },
    { level: 3, name: 'Competent', th: 'ผู้มีความสามารถ', max: 60 },
    { level: 4, name: 'Proficient', th: 'ผู้ชำนาญ', max: 120 },
    { level: 5, name: 'Expert', th: 'ผู้เชี่ยวชาญ', max: Infinity }
  ];
  /** ตาราง 2.1: ระดับ ↔ ขั้นที่คาดหมาย (ใช้แสดง "ข้อสังเกต" เท่านั้น ไม่บล็อก) */
  var EXPECT = { 1: ['C3'], 2: ['C4'], 3: ['C5'], 4: ['C6', 'C7'], 5: ['C8', 'C9'] };
  var STEPS = ['C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];

  function pad(n) { return ('0' + n).slice(-2); }
  function isIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function validDate(iso) {
    if (!isIso(iso)) return false;
    var a = iso.split('-').map(Number), d = new Date(a[0], a[1] - 1, a[2]);
    return d.getFullYear() === a[0] && d.getMonth() === a[1] - 1 && d.getDate() === a[2];
  }
  function todayIso(now) { var d = now || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /** จำนวนเดือนเต็มระหว่างสองวัน (ISO) */
  function monthsBetween(fromIso, toIso) {
    if (!validDate(fromIso) || !validDate(toIso)) return null;
    var a = fromIso.split('-').map(Number), b = toIso.split('-').map(Number);
    var m = (b[0] - a[0]) * 12 + (b[1] - a[1]);
    if (b[2] < a[2]) m--;
    return m < 0 ? null : m;
  }
  function serviceText(months) {
    if (months == null) return '-';
    var y = Math.floor(months / 12), m = months % 12;
    return (y ? y + ' ปี ' : '') + (m || !y ? m + ' เดือน' : '').trim();
  }
  function levelOf(months) {
    if (months == null) return null;
    for (var i = 0; i < LEVELS.length; i++) if (months <= LEVELS[i].max) return LEVELS[i];
    return LEVELS[4];
  }

  /** ★ ขั้นการทำงาน (สเปก 7.4–7.5): ปีปัจจุบัน พ.ศ. − ปีที่ได้ ; > เกณฑ์ = ★ */
  function stepInfo(stepCode, stepYear, nowBE, threshold) {
    if (!stepCode) return { has: false };
    var y = +stepYear, out = { has: true, step: stepCode, year: y || '', years: null, alert: false, error: '' };
    if (!y) { out.error = 'ยังไม่ระบุปีที่ได้'; return out; }
    if (y < 2400 || y > 2700) { out.error = 'ปีต้องเป็น พ.ศ. 4 หลัก'; return out; }
    if (y > nowBE) { out.error = 'ปีที่ได้มากกว่าปีปัจจุบัน'; return out; }
    out.years = nowBE - y;
    out.alert = out.years > (threshold == null ? 2 : +threshold);
    return out;
  }
  function stepMismatch(level, stepCode) {
    if (!level || !stepCode || !EXPECT[level]) return '';
    return EXPECT[level].indexOf(stepCode) >= 0 ? '' : 'ขั้น ' + stepCode + ' ไม่ตรงกับระดับ ' + LEVELS[level - 1].name + ' (ตาราง 2.1 คาดหมาย ' + EXPECT[level].join('–') + ')';
  }

  function validEmpCode(s) { return /^\d{7}$/.test(String(s || '').trim()); }
  function validEmail(s) { return !s || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim()); }
  function validPhone(s) { return !s || /^[0-9\-\s+]{9,15}$/.test(String(s).trim()); }

  function beYear(iso) { return isIso(iso) ? +iso.slice(0, 4) + 543 : ''; }
  function thaiDate(iso) {
    if (!isIso(iso)) return iso ? String(iso) : '-';
    var a = iso.split('-'); return (+a[2]) + ' ' + MONTH_S[+a[1] - 1] + ' ' + (+a[0] + 543);
  }
  function thaiDateLong(iso) {
    if (!isIso(iso)) return '-';
    var a = iso.split('-'); return (+a[2]) + ' ' + MONTH_L[+a[1] - 1] + ' พ.ศ. ' + (+a[0] + 543);
  }
  function ymTh(ym) { var a = String(ym).split('-'); return MONTH_S[+a[1] - 1] + ' ' + String(+a[0] + 543).slice(-2); }
  function ymThLong(ym) { var a = String(ym).split('-'); return MONTH_L[+a[1] - 1] + ' ' + (+a[0] + 543); }

  /**
   * แปลงวันที่จากไฟล์นำเข้า → ISO ค.ศ.
   * รับ: 'dd/mm/yyyy' (พ.ศ. หรือ ค.ศ.) · 'yyyy-mm-dd' · เลขวันที่ของ Excel · 'd/m/yy' (พ.ศ. 2 หลัก)
   */
  function parseDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v))) {
      var ms = Math.round((+v - 25569) * 86400000), d = new Date(ms);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      var y0 = +m[1]; if (y0 > 2400) y0 -= 543;
      var iso0 = y0 + '-' + pad(+m[2]) + '-' + pad(+m[3]);
      return validDate(iso0) ? iso0 : '';
    }
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
      var y = +m[3];
      if (y < 100) y += 2500;           // 2 หลักถือเป็น พ.ศ. (69 → 2569)
      if (y > 2400) y -= 543;
      var iso = y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
      return validDate(iso) ? iso : '';
    }
    return '';
  }
  function parseYearBE(v) {
    var y = parseInt(String(v == null ? '' : v).trim(), 10);
    if (!y) return '';
    if (y < 2400 && y > 1900) y += 543;
    return y;
  }

  /** ปีงบประมาณ พ.ศ. (เริ่ม 1 ต.ค.) */
  function fiscalYear(iso) { var y = +String(iso).slice(0, 4), mo = +String(iso).slice(5, 7); return (mo >= 10 ? y + 1 : y) + 543; }
  function fyMonths(fyBE) {
    var y = fyBE - 543, out = [];
    for (var i = 0; i < 12; i++) { var mo = 10 + i, yy = y - 1; if (mo > 12) { mo -= 12; yy = y; } out.push(yy + '-' + pad(mo)); }
    return out;
  }

  /** ประเภทขาด/ลา/สาย จากค่าตั้งค่า 'CODE:ชื่อ:unit|...' */
  function leaveTypes(str) {
    return String(str || '').split('|').map(function (x) {
      var a = x.split(':'); return { code: (a[0] || '').trim(), name: (a[1] || '').trim(), unit: (a[2] || 'day').trim() };
    }).filter(function (t) { return t.code; });
  }

  function fullName(p) { return [p.title, p.firstName, p.lastName].filter(function (x) { return x; }).join(' '); }

  return {
    LEVELS: LEVELS, EXPECT: EXPECT, STEPS: STEPS, MONTH_S: MONTH_S, MONTH_L: MONTH_L,
    isIso: isIso, validDate: validDate, todayIso: todayIso, monthsBetween: monthsBetween, serviceText: serviceText,
    levelOf: levelOf, stepInfo: stepInfo, stepMismatch: stepMismatch,
    validEmpCode: validEmpCode, validEmail: validEmail, validPhone: validPhone,
    beYear: beYear, thaiDate: thaiDate, thaiDateLong: thaiDateLong, ymTh: ymTh, ymThLong: ymThLong,
    parseDate: parseDate, parseYearBE: parseYearBE, fiscalYear: fiscalYear, fyMonths: fyMonths,
    leaveTypes: leaveTypes, fullName: fullName
  };
})();
