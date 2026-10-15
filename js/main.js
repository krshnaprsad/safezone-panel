(function () {
  var NAMES = { PPRO: "Premiere Pro", AEFT: "After Effects", none: "Preview (no host)" };
  var $ = function (s) { return document.querySelector(s); };
  var buttons = document.querySelectorAll(".plat");
  var variant = $("#variant"), status = $("#status"), warn = $("#warn"), preview = $("#preview");
  var active = null;      // platform key currently shown, or null
  var selected = "reels"; // platform shown in the preview thumbnail

  function q(s) { return '"' + String(s).replace(/\\/g, "/").replace(/"/g, '\\"') + '"'; }
  function setStatus(t) { status.textContent = t; }
  function setWarn(t) { warn.textContent = t || ""; }

  function refreshButtons() {
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute("data-p") === active;
      buttons[i].className = "plat" + (on ? " on" : "");
    }
  }
  function refreshPreview() {
    preview.src = Overlay.render(selected, variant.value, false).toDataURL("image/png");
  }

  function run(fn, args, done) {
    var call = fn + "(" + args.join(",") + ")";
    Bridge.evalScript(call, function (res) {
      res = String(res || "");
      var parts = res.split("|");
      if (parts[0] === "OK") { done(parts.slice(1)); }
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
      var name = Overlay.fileName(p, variant.value, landscape);
      var path = Bridge.writePng(Overlay.render(p, variant.value, landscape).toDataURL("image/png"), name);
      if (!path) { setStatus("Something went wrong."); setWarn("Could not write the overlay image to your user data folder."); return; }
      run("szShow", [q(path)], function (r) {
        active = p; refreshButtons(); setStatus(r[0] || "Overlay shown.");
        setWarn(r[1] || "");
      });
    });
  }

  for (var i = 0; i < buttons.length; i++) {
    (function (b) { b.addEventListener("click", function () { onPlatform(b.getAttribute("data-p")); }); })(buttons[i]);
  }
  variant.addEventListener("change", function () {
    refreshPreview();
    if (active && Bridge.hasHost) {
      var p = active; active = null; onPlatform(p);
    }
  });
  $("#remove").addEventListener("click", function () {
    if (!Bridge.hasHost) { active = null; refreshButtons(); setStatus("Demo: overlay removed."); return; }
    run("szRemove", [], function (r) { active = null; refreshButtons(); setStatus(r[0] || "Overlay removed."); });
  });

  function syncStatus() {
    if (!Bridge.hasHost) return;
    run("szStatus", [], function (r) {
      // r = ["none"] or [platform, variant, "1"|"0"]
      if (r[0] !== "none" && r[2] === "1") { active = r[0]; selected = r[0]; if (r[1]) variant.value = r[1]; }
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
