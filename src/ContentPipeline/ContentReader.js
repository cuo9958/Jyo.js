﻿(function (window, document, Jyo, undefined) {
    "use strict";

    // Xna程序集
    var xnaAssemblies = [
        ", Version=1.0.0.0, Culture=neutral, PublicKeyToken=6d5c3888ef60e27d",
        ", Version=2.0.0.0, Culture=neutral, PublicKeyToken=6d5c3888ef60e27d",
        ", Version=3.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089",
        ", Version=3.1.0.0, Culture=neutral, PublicKeyToken=6d5c3888ef60e27d",
        ", Version=4.0.0.0, Culture=neutral, PublicKeyToken=842cf8be1de50553"
    ];

    // Xna版本集
    var xnaVersions = ["Xna1.0", "Xna2.0", "Xna3.0", "Xna3.1", "Xna4.0"];

    // 目标平台集
    var targetPlatforms = [
        // Xna支持平台
        { tag: "w", platforms: "Windows" },
        { tag: "m", platforms: "Windows Phone 7" },
        { tag: "x", platforms: "Xbox360" },

        // MonoGame扩展平台
        { tag: "i", platforms: "IOS" },
        { tag: "a", platforms: "Android" },
        { tag: "W", platforms: "Windows Store Apps" },
        { tag: "M", platforms: "Windows Phone 8" },
        { tag: "g", platforms: "Windows OpenGL" },
        { tag: "d", platforms: "Windows DirectX11" },
        { tag: "X", platforms: "MacOS X" },
        { tag: "l", platforms: "Linux" },
        { tag: "p", platforms: "PlayStation Mobile" },
        { tag: "P", platforms: "PlayStation4" },
        { tag: "u", platforms: "Ouya" },
        { tag: "n", platforms: "Google Chrome Native Client" },
        { tag: "r", platforms: "RaspberryPi" },

        // 自定义扩展平台
        { tag: "0", platforms: "Cutsom" }
    ];

    Jyo.ContentManager.ContentReader = function (content, filename, renderer, callback) {
        /// <summary>通过内容管道读取资源文件</summary>
        /// <param name="content" type="Jyo.ContentManager">资源管理器</param>
        /// <param name="filename" type="String">文件名</param>
        /// <param name="renderer" type="Jyo.Renderer">要绑定的渲染器对象</param>
        /// <param name="callback" type="Function">回调函数</param>

        var xnb = new Jyo.Xnb();

        Jyo.loadFile(filename, false, "arraybuffer", function (arr) {
            /// <param name="arr" type="ArrayType">读取到的二进制数据</param>

            var r = arr;
            arr = new DataView(arr);

            // 文件名
            xnb.filename = filename.split("?")[0];

            // 判断文件头
            if (arr.getString(0, 3) !== "XNB") throw String.format("\"{0}\"不是有效的Xnb文件", filename);

            // 获取目标平台
            xnb.targetPlatform = arr.getString(3, 1);
            for (var i = 0; i < targetPlatforms.length; i++) {
                if (targetPlatforms[i].tag == xnb.targetPlatform) {
                    xnb.targetPlatform = targetPlatforms[i].platforms;
                    break;
                }
            }

            // Xna版本
            xnb.xnaVersion = xnaVersions[arr.getUint8(4) - 1];

            // 压缩模式
            xnb.compressionMode = arr.getUint8(5);

            // 文件大小
            xnb.sourceFileSize = arr.getUint32(6);

            // 数据偏移量
            // 必须根据以下情况赋值
            // null则触发异常
            var dataOffset = null;

            switch (xnb.compressionMode) {
                case 0x00:
                case 0x01:
                    // 未压缩数据解析

                    // 类型读取器数量
                    xnb.typeReaderCount = arr.getUint8(10);

                    var typeReaders = [];

                    // 获取类型读取器字符串长度及偏移量
                    var typeReaderStrLen = arr.getUint8(11);

                    typeReaders.push(arr.getString(13, typeReaderStrLen));

                    dataOffset = 13 + typeReaderStrLen;

                    dataOffset += 1;
                    if (xnb.typeReaderCount > 1) {
                        dataOffset += 4;
                        for (var i = 1; i < xnb.typeReaderCount; i++) {
                            for (var n = dataOffset; ; n++) {
                                if (arr.getUint32(n) == 0) {
                                    break;
                                }
                            }
                            typeReaders.push(arr.getString(dataOffset, n - dataOffset));
                            dataOffset += (n - dataOffset + 4);
                        }
                    }

                    xnb.typeReaders = typeReaders;
                    break;
                case 0x40:
                case 0x41:
                    // LZ4格式压缩数据

                    throw "Unsupported compression mode";
                    break;
                case 0x60:
                case 0x61:
                    // Deflate格式压缩数据

                    // 未压缩的文件大小
                    xnb.uncompressedFileSize = arr.getUint32(10);

                    // 类型读取器数量
                    xnb.typeReaderCount = arr.getUint8(14);

                    var typeReaders = [];

                    // 获取类型读取器字符串长度及偏移量
                    var typeReaderStrLen = arr.getUint8(15);

                    typeReaders.push(arr.getString(17, typeReaderStrLen));

                    dataOffset = 17 + typeReaderStrLen + 4;

                    if (xnb.typeReaderCount > 1) {
                        for (var i = 1; i < xnb.typeReaderCount; i++) {
                            for (var n = dataOffset; ; n++) {
                                if (arr.getUint32(n) == 0) {
                                    break;
                                }
                            }
                            typeReaders.push(arr.getString(dataOffset, n - dataOffset));
                            dataOffset += (n - dataOffset + 4);
                        }
                    }

                    xnb.typeReaders = typeReaders;

                    dataOffset += 4;
                    var er = new Uint8Array(r, dataOffset, xnb.sourceFileSize - dataOffset);
                    var e = uncompress.inflateRaw(er);

                    arr = new DataView(e.buffer);

                    dataOffset = 0;
                    break;
                case 0x80:
                case 0x81:
                    // LZX格式压缩数据

                    throw "Unsupported compression mode";
                default:
                    // 未知

                    throw "Unkonw compression mode";
            }

            // 内容数量暂时始终为1
            xnb.contentCount = 1;

            var cr;
            breakReader: for (var i in Jyo.ContentManager) {
                cr = Jyo.ContentManager[i];
                for (var n = 0; n < xnb.typeReaders.length; n++) {
                    if (xnb.typeReaders[n].indexOf(cr.assemblies) >= 0) {
                        Jyo.ContentManager[i].read(content, xnb, arr, dataOffset, renderer, callback);
                        break breakReader;
                    }
                }
            }
        });

        return xnb;
    };

    /*
        pako - MIT License - Copyright (C) 2014 by Vitaly Puzrin
        解压缩
    */
    var uncompress = function e(t, i, n) { function a(s, o) { if (!i[s]) { if (!t[s]) { var f = "function" == typeof require && require; if (!o && f) return f(s, !0); if (r) return r(s, !0); throw new Error("Cannot find module '" + s + "'") } var l = i[s] = { exports: {} }; t[s][0].call(l.exports, function (e) { var i = t[s][1][e]; return a(i ? i : e) }, l, l.exports, e, t, i, n) } return i[s].exports } for (var r = "function" == typeof require && require, s = 0; s < n.length; s++) a(n[s]); return a }({ 1: [function (e, t, i) { "use strict"; function n(e, t) { var i = new u(t); if (i.push(e, !0), i.err) throw i.msg; return i.result } function a(e, t) { return t = t || {}, t.raw = !0, n(e, t) } var r = e("./zlib/inflate.js"), s = e("./utils/common"), o = e("./utils/strings"), f = e("./zlib/constants"), l = e("./zlib/messages"), d = e("./zlib/zstream"), h = e("./zlib/gzheader"), u = function (e) { this.options = s.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e || {}); var t = this.options; t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, 0 === t.windowBits && (t.windowBits = -15)), !(t.windowBits >= 0 && t.windowBits < 16) || e && e.windowBits || (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && 0 === (15 & t.windowBits) && (t.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new d, this.strm.avail_out = 0; var i = r.inflateInit2(this.strm, t.windowBits); if (i !== f.Z_OK) throw new Error(l[i]); this.header = new h, r.inflateGetHeader(this.strm, this.header) }; u.prototype.push = function (e, t) { var i, n, a, l, d, h = this.strm, u = this.options.chunkSize; if (this.ended) return !1; n = t === ~~t ? t : t === !0 ? f.Z_FINISH : f.Z_NO_FLUSH, h.input = "string" == typeof e ? o.binstring2buf(e) : e, h.next_in = 0, h.avail_in = h.input.length; do { if (0 === h.avail_out && (h.output = new s.Buf8(u), h.next_out = 0, h.avail_out = u), i = r.inflate(h, f.Z_NO_FLUSH), i !== f.Z_STREAM_END && i !== f.Z_OK) return this.onEnd(i), this.ended = !0, !1; h.next_out && (0 === h.avail_out || i === f.Z_STREAM_END || 0 === h.avail_in && n === f.Z_FINISH) && ("string" === this.options.to ? (a = o.utf8border(h.output, h.next_out), l = h.next_out - a, d = o.buf2string(h.output, a), h.next_out = l, h.avail_out = u - l, l && s.arraySet(h.output, h.output, a, l, 0), this.onData(d)) : this.onData(s.shrinkBuf(h.output, h.next_out))) } while (h.avail_in > 0 && i !== f.Z_STREAM_END); return i === f.Z_STREAM_END && (n = f.Z_FINISH), n === f.Z_FINISH ? (i = r.inflateEnd(this.strm), this.onEnd(i), this.ended = !0, i === f.Z_OK) : !0 }, u.prototype.onData = function (e) { this.chunks.push(e) }, u.prototype.onEnd = function (e) { e === f.Z_OK && (this.result = "string" === this.options.to ? this.chunks.join("") : s.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg }, i.Inflate = u, i.inflate = n, i.inflateRaw = a, i.ungzip = n }, { "./utils/common": 2, "./utils/strings": 3, "./zlib/constants": 5, "./zlib/gzheader": 7, "./zlib/inflate.js": 9, "./zlib/messages": 11, "./zlib/zstream": 12 }], 2: [function (e, t, i) { "use strict"; var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array; i.assign = function (e) { for (var t = Array.prototype.slice.call(arguments, 1) ; t.length;) { var i = t.shift(); if (i) { if ("object" != typeof i) throw new TypeError(i + "must be non-object"); for (var n in i) i.hasOwnProperty(n) && (e[n] = i[n]) } } return e }, i.shrinkBuf = function (e, t) { return e.length === t ? e : e.subarray ? e.subarray(0, t) : (e.length = t, e) }; var a = { arraySet: function (e, t, i, n, a) { if (t.subarray && e.subarray) return void e.set(t.subarray(i, i + n), a); for (var r = 0; n > r; r++) e[a + r] = t[i + r] }, flattenChunks: function (e) { var t, i, n, a, r, s; for (n = 0, t = 0, i = e.length; i > t; t++) n += e[t].length; for (s = new Uint8Array(n), a = 0, t = 0, i = e.length; i > t; t++) r = e[t], s.set(r, a), a += r.length; return s } }, r = { arraySet: function (e, t, i, n, a) { for (var r = 0; n > r; r++) e[a + r] = t[i + r] }, flattenChunks: function (e) { return [].concat.apply([], e) } }; i.setTyped = function (e) { e ? (i.Buf8 = Uint8Array, i.Buf16 = Uint16Array, i.Buf32 = Int32Array, i.assign(i, a)) : (i.Buf8 = Array, i.Buf16 = Array, i.Buf32 = Array, i.assign(i, r)) }, i.setTyped(n) }, {}], 3: [function (e, t, i) { "use strict"; function n(e, t) { if (65537 > t && (e.subarray && s || !e.subarray && r)) return String.fromCharCode.apply(null, a.shrinkBuf(e, t)); for (var i = "", n = 0; t > n; n++) i += String.fromCharCode(e[n]); return i } var a = e("./common"), r = !0, s = !0; try { String.fromCharCode.apply(null, [0]) } catch (o) { r = !1 } try { String.fromCharCode.apply(null, new Uint8Array(1)) } catch (o) { s = !1 } for (var f = new a.Buf8(256), l = 0; 256 > l; l++) f[l] = l >= 252 ? 6 : l >= 248 ? 5 : l >= 240 ? 4 : l >= 224 ? 3 : l >= 192 ? 2 : 1; f[254] = f[254] = 1, i.string2buf = function (e) { var t, i, n, r, s, o = e.length, f = 0; for (r = 0; o > r; r++) i = e.charCodeAt(r), 55296 === (64512 & i) && o > r + 1 && (n = e.charCodeAt(r + 1), 56320 === (64512 & n) && (i = 65536 + (i - 55296 << 10) + (n - 56320), r++)), f += 128 > i ? 1 : 2048 > i ? 2 : 65536 > i ? 3 : 4; for (t = new a.Buf8(f), s = 0, r = 0; f > s; r++) i = e.charCodeAt(r), 55296 === (64512 & i) && o > r + 1 && (n = e.charCodeAt(r + 1), 56320 === (64512 & n) && (i = 65536 + (i - 55296 << 10) + (n - 56320), r++)), 128 > i ? t[s++] = i : 2048 > i ? (t[s++] = 192 | i >>> 6, t[s++] = 128 | 63 & i) : 65536 > i ? (t[s++] = 224 | i >>> 12, t[s++] = 128 | i >>> 6 & 63, t[s++] = 128 | 63 & i) : (t[s++] = 240 | i >>> 18, t[s++] = 128 | i >>> 12 & 63, t[s++] = 128 | i >>> 6 & 63, t[s++] = 128 | 63 & i); return t }, i.buf2binstring = function (e) { return n(e, e.length) }, i.binstring2buf = function (e) { for (var t = new a.Buf8(e.length), i = 0, n = t.length; n > i; i++) t[i] = e.charCodeAt(i); return t }, i.buf2string = function (e, t) { var i, a, r, s, o = t || e.length, l = new Array(2 * o); for (a = 0, i = 0; o > i;) if (r = e[i++], 128 > r) l[a++] = r; else if (s = f[r], s > 4) l[a++] = 65533, i += s - 1; else { for (r &= 2 === s ? 31 : 3 === s ? 15 : 7; s > 1 && o > i;) r = r << 6 | 63 & e[i++], s--; s > 1 ? l[a++] = 65533 : 65536 > r ? l[a++] = r : (r -= 65536, l[a++] = 55296 | r >> 10 & 1023, l[a++] = 56320 | 1023 & r) } return n(l, a) }, i.utf8border = function (e, t) { var i; for (t = t || e.length, t > e.length && (t = e.length), i = t - 1; i >= 0 && 128 === (192 & e[i]) ;) i--; return 0 > i ? t : 0 === i ? t : i + f[e[i]] > t ? i : t } }, { "./common": 2 }], 4: [function (e, t) { "use strict"; function i(e, t, i, n) { for (var a = 65535 & e | 0, r = e >>> 16 & 65535 | 0, s = 0; 0 !== i;) { s = i > 2e3 ? 2e3 : i, i -= s; do a = a + t[n++] | 0, r = r + a | 0; while (--s); a %= 65521, r %= 65521 } return a | r << 16 | 0 } t.exports = i }, {}], 5: [function (e, t) { t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 } }, {}], 6: [function (e, t) { "use strict"; function i() { for (var e, t = [], i = 0; 256 > i; i++) { e = i; for (var n = 0; 8 > n; n++) e = 1 & e ? 3988292384 ^ e >>> 1 : e >>> 1; t[i] = e } return t } function n(e, t, i, n) { var r = a, s = n + i; e = -1 ^ e; for (var o = n; s > o; o++) e = e >>> 8 ^ r[255 & (e ^ t[o])]; return -1 ^ e } var a = i(); t.exports = n }, {}], 7: [function (e, t) { "use strict"; function i() { this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1 } t.exports = i }, {}], 8: [function (e, t) { "use strict"; var i = 30, n = 12; t.exports = function (e, t) { var a, r, s, o, f, l, d, h, u, c, b, w, m, k, g, _, v, p, x, y, S, B, E, Z, A; a = e.state, r = e.next_in, Z = e.input, s = r + (e.avail_in - 5), o = e.next_out, A = e.output, f = o - (t - e.avail_out), l = o + (e.avail_out - 257), d = a.dmax, h = a.wsize, u = a.whave, c = a.wnext, b = a.window, w = a.hold, m = a.bits, k = a.lencode, g = a.distcode, _ = (1 << a.lenbits) - 1, v = (1 << a.distbits) - 1; e: do { 15 > m && (w += Z[r++] << m, m += 8, w += Z[r++] << m, m += 8), p = k[w & _]; t: for (; ;) { if (x = p >>> 24, w >>>= x, m -= x, x = p >>> 16 & 255, 0 === x) A[o++] = 65535 & p; else { if (!(16 & x)) { if (0 === (64 & x)) { p = k[(65535 & p) + (w & (1 << x) - 1)]; continue t } if (32 & x) { a.mode = n; break e } e.msg = "invalid literal/length code", a.mode = i; break e } y = 65535 & p, x &= 15, x && (x > m && (w += Z[r++] << m, m += 8), y += w & (1 << x) - 1, w >>>= x, m -= x), 15 > m && (w += Z[r++] << m, m += 8, w += Z[r++] << m, m += 8), p = g[w & v]; i: for (; ;) { if (x = p >>> 24, w >>>= x, m -= x, x = p >>> 16 & 255, !(16 & x)) { if (0 === (64 & x)) { p = g[(65535 & p) + (w & (1 << x) - 1)]; continue i } e.msg = "invalid distance code", a.mode = i; break e } if (S = 65535 & p, x &= 15, x > m && (w += Z[r++] << m, m += 8, x > m && (w += Z[r++] << m, m += 8)), S += w & (1 << x) - 1, S > d) { e.msg = "invalid distance too far back", a.mode = i; break e } if (w >>>= x, m -= x, x = o - f, S > x) { if (x = S - x, x > u && a.sane) { e.msg = "invalid distance too far back", a.mode = i; break e } if (B = 0, E = b, 0 === c) { if (B += h - x, y > x) { y -= x; do A[o++] = b[B++]; while (--x); B = o - S, E = A } } else if (x > c) { if (B += h + c - x, x -= c, y > x) { y -= x; do A[o++] = b[B++]; while (--x); if (B = 0, y > c) { x = c, y -= x; do A[o++] = b[B++]; while (--x); B = o - S, E = A } } } else if (B += c - x, y > x) { y -= x; do A[o++] = b[B++]; while (--x); B = o - S, E = A } for (; y > 2;) A[o++] = E[B++], A[o++] = E[B++], A[o++] = E[B++], y -= 3; y && (A[o++] = E[B++], y > 1 && (A[o++] = E[B++])) } else { B = o - S; do A[o++] = A[B++], A[o++] = A[B++], A[o++] = A[B++], y -= 3; while (y > 2); y && (A[o++] = A[B++], y > 1 && (A[o++] = A[B++])) } break } } break } } while (s > r && l > o); y = m >> 3, r -= y, m -= y << 3, w &= (1 << m) - 1, e.next_in = r, e.next_out = o, e.avail_in = s > r ? 5 + (s - r) : 5 - (r - s), e.avail_out = l > o ? 257 + (l - o) : 257 - (o - l), a.hold = w, a.bits = m } }, {}], 9: [function (e, t, i) { "use strict"; function n(e) { return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((65280 & e) << 8) + ((255 & e) << 24) } function a() { this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new k.Buf16(320), this.work = new k.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0 } function r(e) { var t; return e && e.state ? (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = 1 & t.wrap), t.mode = F, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new k.Buf32(bt), t.distcode = t.distdyn = new k.Buf32(wt), t.sane = 1, t.back = -1, A) : C } function s(e) { var t; return e && e.state ? (t = e.state, t.wsize = 0, t.whave = 0, t.wnext = 0, r(e)) : C } function o(e, t) { var i, n; return e && e.state ? (n = e.state, 0 > t ? (i = 0, t = -t) : (i = (t >> 4) + 1, 48 > t && (t &= 15)), t && (8 > t || t > 15) ? C : (null !== n.window && n.wbits !== t && (n.window = null), n.wrap = i, n.wbits = t, s(e))) : C } function f(e, t) { var i, n; return e ? (n = new a, e.state = n, n.window = null, i = o(e, t), i !== A && (e.state = null), i) : C } function l(e) { return f(e, kt) } function d(e) { if (gt) { var t; for (w = new k.Buf32(512), m = new k.Buf32(32), t = 0; 144 > t;) e.lens[t++] = 8; for (; 256 > t;) e.lens[t++] = 9; for (; 280 > t;) e.lens[t++] = 7; for (; 288 > t;) e.lens[t++] = 8; for (p(y, e.lens, 0, 288, w, 0, e.work, { bits: 9 }), t = 0; 32 > t;) e.lens[t++] = 5; p(S, e.lens, 0, 32, m, 0, e.work, { bits: 5 }), gt = !1 } e.lencode = w, e.lenbits = 9, e.distcode = m, e.distbits = 5 } function h(e, t, i, n) { var a, r = e.state; return null === r.window && (r.wsize = 1 << r.wbits, r.wnext = 0, r.whave = 0, r.window = new k.Buf8(r.wsize)), n >= r.wsize ? (k.arraySet(r.window, t, i - r.wsize, r.wsize, 0), r.wnext = 0, r.whave = r.wsize) : (a = r.wsize - r.wnext, a > n && (a = n), k.arraySet(r.window, t, i - n, a, r.wnext), n -= a, n ? (k.arraySet(r.window, t, i - n, n, 0), r.wnext = n, r.whave = r.wsize) : (r.wnext += a, r.wnext === r.wsize && (r.wnext = 0), r.whave < r.wsize && (r.whave += a))), 0 } function u(e, t) { var i, a, r, s, o, f, l, u, c, b, w, m, bt, wt, mt, kt, gt, _t, vt, pt, xt, yt, St, Bt, Et = 0, Zt = new k.Buf8(4), At = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]; if (!e || !e.state || !e.output || !e.input && 0 !== e.avail_in) return C; i = e.state, i.mode === G && (i.mode = X), o = e.next_out, r = e.output, l = e.avail_out, s = e.next_in, a = e.input, f = e.avail_in, u = i.hold, c = i.bits, b = f, w = l, yt = A; e: for (; ;) switch (i.mode) { case F: if (0 === i.wrap) { i.mode = X; break } for (; 16 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (2 & i.wrap && 35615 === u) { i.check = 0, Zt[0] = 255 & u, Zt[1] = u >>> 8 & 255, i.check = _(i.check, Zt, 2, 0), u = 0, c = 0, i.mode = D; break } if (i.flags = 0, i.head && (i.head.done = !1), !(1 & i.wrap) || (((255 & u) << 8) + (u >> 8)) % 31) { e.msg = "incorrect header check", i.mode = ht; break } if ((15 & u) !== T) { e.msg = "unknown compression method", i.mode = ht; break } if (u >>>= 4, c -= 4, xt = (15 & u) + 8, 0 === i.wbits) i.wbits = xt; else if (xt > i.wbits) { e.msg = "invalid window size", i.mode = ht; break } i.dmax = 1 << xt, e.adler = i.check = 1, i.mode = 512 & u ? q : G, u = 0, c = 0; break; case D: for (; 16 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (i.flags = u, (255 & i.flags) !== T) { e.msg = "unknown compression method", i.mode = ht; break } if (57344 & i.flags) { e.msg = "unknown header flags set", i.mode = ht; break } i.head && (i.head.text = u >> 8 & 1), 512 & i.flags && (Zt[0] = 255 & u, Zt[1] = u >>> 8 & 255, i.check = _(i.check, Zt, 2, 0)), u = 0, c = 0, i.mode = U; case U: for (; 32 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.head && (i.head.time = u), 512 & i.flags && (Zt[0] = 255 & u, Zt[1] = u >>> 8 & 255, Zt[2] = u >>> 16 & 255, Zt[3] = u >>> 24 & 255, i.check = _(i.check, Zt, 4, 0)), u = 0, c = 0, i.mode = L; case L: for (; 16 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.head && (i.head.xflags = 255 & u, i.head.os = u >> 8), 512 & i.flags && (Zt[0] = 255 & u, Zt[1] = u >>> 8 & 255, i.check = _(i.check, Zt, 2, 0)), u = 0, c = 0, i.mode = H; case H: if (1024 & i.flags) { for (; 16 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.length = u, i.head && (i.head.extra_len = u), 512 & i.flags && (Zt[0] = 255 & u, Zt[1] = u >>> 8 & 255, i.check = _(i.check, Zt, 2, 0)), u = 0, c = 0 } else i.head && (i.head.extra = null); i.mode = M; case M: if (1024 & i.flags && (m = i.length, m > f && (m = f), m && (i.head && (xt = i.head.extra_len - i.length, i.head.extra || (i.head.extra = new Array(i.head.extra_len)), k.arraySet(i.head.extra, a, s, m, xt)), 512 & i.flags && (i.check = _(i.check, a, m, s)), f -= m, s += m, i.length -= m), i.length)) break e; i.length = 0, i.mode = K; case K: if (2048 & i.flags) { if (0 === f) break e; m = 0; do xt = a[s + m++], i.head && xt && i.length < 65536 && (i.head.name += String.fromCharCode(xt)); while (xt && f > m); if (512 & i.flags && (i.check = _(i.check, a, m, s)), f -= m, s += m, xt) break e } else i.head && (i.head.name = null); i.length = 0, i.mode = j; case j: if (4096 & i.flags) { if (0 === f) break e; m = 0; do xt = a[s + m++], i.head && xt && i.length < 65536 && (i.head.comment += String.fromCharCode(xt)); while (xt && f > m); if (512 & i.flags && (i.check = _(i.check, a, m, s)), f -= m, s += m, xt) break e } else i.head && (i.head.comment = null); i.mode = P; case P: if (512 & i.flags) { for (; 16 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (u !== (65535 & i.check)) { e.msg = "header crc mismatch", i.mode = ht; break } u = 0, c = 0 } i.head && (i.head.hcrc = i.flags >> 9 & 1, i.head.done = !0), e.adler = i.check = 0, i.mode = G; break; case q: for (; 32 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } e.adler = i.check = n(u), u = 0, c = 0, i.mode = Y; case Y: if (0 === i.havedict) return e.next_out = o, e.avail_out = l, e.next_in = s, e.avail_in = f, i.hold = u, i.bits = c, R; e.adler = i.check = 1, i.mode = G; case G: if (t === E || t === Z) break e; case X: if (i.last) { u >>>= 7 & c, c -= 7 & c, i.mode = ft; break } for (; 3 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } switch (i.last = 1 & u, u >>>= 1, c -= 1, 3 & u) { case 0: i.mode = W; break; case 1: if (d(i), i.mode = tt, t === Z) { u >>>= 2, c -= 2; break e } break; case 2: i.mode = V; break; case 3: e.msg = "invalid block type", i.mode = ht } u >>>= 2, c -= 2; break; case W: for (u >>>= 7 & c, c -= 7 & c; 32 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if ((65535 & u) !== (u >>> 16 ^ 65535)) { e.msg = "invalid stored block lengths", i.mode = ht; break } if (i.length = 65535 & u, u = 0, c = 0, i.mode = J, t === Z) break e; case J: i.mode = Q; case Q: if (m = i.length) { if (m > f && (m = f), m > l && (m = l), 0 === m) break e; k.arraySet(r, a, s, m, o), f -= m, s += m, l -= m, o += m, i.length -= m; break } i.mode = G; break; case V: for (; 14 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (i.nlen = (31 & u) + 257, u >>>= 5, c -= 5, i.ndist = (31 & u) + 1, u >>>= 5, c -= 5, i.ncode = (15 & u) + 4, u >>>= 4, c -= 4, i.nlen > 286 || i.ndist > 30) { e.msg = "too many length or distance symbols", i.mode = ht; break } i.have = 0, i.mode = $; case $: for (; i.have < i.ncode;) { for (; 3 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.lens[At[i.have++]] = 7 & u, u >>>= 3, c -= 3 } for (; i.have < 19;) i.lens[At[i.have++]] = 0; if (i.lencode = i.lendyn, i.lenbits = 7, St = { bits: i.lenbits }, yt = p(x, i.lens, 0, 19, i.lencode, 0, i.work, St), i.lenbits = St.bits, yt) { e.msg = "invalid code lengths set", i.mode = ht; break } i.have = 0, i.mode = et; case et: for (; i.have < i.nlen + i.ndist;) { for (; Et = i.lencode[u & (1 << i.lenbits) - 1], mt = Et >>> 24, kt = Et >>> 16 & 255, gt = 65535 & Et, !(c >= mt) ;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (16 > gt) u >>>= mt, c -= mt, i.lens[i.have++] = gt; else { if (16 === gt) { for (Bt = mt + 2; Bt > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (u >>>= mt, c -= mt, 0 === i.have) { e.msg = "invalid bit length repeat", i.mode = ht; break } xt = i.lens[i.have - 1], m = 3 + (3 & u), u >>>= 2, c -= 2 } else if (17 === gt) { for (Bt = mt + 3; Bt > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } u >>>= mt, c -= mt, xt = 0, m = 3 + (7 & u), u >>>= 3, c -= 3 } else { for (Bt = mt + 7; Bt > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } u >>>= mt, c -= mt, xt = 0, m = 11 + (127 & u), u >>>= 7, c -= 7 } if (i.have + m > i.nlen + i.ndist) { e.msg = "invalid bit length repeat", i.mode = ht; break } for (; m--;) i.lens[i.have++] = xt } } if (i.mode === ht) break; if (0 === i.lens[256]) { e.msg = "invalid code -- missing end-of-block", i.mode = ht; break } if (i.lenbits = 9, St = { bits: i.lenbits }, yt = p(y, i.lens, 0, i.nlen, i.lencode, 0, i.work, St), i.lenbits = St.bits, yt) { e.msg = "invalid literal/lengths set", i.mode = ht; break } if (i.distbits = 6, i.distcode = i.distdyn, St = { bits: i.distbits }, yt = p(S, i.lens, i.nlen, i.ndist, i.distcode, 0, i.work, St), i.distbits = St.bits, yt) { e.msg = "invalid distances set", i.mode = ht; break } if (i.mode = tt, t === Z) break e; case tt: i.mode = it; case it: if (f >= 6 && l >= 258) { e.next_out = o, e.avail_out = l, e.next_in = s, e.avail_in = f, i.hold = u, i.bits = c, v(e, w), o = e.next_out, r = e.output, l = e.avail_out, s = e.next_in, a = e.input, f = e.avail_in, u = i.hold, c = i.bits, i.mode === G && (i.back = -1); break } for (i.back = 0; Et = i.lencode[u & (1 << i.lenbits) - 1], mt = Et >>> 24, kt = Et >>> 16 & 255, gt = 65535 & Et, !(c >= mt) ;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (kt && 0 === (240 & kt)) { for (_t = mt, vt = kt, pt = gt; Et = i.lencode[pt + ((u & (1 << _t + vt) - 1) >> _t)], mt = Et >>> 24, kt = Et >>> 16 & 255, gt = 65535 & Et, !(c >= _t + mt) ;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } u >>>= _t, c -= _t, i.back += _t } if (u >>>= mt, c -= mt, i.back += mt, i.length = gt, 0 === kt) { i.mode = ot; break } if (32 & kt) { i.back = -1, i.mode = G; break } if (64 & kt) { e.msg = "invalid literal/length code", i.mode = ht; break } i.extra = 15 & kt, i.mode = nt; case nt: if (i.extra) { for (Bt = i.extra; Bt > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.length += u & (1 << i.extra) - 1, u >>>= i.extra, c -= i.extra, i.back += i.extra } i.was = i.length, i.mode = at; case at: for (; Et = i.distcode[u & (1 << i.distbits) - 1], mt = Et >>> 24, kt = Et >>> 16 & 255, gt = 65535 & Et, !(c >= mt) ;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (0 === (240 & kt)) { for (_t = mt, vt = kt, pt = gt; Et = i.distcode[pt + ((u & (1 << _t + vt) - 1) >> _t)], mt = Et >>> 24, kt = Et >>> 16 & 255, gt = 65535 & Et, !(c >= _t + mt) ;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } u >>>= _t, c -= _t, i.back += _t } if (u >>>= mt, c -= mt, i.back += mt, 64 & kt) { e.msg = "invalid distance code", i.mode = ht; break } i.offset = gt, i.extra = 15 & kt, i.mode = rt; case rt: if (i.extra) { for (Bt = i.extra; Bt > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } i.offset += u & (1 << i.extra) - 1, u >>>= i.extra, c -= i.extra, i.back += i.extra } if (i.offset > i.dmax) { e.msg = "invalid distance too far back", i.mode = ht; break } i.mode = st; case st: if (0 === l) break e; if (m = w - l, i.offset > m) { if (m = i.offset - m, m > i.whave && i.sane) { e.msg = "invalid distance too far back", i.mode = ht; break } m > i.wnext ? (m -= i.wnext, bt = i.wsize - m) : bt = i.wnext - m, m > i.length && (m = i.length), wt = i.window } else wt = r, bt = o - i.offset, m = i.length; m > l && (m = l), l -= m, i.length -= m; do r[o++] = wt[bt++]; while (--m); 0 === i.length && (i.mode = it); break; case ot: if (0 === l) break e; r[o++] = i.length, l--, i.mode = it; break; case ft: if (i.wrap) { for (; 32 > c;) { if (0 === f) break e; f--, u |= a[s++] << c, c += 8 } if (w -= l, e.total_out += w, i.total += w, w && (e.adler = i.check = i.flags ? _(i.check, r, w, o - w) : g(i.check, r, w, o - w)), w = l, (i.flags ? u : n(u)) !== i.check) { e.msg = "incorrect data check", i.mode = ht; break } u = 0, c = 0 } i.mode = lt; case lt: if (i.wrap && i.flags) { for (; 32 > c;) { if (0 === f) break e; f--, u += a[s++] << c, c += 8 } if (u !== (4294967295 & i.total)) { e.msg = "incorrect length check", i.mode = ht; break } u = 0, c = 0 } i.mode = dt; case dt: yt = z; break e; case ht: yt = N; break e; case ut: return I; case ct: default: return C } return e.next_out = o, e.avail_out = l, e.next_in = s, e.avail_in = f, i.hold = u, i.bits = c, (i.wsize || w !== e.avail_out && i.mode < ht && (i.mode < ft || t !== B)) && h(e, e.output, e.next_out, w - e.avail_out) ? (i.mode = ut, I) : (b -= e.avail_in, w -= e.avail_out, e.total_in += b, e.total_out += w, i.total += w, i.wrap && w && (e.adler = i.check = i.flags ? _(i.check, r, w, e.next_out - w) : g(i.check, r, w, e.next_out - w)), e.data_type = i.bits + (i.last ? 64 : 0) + (i.mode === G ? 128 : 0) + (i.mode === tt || i.mode === J ? 256 : 0), (0 === b && 0 === w || t === B) && yt === A && (yt = O), yt) } function c(e) { if (!e || !e.state) return C; var t = e.state; return t.window && (t.window = null), e.state = null, A } function b(e, t) { var i; return e && e.state ? (i = e.state, 0 === (2 & i.wrap) ? C : (i.head = t, t.done = !1, A)) : C } var w, m, k = e("../utils/common"), g = e("./adler32"), _ = e("./crc32"), v = e("./inffast"), p = e("./inftrees"), x = 0, y = 1, S = 2, B = 4, E = 5, Z = 6, A = 0, z = 1, R = 2, C = -2, N = -3, I = -4, O = -5, T = 8, F = 1, D = 2, U = 3, L = 4, H = 5, M = 6, K = 7, j = 8, P = 9, q = 10, Y = 11, G = 12, X = 13, W = 14, J = 15, Q = 16, V = 17, $ = 18, et = 19, tt = 20, it = 21, nt = 22, at = 23, rt = 24, st = 25, ot = 26, ft = 27, lt = 28, dt = 29, ht = 30, ut = 31, ct = 32, bt = 852, wt = 592, mt = 15, kt = mt, gt = !0; i.inflateReset = s, i.inflateReset2 = o, i.inflateResetKeep = r, i.inflateInit = l, i.inflateInit2 = f, i.inflate = u, i.inflateEnd = c, i.inflateGetHeader = b, i.inflateInfo = "Jyo.Utility.Uncompress inflate (from Nodeca project)" }, { "../utils/common": 2, "./adler32": 4, "./crc32": 6, "./inffast": 8, "./inftrees": 10 }], 10: [function (e, t) { "use strict"; var i = e("../utils/common"), n = 15, a = 852, r = 592, s = 0, o = 1, f = 2, l = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], d = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], h = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], u = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64]; t.exports = function (e, t, c, b, w, m, k, g) { var _, v, p, x, y, S, B, E, Z, A = g.bits, z = 0, R = 0, C = 0, N = 0, I = 0, O = 0, T = 0, F = 0, D = 0, U = 0, L = null, H = 0, M = new i.Buf16(n + 1), K = new i.Buf16(n + 1), j = null, P = 0; for (z = 0; n >= z; z++) M[z] = 0; for (R = 0; b > R; R++) M[t[c + R]]++; for (I = A, N = n; N >= 1 && 0 === M[N]; N--); if (I > N && (I = N), 0 === N) return w[m++] = 20971520, w[m++] = 20971520, g.bits = 1, 0; for (C = 1; N > C && 0 === M[C]; C++); for (C > I && (I = C), F = 1, z = 1; n >= z; z++) if (F <<= 1, F -= M[z], 0 > F) return -1; if (F > 0 && (e === s || 1 !== N)) return -1; for (K[1] = 0, z = 1; n > z; z++) K[z + 1] = K[z] + M[z]; for (R = 0; b > R; R++) 0 !== t[c + R] && (k[K[t[c + R]]++] = R); if (e === s ? (L = j = k, S = 19) : e === o ? (L = l, H -= 257, j = d, P -= 257, S = 256) : (L = h, j = u, S = -1), U = 0, R = 0, z = C, y = m, O = I, T = 0, p = -1, D = 1 << I, x = D - 1, e === o && D > a || e === f && D > r) return 1; for (var q = 0; ;) { q++, B = z - T, k[R] < S ? (E = 0, Z = k[R]) : k[R] > S ? (E = j[P + k[R]], Z = L[H + k[R]]) : (E = 96, Z = 0), _ = 1 << z - T, v = 1 << O, C = v; do v -= _, w[y + (U >> T) + v] = B << 24 | E << 16 | Z | 0; while (0 !== v); for (_ = 1 << z - 1; U & _;) _ >>= 1; if (0 !== _ ? (U &= _ - 1, U += _) : U = 0, R++, 0 === --M[z]) { if (z === N) break; z = t[c + k[R]] } if (z > I && (U & x) !== p) { for (0 === T && (T = I), y += C, O = z - T, F = 1 << O; N > O + T && (F -= M[O + T], !(0 >= F)) ;) O++, F <<= 1; if (D += 1 << O, e === o && D > a || e === f && D > r) return 1; p = U & x, w[p] = I << 24 | O << 16 | y - m | 0 } } return 0 !== U && (w[y + U] = z - T << 24 | 64 << 16 | 0), g.bits = I, 0 } }, { "../utils/common": 2 }], 11: [function (e, t) { "use strict"; t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" } }, {}], 12: [function (e, t) { "use strict"; function i() { this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0 } t.exports = i }, {}] }, {}, [1])(1);

})(window, document, Jyo);