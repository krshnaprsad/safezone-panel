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

  function render(platform, variant, landscape) {
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
    return cv;
  }

  function fileName(platform, variant, landscape) {
    return "SAFEZONE_" + platform + "_" + variant + "_" + (landscape ? "landscape" : "portrait") + ".png";
  }
  return { render: render, fileName: fileName };
})();
