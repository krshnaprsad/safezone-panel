/* Draws a safe-zone overlay on a canvas. Portrait = 1080x1920. Landscape = 1920x1080 with the
   9:16 frame centred at full height and the rest dimmed. Transparent background. */
var Overlay = (function () {
  var OUTSIDE = "rgba(0,0,0,0.47)", PILL = "rgba(20,20,24,0.67)";
  var SHADE, LINE, LINE_SHADOW, UI_LINE, UI_SHADOW, UI_FILL;

  // color: "#rrggbb" or null for the default look (pink shading, white wireframe).
  function setPalette(color) {
    var m = /^#?([0-9a-f]{6})$/i.exec(color || "");
    function rgba(r, g, b, a) { return "rgba(" + r + "," + g + "," + b + "," + a + ")"; }
    if (!m) {
      SHADE = rgba(255, 64, 96, 0.29); LINE = UI_LINE = rgba(255, 255, 255, 0.92);
      LINE_SHADOW = UI_SHADOW = rgba(0, 0, 0, 0.85); UI_FILL = rgba(0, 0, 0, 0.22); return;
    }
    var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    var edge = lum > 0.5 ? [0, 0, 0] : [255, 255, 255];   // contrasting edge so it reads on any footage
    SHADE = rgba(r, g, b, 0.30); LINE = UI_LINE = rgba(r, g, b, 0.95);
    LINE_SHADOW = UI_SHADOW = rgba(edge[0], edge[1], edge[2], 0.75);
    UI_FILL = rgba(edge[0], edge[1], edge[2], 0.10);
  }

  function polygon(z, FW, FH) {
    var L = z.left, T = z.top, R = FW - z.right, B = FH - z.bottom;
    if (z.rail) {
      var ry = z.rail.from_y, rr = FW - z.rail.right;
      return [[L, T], [R, T], [R, ry], [rr, ry], [rr, B], [L, B]];
    }
    return [[L, T], [R, T], [R, B], [L, B]];
  }

  function render(platform, variant, landscape, style, color) {
    style = style || "zones";
    setPalette(color);
    var FW = ZONES.frame[0], FH = ZONES.frame[1];
    var p = ZONES.platforms[platform], z = p[variant];
    var s = landscape ? 1080 / FH : 1, cw = landscape ? 1920 : FW, ch = landscape ? 1080 : FH;
    var ox = landscape ? (cw - FW * s) / 2 : 0;
    var cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    var g = cv.getContext("2d");
    var X = function (x) { return ox + x * s; }, Y = function (y) { return y * s; };
    function path(pts) {
      g.beginPath();
      for (var i = 0; i < pts.length; i++) g[i ? "lineTo" : "moveTo"](X(pts[i][0]), Y(pts[i][1]));
      g.closePath();
    }
    if (landscape) { g.fillStyle = OUTSIDE; g.fillRect(0, 0, cw, ch); g.clearRect(X(0), 0, FW * s, ch); }
    if (style === "ui") { drawUI(g, platform, X, Y, s, FW, FH); g.strokeStyle = "rgba(255,255,255,0.43)"; g.lineWidth = 1; g.strokeRect(X(0) + 0.5, 0.5, FW * s - 1, FH * s - 1); return cv; }
    g.fillStyle = SHADE; g.fillRect(X(0), 0, FW * s, FH * s);
    var poly = polygon(z, FW, FH);
    g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; path(poly); g.fill(); g.restore();
    g.lineJoin = "round";
    var lw = Math.max(2, Math.round(3 * s));
    g.strokeStyle = LINE_SHADOW; g.lineWidth = lw + 2; path(poly); g.stroke();
    g.strokeStyle = LINE; g.lineWidth = lw; path(poly); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.43)"; g.lineWidth = 1; g.strokeRect(X(0) + 0.5, 0.5, FW * s - 1, FH * s - 1);

    function label(cx, cy, text, size) {
      var fs = Math.max(9, Math.round(size * s));
      g.font = fs + "px Helvetica, Arial, sans-serif";
      var w = g.measureText(text).width, pad = 7 * s + 3, h = fs;
      var x = X(cx), y = Y(cy);
      g.fillStyle = PILL;
      g.beginPath();
      if (g.roundRect) g.roundRect(x - w / 2 - pad, y - h / 2 - pad, w + 2 * pad, h + 2 * pad, 6);
      else g.rect(x - w / 2 - pad, y - h / 2 - pad, w + 2 * pad, h + 2 * pad);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.95)"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, x, y + 1);
    }
    label(FW / 2, z.top / 2, "TOP UI  " + z.top + " px", 26);
    label(FW / 2, FH - z.bottom / 2, "CAPTION + BUTTONS  " + z.bottom + " px", 26);
    if (z.rail) label(FW - z.rail.right / 2, z.rail.from_y + (FH - z.bottom - z.rail.from_y) / 2, String(z.rail.right), 22);
    else label(FW - z.right / 2, FH / 2, String(z.right), 22);
    if (z.left >= 90) label(z.left / 2, FH / 2, String(z.left), 22);
    label(FW / 2, z.top + 52, p.label.toUpperCase() + "  |  " + (variant === "official" ? "official ad guide" : "organic, measured"), 22);
    if (style === "both") drawUI(g, platform, X, Y, s, FW, FH);
    return cv;
  }

  /* ---- App UI wireframes (approximate positions on 1080x1920) ---- */

  function drawUI(g, platform, X, Y, s, FW, FH) {
    var lw = Math.max(1.5, 3 * s);
    function stroke(fn, fill) {
      g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); fn(); if (fill) { g.fillStyle = UI_FILL; g.fill(); }
      g.strokeStyle = UI_SHADOW; g.lineWidth = lw + 2; g.stroke();
      g.strokeStyle = UI_LINE; g.lineWidth = lw; g.stroke();
    }
    function circle(cx, cy, r) { stroke(function () { g.arc(X(cx), Y(cy), r * s, 0, Math.PI * 2); }, true); }
    function rrect(x, y, w, h, r) {
      stroke(function () {
        var x0 = X(x), y0 = Y(y), w0 = w * s, h0 = h * s, r0 = Math.min(r * s, w0 / 2, h0 / 2);
        g.moveTo(x0 + r0, y0); g.arcTo(x0 + w0, y0, x0 + w0, y0 + h0, r0); g.arcTo(x0 + w0, y0 + h0, x0, y0 + h0, r0);
        g.arcTo(x0, y0 + h0, x0, y0, r0); g.arcTo(x0, y0, x0 + w0, y0, r0); g.closePath();
      }, true);
    }
    function line(x1, y1, x2, y2) { stroke(function () { g.moveTo(X(x1), Y(y1)); g.lineTo(X(x2), Y(y2)); }); }
    function lines(x, y, widths, gap) { for (var i = 0; i < widths.length; i++) line(x, y + i * gap, x + widths[i], y + i * gap); }
    // glyphs, centred at cx, cy, size ~ 56 px
    function heart(cx, cy) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 28;
        g.moveTo(x, y + k * 0.9);
        g.bezierCurveTo(x - k * 1.5, y - k * 0.1, x - k * 0.9, y - k * 1.1, x, y - k * 0.4);
        g.bezierCurveTo(x + k * 0.9, y - k * 1.1, x + k * 1.5, y - k * 0.1, x, y + k * 0.9);
      });
    }
    function bubble(cx, cy) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 26;
        g.moveTo(x - k, y - k * 0.2); g.bezierCurveTo(x - k, y - k * 1.1, x + k, y - k * 1.1, x + k, y - k * 0.2);
        g.bezierCurveTo(x + k, y + k * 0.7, x + k * 0.2, y + k * 0.8, x - k * 0.2, y + k * 0.8);
        g.lineTo(x - k * 0.8, y + k * 1.1); g.lineTo(x - k * 0.7, y + k * 0.6);
        g.bezierCurveTo(x - k, y + k * 0.5, x - k, y + k * 0.1, x - k, y - k * 0.2);
      });
    }
    function plane(cx, cy) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 28;
        g.moveTo(x - k, y - k * 0.1); g.lineTo(x + k, y - k); g.lineTo(x + k * 0.3, y + k); g.lineTo(x - k * 0.1, y + k * 0.15); g.closePath();
        g.moveTo(x - k * 0.1, y + k * 0.15); g.lineTo(x + k, y - k);
      });
    }
    function bookmark(cx, cy) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 24;
        g.moveTo(x - k, y - k * 1.2); g.lineTo(x + k, y - k * 1.2); g.lineTo(x + k, y + k * 1.2); g.lineTo(x, y + k * 0.5); g.lineTo(x - k, y + k * 1.2); g.closePath();
      });
    }
    function dots(cx, cy, vertical) {
      for (var i = -1; i <= 1; i++) {
        stroke(function () { g.arc(X(cx + (vertical ? 0 : i * 18)), Y(cy + (vertical ? i * 18 : 0)), 4 * s + 0.5, 0, Math.PI * 2); });
      }
    }
    function thumbsUp(cx, cy, down) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 24, d = down ? -1 : 1;
        g.moveTo(x - k, y + d * k * 0.1); g.lineTo(x - k * 0.4, y + d * k * 0.1); g.lineTo(x + k * 0.2, y - d * k);
        g.lineTo(x + k * 0.7, y - d * k * 0.8); g.lineTo(x + k * 0.4, y + d * k * 0.1); g.lineTo(x + k, y + d * k * 0.1);
        g.lineTo(x + k * 0.8, y + d * k * 1.1); g.lineTo(x - k, y + d * k * 1.1); g.closePath();
      });
    }
    function repost(cx, cy) {
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 24;
        g.arc(x, y, k, Math.PI * 0.15, Math.PI * 0.85, true);
        g.moveTo(x + k * 0.9, y - k * 0.9); g.lineTo(x + k * 0.9, y - k * 0.2); g.lineTo(x + k * 0.2, y - k * 0.4);
      });
      stroke(function () {
        var x = X(cx), y = Y(cy), k = s * 24;
        g.arc(x, y, k, Math.PI * 1.15, Math.PI * 1.85, true);
        g.moveTo(x - k * 0.9, y + k * 0.9); g.lineTo(x - k * 0.9, y + k * 0.2); g.lineTo(x - k * 0.2, y + k * 0.4);
      });
    }
    function disc(cx, cy, r) { circle(cx, cy, r); circle(cx, cy, r * 0.35); }
    function railItem(cx, cy, kind) {
      if (kind === "heart") heart(cx, cy); else if (kind === "comment") bubble(cx, cy);
      else if (kind === "share") plane(cx, cy); else if (kind === "save") bookmark(cx, cy);
      else if (kind === "more") dots(cx, cy, true); else if (kind === "up") thumbsUp(cx, cy, false);
      else if (kind === "down") thumbsUp(cx, cy, true);
    }
    function navBar(y, n) {
      line(0, y, FW, y);
      for (var i = 0; i < n; i++) circle(FW / (n * 2) + i * FW / n, y + (FH - y) * 0.42, 24);
    }

    if (platform === "reels") {
      // Traced from a real Reels screenshot (718x1599 phone screen). The reel fills the area between
      // the status bar (y 83) and the nav bar (y 1497) and is centre-cropped to fill it, so one
      // uniform scale maps screen px to the 1080x1920 frame: f = 1920 / 1414.
      var f = FH / 1414;
      var fx = function (x) { return (x - 359) * f + FW / 2; }, fy = function (y) { return (y - 83) * f; };
      var rcx = fx(666);
      function pill(cy, w) { rrect(rcx - w * f / 2, fy(cy) - 8 * f, w * f, 16 * f, 8 * f); }
      heart(rcx, fy(831.5)); pill(879.5, 56);
      bubble(rcx, fy(942.5)); pill(991.5, 46);
      repost(rcx, fy(1054)); pill(1103, 36);
      plane(rcx, fy(1167.5));
      bookmark(rcx, fy(1255.5)); pill(1303, 50);
      line(rcx - 15 * f, fy(1347), rcx + 15 * f, fy(1347)); line(rcx - 15 * f, fy(1357), rcx + 15 * f, fy(1357)); // menu
      rrect(fx(662) - 22 * f, fy(1425) - 22 * f, 44 * f, 44 * f, 9 * f);                  // audio thumbnail
      rrect(fx(27), fy(1258), 161 * f, 52 * f, 14 * f);                                   // location tag
      circle(fx(64), fy(1372), 33 * f);                                                   // avatar
      rrect(fx(115), fy(1360), 160 * f, 29 * f, 14 * f); circle(fx(292), fy(1374), 9 * f); // username, verified
      rrect(fx(326), fy(1355), 104 * f, 43 * f, 10 * f);                                  // follow
    } else if (platform === "tiktok") {
      // Rail x 918-1080, y 730-1536 and bottom block y 1570-1920: CapQA measurements of the organic layout.
      var tx = 999;
      rrect(FW / 2 - 290, 100, 200, 56, 12); rrect(FW / 2 - 40, 100, 150, 56, 12); // Following / For You tabs
      circle(FW - 70, 128, 30);                                                   // search
      circle(tx, 800, 48);                                                        // creator avatar
      heart(tx, 925); rrect(tx - 34, 975, 68, 26, 13);
      bubble(tx, 1055); rrect(tx - 30, 1105, 60, 26, 13);
      bookmark(tx, 1185); rrect(tx - 30, 1235, 60, 26, 13);
      plane(tx, 1315); rrect(tx - 30, 1365, 60, 26, 13);
      disc(tx, 1470, 50);                                                         // sound disc
      rrect(40, 1600, 300, 44, 22);                                               // username
      lines(40, 1672, [600, 440], 46);                                            // description
      rrect(40, 1770, 400, 40, 20);                                               // sound row
      navBar(1840, 5);
    } else {
      // Traced from a real Shorts screenshot. The top search/menu icons and the title sit in the
      // black bars outside the 9:16 video, so they are not drawn.
      var sx = 998;
      function cnt(cy, w) { rrect(sx - w / 2, cy + 40, w, 26, 13); }
      heart(sx, 1167); cnt(1167, 70);
      bubble(sx, 1320); cnt(1320, 40);
      bookmark(sx, 1473); cnt(1473, 64);
      plane(sx, 1628); cnt(1628, 70);
      repost(sx, 1778); cnt(1778, 74);
      circle(80, 1895, 41);                                                        // channel avatar
      rrect(142, 1879, 220, 40, 20);                                               // @handle
      rrect(382, 1857, 188, 80, 40);                                               // subscribe
    }
  }

  function fileName(platform, variant, landscape) {
    return "SAFEZONE_" + platform + "_" + variant + "_" + (landscape ? "landscape" : "portrait") + ".png";
  }
  return { render: render, fileName: fileName };
})();
