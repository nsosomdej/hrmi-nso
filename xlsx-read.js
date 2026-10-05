/**
 * xlsx-read.js — ตัวอ่านไฟล์ Excel (.xlsx) และ CSV ขนาดเล็ก ไม่พึ่งไลบรารีภายนอก/CDN
 * ใช้ DecompressionStream('deflate-raw') ของเบราว์เซอร์ (Chrome/Edge 103+, Safari 16.4+, Firefox 113+)
 * XlsxRead.read(file) → Promise<{ sheets: { ชื่อชีท: [[ค่า, …], …] }, order: [ชื่อชีท…] }>
 * ค่าตัวเลข (รวมวันที่แบบตัวเลขของ Excel) คืนเป็น number · ข้อความคืนเป็น string
 */
var XlsxRead = (function () {
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function utf8(b) { return new TextDecoder('utf-8').decode(b); }
  function inflate(data) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('เบราว์เซอร์นี้อ่านไฟล์ .xlsx ไม่ได้ — กรุณาใช้ Chrome/Edge รุ่นใหม่ หรือบันทึกไฟล์เป็น .csv'));
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(data); w.close();
    return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  /** อ่านสารบัญ zip แล้วคืนฟังก์ชันดึงไฟล์ตามชื่อ */
  function unzip(buf) {
    var b = new Uint8Array(buf), eocd = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('ไฟล์ไม่ใช่ .xlsx ที่ถูกต้อง');
    var n = u16(b, eocd + 10), off = u32(b, eocd + 16), files = {};
    for (var k = 0; k < n; k++) {
      if (u32(b, off) !== 0x02014b50) break;
      var method = u16(b, off + 10), csize = u32(b, off + 20), nlen = u16(b, off + 28), xlen = u16(b, off + 30), clen = u16(b, off + 32), lho = u32(b, off + 42);
      var name = utf8(b.subarray(off + 46, off + 46 + nlen));
      files[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nlen + xlen + clen;
    }
    return function (name) {
      var f = files[name]; if (!f) return Promise.resolve(null);
      var start = f.lho + 30 + u16(b, f.lho + 26) + u16(b, f.lho + 28), data = b.subarray(start, start + f.csize);
      return (f.method === 0 ? Promise.resolve(data) : inflate(data)).then(utf8);
    };
  }
  function xmlDoc(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function byTag(node, tag) { return Array.prototype.slice.call(node.getElementsByTagNameNS('*', tag)); }
  function colIndex(ref) { var m = String(ref).match(/^([A-Z]+)/), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
  function readXlsx(buf) {
    var get = unzip(buf);
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml')]).then(function (a) {
      if (!a[0]) throw new Error('ไม่พบข้อมูลชีทในไฟล์');
      var wb = xmlDoc(a[0]), rels = xmlDoc(a[1] || '<r/>'), ss = [];
      if (a[2]) byTag(xmlDoc(a[2]), 'si').forEach(function (si) { ss.push(byTag(si, 't').map(function (t) { return t.textContent; }).join('')); });
      var target = {}; byTag(rels, 'Relationship').forEach(function (r) { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
      var sheets = byTag(wb, 'sheet').map(function (s) {
        var rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), t = target[rid] || '';
        t = t.replace(/^\/?xl\//, ''); return { name: s.getAttribute('name'), path: 'xl/' + t.replace(/^\//, '') };
      });
      return Promise.all(sheets.map(function (s) { return get(s.path); })).then(function (xs) {
        var out = { sheets: {}, order: [] };
        xs.forEach(function (x, i) {
          if (!x) return;
          var rows = [];
          byTag(xmlDoc(x), 'row').forEach(function (r) {
            var ri = +r.getAttribute('r') - 1, row = [];
            byTag(r, 'c').forEach(function (c) {
              var ci = colIndex(c.getAttribute('r')), t = c.getAttribute('t'), v = byTag(c, 'v')[0], val = '';
              if (t === 's') val = v ? ss[+v.textContent] || '' : '';
              else if (t === 'inlineStr') val = byTag(c, 't').map(function (e) { return e.textContent; }).join('');
              else if (t === 'str' || t === 'b' || t === 'e') val = v ? v.textContent : '';
              else if (v) { var num = Number(v.textContent); val = isNaN(num) ? v.textContent : num; }
              if (ci >= 0) row[ci] = val;
            });
            for (var j = 0; j < row.length; j++) if (row[j] === undefined) row[j] = '';
            rows[ri >= 0 ? ri : rows.length] = row;
          });
          for (var k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
          out.sheets[sheets[i].name] = rows; out.order.push(sheets[i].name);
        });
        return out;
      });
    });
  }
  function readCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return { sheets: { 'ข้อมูล': rows }, order: ['ข้อมูล'] };
  }
  function read(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(), isCsv = /\.csv$/i.test(file.name);
      fr.onload = function () { try { if (isCsv) res(readCsv(fr.result)); else readXlsx(fr.result).then(res, rej); } catch (e) { rej(e); } };
      fr.onerror = function () { rej(new Error('อ่านไฟล์ไม่สำเร็จ')); };
      if (isCsv) fr.readAsText(file, 'utf-8'); else if (/\.xls$/i.test(file.name)) rej(new Error('ไฟล์ .xls รุ่นเก่า — กรุณาเปิดใน Excel แล้ว "บันทึกเป็น" .xlsx')); else fr.readAsArrayBuffer(file);
    });
  }
  return { read: read, readCsv: readCsv };
})();
