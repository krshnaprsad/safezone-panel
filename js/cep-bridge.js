/* Minimal bridge to the CEP host. Works only inside Premiere Pro / After Effects.
   Outside the apps (a normal browser) it reports hasHost = false so the panel runs in demo mode. */
var Bridge = (function () {
  var cep = window.__adobe_cep__;
  function evalScript(script, cb) {
    if (!cep) { if (cb) cb("EvalScript error."); return; }
    cep.evalScript(script, cb || function () {});
  }
  // getSystemPath returns a plain (URI-encoded) string, not JSON.
  function sysPath(type) {
    var p = String(cep.getSystemPath(type));
    if (p.charAt(0) === '"') { try { p = JSON.parse(p); } catch (e) {} }
    if (p.indexOf("file://") === 0) p = p.replace(/^file:\/\/(localhost)?/, "");
    try { p = decodeURI(p); } catch (e2) {}
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1); // /C:/... on Windows
    return p;
  }
  function extensionPath() {
    var p = cep ? sysPath("extension") : "";
    if (p.indexOf("file://") === 0) p = decodeURI(p.replace(/^file:\/\/(localhost)?/, ""));
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1); // /C:/... on Windows
    return p;
  }
  function hostName() {
    if (!cep) return "none";
    try { return JSON.parse(cep.getHostEnvironment()).appName; } catch (e) { return "unknown"; }
  }
  // Write a PNG (base64 data URL) to disk, return the file path or "".
  // Premiere and After Effects can disagree about which folders are writable, so try several.
  var lastError = "";
  function writePng(dataUrl, fileName) {
    lastError = "";
    if (!cep) { lastError = "no host"; return ""; }
    var fs = window.cep && window.cep.fs;
    if (!fs) { lastError = "cep.fs missing"; return ""; }
    var data = dataUrl.replace(/^data:image\/png;base64,/, "");
    var types = ["userData", "myDocuments", "commonFiles", "hostApplication", "extension"], tried = [];
    for (var i = 0; i < types.length; i++) {
      var base;
      try { base = sysPath(types[i]); } catch (e) { tried.push(types[i] + ":nopath"); continue; }
      if (!base) { tried.push(types[i] + ":empty"); continue; }
      if (types[i] === "hostApplication") base = base.replace(/[\/\\][^\/\\]*$/, ""); // folder of the .exe
      var dir = base + "/SafeZonePanel";
      var m = fs.makedir(base); // make sure the parent exists
      var m2 = fs.makedir(dir);
      var r = fs.writeFile(dir + "/" + fileName, data, window.cep.encoding.Base64);
      if (r && r.err === 0) return dir + "/" + fileName;
      tried.push(types[i] + ":mk" + (m2 && m2.err) + "/w" + (r && r.err));
    }
    lastError = tried.join(" ");
    return "";
  }
  // Delete older generations of an overlay file (keeps the folder small). Best effort.
  function cleanOld(keepPath, prefix) {
    try {
      var fs = window.cep.fs, dir = keepPath.replace(/[\/\\][^\/\\]*$/, ""), keep = keepPath.replace(/^.*[\/\\]/, "");
      var l = fs.readdir(dir);
      if (!l || l.err !== 0) return;
      for (var i = 0; i < l.data.length; i++) {
        if (l.data[i].indexOf(prefix) === 0 && l.data[i] !== keep) fs.deleteFile(dir + "/" + l.data[i]);
      }
    } catch (e) {}
  }
  return { cleanOld: cleanOld, writePng: writePng, lastError: function () { return lastError; }, hasHost: !!cep, evalScript: evalScript, extensionPath: extensionPath, hostName: hostName };
})();
