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
  // Write a PNG (base64 data URL) into the user's data folder, return the file path or "".
  function writePng(dataUrl, fileName) {
    if (!cep || !window.cep || !window.cep.fs) return "";
    var base = sysPath("userData");
    var dir = base + "/SafeZonePanel";
    window.cep.fs.makedir(dir);
    var r = window.cep.fs.writeFile(dir + "/" + fileName, dataUrl.replace(/^data:image\/png;base64,/, ""), window.cep.encoding.Base64);
    return r && r.err === 0 ? dir + "/" + fileName : "";
  }
  return { writePng: writePng, hasHost: !!cep, evalScript: evalScript, extensionPath: extensionPath, hostName: hostName };
})();
