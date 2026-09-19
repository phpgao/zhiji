/**
 * 知集 (ZhiJi) — ZipBuilder 内联 ZIP 生成器 (STORE 模式，纯 JS 无外部依赖)
 */

const ZipBuilder = (() => {
  function crc32(buf) {
    let table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
      }
    }
    let val = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) val = (val >>> 8) ^ table[(val ^ buf[i]) & 0xFF];
    return (val ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(d = new Date()) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  class Builder {
    constructor() {
      this.files = [];
    }

    add(filename, content) {
      let data;
      if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
      } else if (content instanceof ArrayBuffer) {
        data = new Uint8Array(content);
      } else if (content instanceof Uint8Array) {
        data = content;
      } else {
        throw new Error('Unsupported content type');
      }
      this.files.push({ name: filename, data, crc: crc32(data) });
      return this;
    }

    generate() {
      const parts = [];
      const central = [];
      let offset = 0;
      const dt = dosDateTime();

      for (const f of this.files) {
        const nameBytes = new TextEncoder().encode(f.name);
        const headerSize = 30 + nameBytes.length;

        // Local header
        const lh = new ArrayBuffer(headerSize);
        const lv = new DataView(lh);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);          // UTF-8
        lv.setUint16(8, 0, true);               // STORE
        lv.setUint16(10, dt.time, true);
        lv.setUint16(12, dt.date, true);
        lv.setUint32(14, f.crc, true);
        lv.setUint32(18, f.data.length, true);  // compressed
        lv.setUint32(22, f.data.length, true);  // uncompressed
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        new Uint8Array(lh).set(nameBytes, 30);

        parts.push(new Uint8Array(lh));
        parts.push(f.data);

        // Central directory header
        const cb = 46 + nameBytes.length;
        const ch = new ArrayBuffer(cb);
        const cv = new DataView(ch);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, dt.time, true);
        cv.setUint16(14, dt.date, true);
        cv.setUint32(16, f.crc, true);
        cv.setUint32(20, f.data.length, true);
        cv.setUint32(24, f.data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0x20, true);           // external attr
        cv.setUint32(42, offset, true);          // local header offset
        new Uint8Array(ch).set(nameBytes, 46);
        central.push(new Uint8Array(ch));

        offset += headerSize + f.data.length;
      }

      const centralOffset = offset;
      let centralSize = 0;
      for (const c of central) centralSize += c.length;

      // End of central directory
      const end = new ArrayBuffer(22);
      const ev = new DataView(end);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, this.files.length, true);
      ev.setUint16(10, this.files.length, true);
      ev.setUint32(12, centralSize, true);
      ev.setUint32(16, centralOffset, true);
      ev.setUint16(20, 0, true);

      return new Blob([...parts, ...central, new Uint8Array(end)], { type: 'application/zip' });
    }
  }

  return { create: () => new Builder() };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZipBuilder };
}
