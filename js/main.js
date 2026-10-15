(function () {
  var NAMES = { PPRO: "Premiere Pro", AEFT: "After Effects", none: "Preview (no host)" };
  var $ = function (s) { return document.querySelector(s); };
  var buttons = document.querySelectorAll(".plat");
  var variant = $("#variant"), styleSel = $("#style"), colorSel = $("#color"), hexIn = $("#hex"), hexRow = $("#hexrow"), status = $("#status"), warn = $("#warn"), preview = $("#preview");
  var active = null;      // platform key currently shown, or null
  var selected = "reels"; // platform shown in the preview thumbnail

  function q(s) { return '"' + String(s).replace(/\\/g, "/").replace(/"/g, '\\"') + '"'; }
  function currentColor() {
    if (colorSel.value === "custom") {
      var v = hexIn.value.replace(/^#?/, "#");
      return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : "";
    }
    return colorSel.value;
  }
  function setStatus(t) { status.textContent = t; }
  function setWarn(t) { warn.textContent = t || ""; }

  function refreshButtons() {
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute("data-p") === active;
      buttons[i].className = "plat" + (on ? " on" : "");
    }
  }
  function refreshPreview() {
    preview.src = Overlay.render(selected, variant.value, false, styleSel.value, currentColor()).toDataURL("image/png");
  }

  window.onerror = function (msg) { setStatus("Something went wrong."); setWarn("Panel error: " + msg); };

  function run(fn, args, done) {
    var call = fn + "(" + args.join(",") + ")";
    Bridge.evalScript(call, function (res) {
      res = String(res || "");
      var parts = res.split("|");
      if (parts[0] === "OK") {
        try { done(parts.slice(1)); } catch (e) { setStatus("Something went wrong."); setWarn("Panel error: " + e.message); }
      }
      else { setStatus("Something went wrong."); setWarn(parts.slice(1).join("|") || res); }
    });
  }

  function onPlatform(p) {
    selected = p; refreshPreview(); setWarn("");
    if (!Bridge.hasHost) { active = (active === p) ? null : p; refreshButtons(); setStatus(active ? "Demo: overlay would be shown." : "Demo: overlay would be hidden."); return; }
    if (active === p) {
      run("szHide", [], function () { active = null; refreshButtons(); setStatus("Overlay hidden."); });
      return;
    }
    run("szSize", [], function (sz) {
      var landscape = Number(sz[0]) > Number(sz[1]);
      var st = styleSel.value;
      var token = st === "ui" ? "ui" : (st === "both" ? variant.value + "ui" : variant.value);
      var col = currentColor();
      var name = Overlay.fileName(p, token, landscape).replace(/\.png$/, col ? "_" + col.slice(1) + ".png" : ".png");
      var cv = Overlay.render(p, variant.value, landscape, st, col);
      var sw = Math.round(Number(sz[0])), sh = Math.round(Number(sz[1]));
      // Premiere places a PNG at its native pixel size, so bake the overlay at the sequence's own size.
      if (Bridge.hostName() === "PPRO" && sw > 0 && sh > 0 && (sw !== cv.width || sh !== cv.height)) {
        var cv2 = document.createElement("canvas"); cv2.width = sw; cv2.height = sh;
        cv2.getContext("2d").drawImage(cv, 0, 0, sw, sh);
        cv = cv2; name = name.replace(/\.png$/, "_" + sw + "x" + sh + ".png");
      }
      var path = Bridge.writePng(cv.toDataURL("image/png"), name);
      if (!path) { setStatus("Something went wrong."); setWarn("Could not write the overlay image. Details: " + Bridge.lastError()); return; }
      run("szShow", [q(path)], function (r) {
        active = p; refreshButtons(); setStatus(r[0] || "Overlay shown.");
        setWarn(r[1] || "");
      });
    });
  }

  for (var i = 0; i < buttons.length; i++) {
    (function (b) { b.addEventListener("click", function () { onPlatform(b.getAttribute("data-p")); }); })(buttons[i]);
  }
  function onColor() { hexRow.style.display = colorSel.value === "custom" ? "flex" : "none"; onStyleOrVariant(); }
  function onStyleOrVariant() {
    variant.disabled = styleSel.value === "ui";
    refreshPreview();
    if (active && Bridge.hasHost) {
      var p = active; active = null; onPlatform(p);
    }
  }
  variant.addEventListener("change", onStyleOrVariant);
  styleSel.addEventListener("change", onStyleOrVariant);
  colorSel.addEventListener("change", onColor);
  hexIn.addEventListener("change", onStyleOrVariant);
  $("#remove").addEventListener("click", function () {
    if (!Bridge.hasHost) { active = null; refreshButtons(); setStatus("Demo: overlay removed."); return; }
    run("szRemove", [], function (r) { active = null; refreshButtons(); setStatus(r[0] || "Overlay removed."); });
  });

  function syncStatus() {
    if (!Bridge.hasHost) return;
    Bridge.evalScript("szStatus()", function (res) {
      var r = String(res || "").split("|");
      if (r[0] !== "OK") return; // stay quiet, status sync is best effort
      r = r.slice(1);
      // r = ["none"] or [platform, variant, "1"|"0"]
      if (r[0] !== "none" && r[2] === "1") { active = r[0]; selected = r[0]; if (r[1] === "ui") { styleSel.value = "ui"; } else if (r[1]) { var both = /ui$/.test(r[1]); styleSel.value = both ? "both" : "zones"; variant.value = r[1].replace(/ui$/, ""); } variant.disabled = styleSel.value === "ui"; }
      else active = null;
      refreshButtons(); refreshPreview();
    });
  }

  $("#host").textContent = NAMES[Bridge.hostName()] || Bridge.hostName();
  refreshButtons(); refreshPreview();
  if (Bridge.hasHost) { syncStatus(); window.addEventListener("focus", syncStatus); }
  else if (/^#(reels|tiktok|shorts)$/.test(location.hash)) { active = selected = location.hash.slice(1); refreshButtons(); refreshPreview(); setStatus("Demo: overlay would be shown."); }
  else setStatus("Preview only. Install into Premiere Pro or After Effects to use it.");
})();
