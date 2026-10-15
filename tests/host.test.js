// Runs jsx/host.jsx against small fakes of the After Effects and Premiere object models.
// This checks our logic and that the script is valid ES3. It cannot prove the real apps accept every call.
const vm = require("vm"), fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const tmp = fs.mkdtempSync("/tmp/sz-");
const png = (n) => { const f = path.join(tmp, n); fs.writeFileSync(f, "x"); return f; };
const code = fs.readFileSync(path.join(root, "jsx/host.jsx"), "utf8");

function sandbox(app, extra) {
  const ctx = Object.assign({ app, File: function (p) { this.fsName = p; this.exists = fs.existsSync(p); }, Time: function () {} }, extra);
  vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}

// ---- After Effects fake
function aeWorld(w, h) {
  const layers = [];
  class CompItem {}
  const comp = new CompItem(); Object.defineProperty(comp, "numLayers", { get: () => layers.length });
  Object.assign(comp, { width: w, height: h, duration: 10, layer: i => layers[i - 1],
    layers: { add(item) {
      const props = {};
      const prop = k => props[k] || (props[k] = { v: null, setValue(v) { this.v = v; } });
      const l = { name: "", comment: "", guideLayer: false, enabled: true, locked: false, inPoint: 0, outPoint: 0,
        property: () => ({ property: prop }),
        remove() { if (this.locked) throw new Error("locked"); layers.splice(layers.indexOf(this), 1); },
        moveToBeginning() { layers.splice(layers.indexOf(this), 1); layers.unshift(this); }, props };
      layers.unshift(l); l.item = item; return l; } } });
  class FootageItem {} class FileSource {}
  const items = [];
  const app = { name: "Adobe After Effects", project: { activeItem: comp, get numItems() { return items.length; }, item: i => items[i - 1],
    importFile(io) { const it = Object.assign(new FootageItem(), { height: io.file.fsName.includes("landscape") ? 1080 : 1920, file: io.file, mainSource: new FileSource() }); items.push(it); return it; } },
    beginUndoGroup() {}, endUndoGroup() {} };
  return { app, comp, layers, extra: { CompItem, FootageItem, FileSource, ImportOptions: function (f) { this.file = f; } } };
}
let w = aeWorld(1080, 1920);
let c = sandbox(w.app, w.extra);
assert.strictEqual(c.szShow(png("SAFEZONE_reels_official_portrait.png")), "OK|reels overlay on (guide layer)|");
assert.strictEqual(w.layers.length, 1); assert.ok(w.layers[0].guideLayer); assert.ok(w.layers[0].comment.includes("reels_official_portrait"));
assert.strictEqual(w.layers[0].props.Scale.v[0], 100);
assert.strictEqual(c.szStatus(), "OK|reels|official|1");
c.szShow(png("SAFEZONE_tiktok_organic_portrait.png")); assert.strictEqual(w.layers.length, 1); assert.strictEqual(c.szStatus(), "OK|tiktok|organic|1");
c.szHide(); assert.strictEqual(c.szStatus(), "OK|tiktok|organic|0");
c.szRemove(); assert.strictEqual(w.layers.length, 0); assert.strictEqual(c.szStatus(), "OK|none");
// landscape comp 3840x2160 -> scale 200, landscape file
w = aeWorld(3840, 2160); c = sandbox(w.app, w.extra); c.szShow(png("SAFEZONE_shorts_official_landscape.png"));
assert.ok(w.layers[0].comment.includes("landscape")); assert.strictEqual(w.layers[0].props.Scale.v[0], 200);
// no comp
w = aeWorld(10, 10); w.app.project.activeItem = null; c = sandbox(w.app, w.extra); assert.ok(c.szShow(png("SAFEZONE_reels_official_portrait.png")).startsWith("ERR|"));

// ---- Premiere fake
function ppWorld(w, h) {
  const mkTrack = () => { const t = { clips: { _a: [], get numItems() { return this._a.length; } } };
    t.overwriteClip = function (item) { const a = this.clips._a; const cl = { name: item.name, disabled: false, remove() { a.splice(a.indexOf(this), 1); } }; a.push(cl); a[a.length - 1] = cl; };
    return t; };
  const tracks = [mkTrack()];
  const clipsProxy = t => new Proxy(t.clips, { get: (o, k) => (k in o ? o[k] : o._a[k]) });
  tracks.forEach(t => { t.clips = clipsProxy(t); });
  const seq = { frameSizeHorizontal: w, frameSizeVertical: h, end: "123",
    videoTracks: new Proxy({ get numTracks() { return tracks.length; } }, { get: (o, k) => (k in o ? o[k] : tracks[k]) }) };
  const kids = [];
  const rootItem = { children: new Proxy({ get numItems() { return kids.length; } }, { get: (o, k) => (k in o ? o[k] : kids[k]) }) };
  const app = { name: "Adobe Premiere Pro", enableQE() {}, project: { activeSequence: seq, rootItem, getInsertionBin: () => rootItem,
    importFiles(p) { kids.push({ name: path.basename(p[0]), type: 1 }); } } };
  const qe = { project: { getActiveSequence: () => ({ addTracks() { const t = mkTrack(); t.clips = clipsProxy(t); tracks.push(t); } }) } };
  return { app, tracks, extra: { qe } };
}
const p = ppWorld(1920, 1080);
c = sandbox(p.app, p.extra);
let r = c.szShow(png("SAFEZONE_tiktok_official_landscape.png"));
assert.ok(r.startsWith("OK|tiktok overlay on|"), r);
assert.strictEqual(p.tracks.length, 2);
assert.strictEqual(p.tracks[1].clips._a[0].name, "SAFEZONE_tiktok_official_landscape.png");
assert.strictEqual(c.szStatus(), "OK|tiktok|official|1");
c.szHide(); assert.strictEqual(c.szStatus(), "OK|tiktok|official|0");
c.szShow(png("SAFEZONE_reels_official_landscape.png")); assert.strictEqual(p.tracks[1].clips._a.length, 1); assert.strictEqual(p.tracks.length, 2);
c.szRemove(); assert.strictEqual(c.szStatus(), "OK|none");
console.log("host.jsx logic tests passed");
{ const w2 = aeWorld(1080, 1920); const c2 = sandbox(w2.app, w2.extra); assert.strictEqual(c2.szSize(), "OK|1080|1920"); }
console.log("szSize ok");
