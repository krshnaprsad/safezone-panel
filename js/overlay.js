/* Draws a safe-zone overlay on a canvas. Portrait = 1080x1920. Landscape = 1920x1080 with the
   9:16 frame centred at full height and the rest dimmed. Transparent background. */
var Overlay = (function () {
  var SHADE = "rgba(255,64,96,0.29)", OUTSIDE = "rgba(0,0,0,0.47)";
  var LINE = "rgba(255,255,255,0.92)", LINE_SHADOW = "rgba(0,0,0,0.6)", PILL = "rgba(20,20,24,0.67)";

  function polygon(z, FW, FH) {
    var L = z.left, T = z.top, R = FW - z.right, B = FH - z.bottom;
    if (z.rail) {
      var ry = z.rail.from_y, rr = FW - z.rail.right;
      return [[L, T], [R, T], [R, ry], [rr, ry], [rr, B], [L, B]];
    }
    return [[L, T], [R, T], [R, B], [L, B]];
  }

  function render(platform, variant, landscape, style) {
    style = style || "zones";
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
  var UI_LINE = "rgba(255,255,255,0.9)", UI_SHADOW = "rgba(0,0,0,0.55)", UI_FILL = "rgba(0,0,0,0.18)";

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
      // Positions taken from a real Reels screenshot (right rail, avatar row, location tag).
      var rx = 1000;
      function count(cy, w) { rrect(rx - w / 2, cy + 52, w, 26, 13); }
      heart(rx, 1014); count(1014, 78);
      bubble(rx, 1166); count(1166, 70);
      repost(rx, 1328); count(1328, 56);
      plane(rx, 1473);
      bookmark(rx, 1592); count(1592, 70);
      line(rx - 24, 1700, rx + 24, 1700); line(rx - 24, 1730, rx + 24, 1730);   // menu
      rrect(rx - 36, 1790, 72, 72, 14);                                          // audio thumbnail
      rrect(41, 1596, 242, 71, 20);                                              // location tag
      circle(102, 1757, 45);                                                     // avatar
      rrect(173, 1737, 240, 40, 20); circle(436, 1757, 14);                      // username, verified
      rrect(490, 1727, 157, 60, 16);                                             // follow
      lines(41, 1835, [640, 420], 44);                                           // caption
    } else if (platform === "tiktok") {
      line(FW / 2 - 200, 130, FW / 2 - 200, 130); rrect(FW / 2 - 290, 100, 200, 56, 12); rrect(FW / 2 - 40, 100, 150, 56, 12); // tabs
      circle(FW - 70, 128, 30);                                          // search
      circle(950, 930, 48);                                              // creator avatar
      var ty = [1075, 1215, 1355, 1495];
      railItem(950, ty[0], "heart"); railItem(950, ty[1], "comment"); railItem(950, ty[2], "save"); railItem(950, ty[3], "share");
      disc(950, 1650, 54);                                               // sound disc
      rrect(40, 1585, 300, 44, 22);                                      // username
      lines(40, 1665, [560, 400], 46);                                   // description
      rrect(40, 1760, 380, 40, 20);                                      // sound row
      navBar(1810, 5);
    } else {
      circle(FW - 250, 118, 30); circle(FW - 160, 118, 30); dots(FW - 70, 118, true); // search, camera, more
      var sy = [1130, 1290, 1450, 1610];
      railItem(985, sy[0], "up"); railItem(985, sy[1], "down"); railItem(985, sy[2], "comment"); railItem(985, sy[3], "share");
      disc(985, 1760, 40);                                               // remix / sound
      circle(80, 1640, 36); rrect(135, 1620, 240, 40, 20); rrect(395, 1612, 170, 56, 28); // channel, subscribe
      lines(40, 1735, [620, 380], 46);                                   // title
      line(0, 1895, FW, 1895);                                           // progress bar
    }
  }

  function fileName(platform, variant, landscape) {
    return "SAFEZONE_" + platform + "_" + variant + "_" + (landscape ? "landscape" : "portrait") + ".png";
  }
  return { render: render, fileName: fileName };
})();
