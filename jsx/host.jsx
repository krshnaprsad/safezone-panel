// ExtendScript for Premiere Pro (PPRO) and After Effects (AEFT). ES3 only.
// Every function returns "OK|message|optional warning" or "ERR|message".

var SZ_PREFIX = "SAFEZONE_";

// Premiere has no CompItem class; After Effects does. (app.name is not reliable in AE.)
function szIsAE() { return typeof CompItem !== "undefined"; }

function szErr(m) { return "ERR|" + m; }

function szBaseName(path) { return String(path).replace(/^.*[\\\/]/, ""); }

// "SAFEZONE_reels_official_portrait.png" -> "reels|official"
function szParse(name) {
  var m = /^SAFEZONE_([a-z]+)_([a-z]+)_(portrait|landscape)/.exec(name);
  return m ? m[1] + "|" + m[2] : "none";
}

/* ---------------- After Effects ---------------- */

function aeComp() {
  var c = app.project.activeItem;
  return (c && c instanceof CompItem) ? c : null;
}

function aeOverlayLayers(comp) {
  var out = [], i;
  for (i = 1; i <= comp.numLayers; i++) {
    var l = comp.layer(i), cm = "";
    try { cm = String(l.comment); } catch (e) { cm = ""; }
    if (cm.indexOf(SZ_PREFIX) === 0) out.push(l);
  }
  return out;
}

var SZ_FOLDER = "SafeZone Overlays";

function aeFolder() {
  var i;
  for (i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && it.name === SZ_FOLDER) return it;
  }
  return app.project.items.addFolder(SZ_FOLDER);
}

// Reuse the footage already in the project (matched by file name) instead of importing again.
function aeFootage(file, name) {
  var i, found = null;
  for (i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FootageItem && it.name === name) { found = it; break; }
  }
  if (found) {
    try { found.replace(file); } catch (e) {}   // refresh in case the overlay design changed
    return found;
  }
  var item = app.project.importFile(new ImportOptions(file));
  try { item.parentFolder = aeFolder(); } catch (e2) {}
  return item;
}

// Delete SAFEZONE footage that no layer uses any more. Keeps the project panel clean.
function aeCleanUnused(keepName) {
  var i, n = 0;
  for (i = app.project.numItems; i >= 1; i--) {
    var it = app.project.item(i);
    if (it instanceof FootageItem && it.name.indexOf(SZ_PREFIX) === 0 && it.name !== keepName) {
      var used = 0;
      try { used = it.usedIn.length; } catch (e) { used = 1; }
      if (used === 0) { try { it.remove(); n++; } catch (e2) {} }
    }
  }
  return n;
}

function aeShow(filePath) {
  var step = "start";
  var comp = aeComp();
  if (!comp) return szErr("Open a composition and click on it first.");
  var started = false;
  try {
    step = "read file name";
    var name = szBaseName(filePath);
    var platform = szParse(name).split("|")[0];
    step = "find file";
    var file = new File(filePath);
    if (!file.exists) return szErr("Overlay file missing: " + file.fsName);
    app.beginUndoGroup("Safe zone overlay");
    started = true;
    step = "remove old overlay";
    var old = aeOverlayLayers(comp), i;
    for (i = old.length - 1; i >= 0; i--) { old[i].locked = false; old[i].remove(); }
    step = "import image";
    var item = aeFootage(file, name);
    if (!item) throw new Error("import returned nothing");
    step = "add layer";
    var layer = comp.layers.add(item);
    step = "name layer";
    layer.name = "SAFEZONE " + platform + " (guide)";
    try { layer.comment = name; } catch (e1) {}
    step = "guide layer";
    layer.guideLayer = true;      // AVLayer.guideLayer: guide layers do not render
    if (layer.guideLayer !== true) throw new Error("After Effects refused to turn the layer into a guide layer");
    step = "timing";
    try { layer.inPoint = 0; layer.outPoint = comp.duration; } catch (e2) {}
    try { layer.moveToBeginning(); } catch (e3) {}
    step = "scale";
    var s = 100 * comp.height / item.height;
    var tg = layer.property("ADBE Transform Group");
    tg.property("ADBE Scale").setValue([s, s]);
    tg.property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);
    step = "lock";
    try { layer.locked = true; } catch (e4) {}
    layer.enabled = true;
    step = "tidy project";
    try { aeCleanUnused(name); } catch (e6) {}
    app.endUndoGroup();
    return "OK|" + platform + " overlay on (guide layer, verified: it will not render)|";
  } catch (e) {
    if (started) { try { app.endUndoGroup(); } catch (e5) {} }
    return szErr("[" + step + "] " + e.toString() + " (line " + e.line + ")");
  }
}

function aeHide() {
  var comp = aeComp();
  if (!comp) return szErr("Open a composition and click on it first.");
  var ls = aeOverlayLayers(comp), i;
  for (i = 0; i < ls.length; i++) { ls[i].locked = false; ls[i].enabled = false; ls[i].locked = true; }
  return "OK|Overlay hidden";
}

function aeRemove() {
  var comp = aeComp();
  if (!comp) return szErr("Open a composition and click on it first.");
  var ls = aeOverlayLayers(comp), i;
  app.beginUndoGroup("Remove safe zone overlay");
  for (i = ls.length - 1; i >= 0; i--) { ls[i].locked = false; ls[i].remove(); }
  var cleaned = 0;
  try { cleaned = aeCleanUnused(""); } catch (e) {}
  app.endUndoGroup();
  return "OK|Overlay removed" + (cleaned ? " (" + cleaned + " unused image" + (cleaned > 1 ? "s" : "") + " cleared from project)" : "");
}

function aeStatus() {
  var comp = aeComp();
  if (!comp) return "OK|none";
  var ls = aeOverlayLayers(comp);
  if (!ls.length) return "OK|none";
  return "OK|" + szParse(String(ls[0].comment)) + "|" + (ls[0].enabled ? "1" : "0");
}

/* ---------------- Premiere Pro ---------------- */

function ppSeq() { return app.project ? app.project.activeSequence : null; }

var SZ_WARN_NAME = "!! SAFEZONE - HIDE BEFORE EXPORT !!";
// The clip gets renamed, so recognise it by its project item (SAFEZONE_*.png) or its warning name.
function ppSrcName(clip) {
  try { if (clip.projectItem && clip.projectItem.name) return String(clip.projectItem.name); } catch (e) {}
  return String(clip.name || "");
}
function ppIsOverlay(clip) {
  return ppSrcName(clip).indexOf(SZ_PREFIX) === 0 || String(clip.name || "") === SZ_WARN_NAME;
}

function ppOverlayClips(seq) {
  var out = [], t, c;
  for (t = 0; t < seq.videoTracks.numTracks; t++) {
    var tr = seq.videoTracks[t];
    for (c = 0; c < tr.clips.numItems; c++) {
      var clip = tr.clips[c];
      if (ppIsOverlay(clip)) out.push({ track: tr, index: t, clip: clip });
    }
  }
  return out;
}

function ppFindItem(folder, name) {
  var i;
  for (i = 0; i < folder.children.numItems; i++) {
    var ch = folder.children[i];
    if (ch.name === name) return ch;
    if (ch.type === 2) { // bin
      var f = ppFindItem(ch, name);
      if (f) return f;
    }
  }
  return null;
}

function ppSeqSize(seq) {
  try { return [seq.frameSizeHorizontal, seq.frameSizeVertical]; } catch (e) {}
  try { var s = seq.getSettings(); return [s.videoFrameWidth, s.videoFrameHeight]; } catch (e2) {}
  return [0, 0];
}

function ppShow(filePath) {
  var seq = ppSeq();
  if (!seq) return szErr("Open a sequence and click on its timeline first.");
  var size = ppSeqSize(seq);
  var name = szBaseName(filePath);
  var platform = szParse(name).split("|")[0];
  var file = new File(filePath);
  if (!file.exists) return szErr("Overlay file missing: " + file.fsName);

  // Remove any previous overlay clip (keeps timeline tidy, one overlay at a time)
  var old = ppOverlayClips(seq), i;
  var track = null;
  for (i = old.length - 1; i >= 0; i--) { track = old[i].track; old[i].clip.remove(false, false); }
  // Re-use the old overlay track only while it is still the top track; otherwise add a new top one,
  // so clicking the button always brings the overlay in front of anything added since.
  if (track && seq.videoTracks[seq.videoTracks.numTracks - 1] !== track) track = null;

  var item = ppFindItem(app.project.rootItem, name);
  if (!item) {
    var bin = null, bi;
    for (bi = 0; bi < app.project.rootItem.children.numItems; bi++) {
      var ch = app.project.rootItem.children[bi];
      if (ch.type === 2 && ch.name === "SafeZone Overlays") bin = ch;
    }
    if (!bin) { try { bin = app.project.rootItem.createBin("SafeZone Overlays"); } catch (eb) {} }
    app.project.importFiles([file.fsName], true, bin || app.project.getInsertionBin(), false);
    item = ppFindItem(app.project.rootItem, name);
  }
  if (!item) return szErr("Could not import the overlay into the project.");
  try { item.setColorLabel(1); } catch (el) {} // bright label colour on the project item (and its clip)

  if (!track) {
    // Try to add a fresh top video track so nothing of yours gets overwritten.
    try {
      app.enableQE();
      var qs = qe.project.getActiveSequence();
      var n = seq.videoTracks.numTracks;
      qs.addTracks(1, n, 0, 0, 0, 0, 0, 0);
    } catch (e) {}
    track = seq.videoTracks[seq.videoTracks.numTracks - 1];
  }
  track.overwriteClip(item, 0);

  // find the clip we just placed and stretch it across the sequence
  var placed = null, c;
  for (c = 0; c < track.clips.numItems; c++) {
    if (track.clips[c].name === name) placed = track.clips[c];
  }
  var warn = "";
  if (placed) {
    try { var t = new Time(); t.ticks = seq.end; placed.end = t; } catch (e3) {}
    placed.disabled = false;
    try { placed.name = SZ_WARN_NAME; } catch (en) {}
    try {
      var comps = placed.components, ci, pi;
      for (ci = 0; ci < comps.numItems; ci++) {
        if (comps[ci].displayName === "Motion") {
          for (pi = 0; pi < comps[ci].properties.numItems; pi++) {
            if (comps[ci].properties[pi].displayName === "Scale") { try { comps[ci].properties[pi].setValue(100, true); } catch (es) {} }
          }
        }
      }
    } catch (e4) {}
  }
  warn += (warn ? " " : "") + "WARNING: Premiere has no guide layers. This overlay WILL RENDER in your export unless you click the button again to hide it. The clip is named HIDE BEFORE EXPORT.";
  return "OK|" + platform + " overlay on|" + warn;
}

function ppHide() {
  var seq = ppSeq();
  if (!seq) return szErr("Open a sequence and click on its timeline first.");
  var ls = ppOverlayClips(seq), i;
  for (i = 0; i < ls.length; i++) ls[i].clip.disabled = true;
  return "OK|Overlay hidden (clip disabled, will not export)";
}

function ppRemove() {
  var seq = ppSeq();
  if (!seq) return szErr("Open a sequence and click on its timeline first.");
  var ls = ppOverlayClips(seq), i;
  for (i = ls.length - 1; i >= 0; i--) ls[i].clip.remove(false, false);
  return "OK|Overlay removed";
}

function ppStatus() {
  var seq = ppSeq();
  if (!seq) return "OK|none";
  var ls = ppOverlayClips(seq);
  if (!ls.length) return "OK|none";
  return "OK|" + szParse(ppSrcName(ls[0].clip)) + "|" + (ls[0].clip.disabled ? "0" : "1");
}

/* ---------------- Entry points called by the panel ---------------- */

// Active comp / sequence size, so the panel can pick portrait or landscape. "OK|w|h"
function szSize() {
  try {
    if (szIsAE()) { var c = aeComp(); return c ? "OK|" + c.width + "|" + c.height : szErr("Open a composition and click on it first."); }
    var seq = ppSeq(); if (!seq) return szErr("Open a sequence and click on its timeline first.");
    var sz = ppSeqSize(seq); return "OK|" + sz[0] + "|" + sz[1];
  } catch (e) { return szErr(e.toString() + " (line " + e.line + ")"); }
}
// filePath: full path of a SAFEZONE_<platform>_<variant>_<orientation>.png written by the panel
function szShow(filePath) {
  try { return szIsAE() ? aeShow(filePath) : ppShow(filePath); }
  catch (e) { return szErr(e.toString() + " (line " + e.line + ")"); }
}
function szHide() {
  try { return szIsAE() ? aeHide() : ppHide(); } catch (e) { return szErr(e.toString() + " (line " + e.line + ")"); }
}
function szRemove() {
  try { return szIsAE() ? aeRemove() : ppRemove(); } catch (e) { return szErr(e.toString() + " (line " + e.line + ")"); }
}
function szStatus() {
  try { return szIsAE() ? aeStatus() : ppStatus(); } catch (e) { return szErr(e.toString() + " (line " + e.line + ")"); }
}
