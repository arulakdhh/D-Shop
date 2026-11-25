/* D Shop — Dr Han Health Care: customer ordering app + admin panel.
   Its own Firebase project (settings in firebase-config.js), separate from D Cart.
   Sign-in: customers use the login ID DHH gives them; the admin uses login ID "admin". */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r2 = n => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;
  const inr = n => "₹" + (+n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => (+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const fmtDate = iso => iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  const fmtDT = iso => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const daysBetween = (a, b) => Math.round((new Date(b + (b.length === 10 ? "T00:00:00" : "")) - new Date(a + (a.length === 10 ? "T00:00:00" : ""))) / 864e5);
  const nowIso = () => new Date().toISOString();
  const AV = { ok: ["In stock", "av-ok"], low: ["Low", "av-low"], req: ["On request", "av-req"] };
  const avPill = a => `<span class="pill ${(AV[a] || AV.req)[1]}">${(AV[a] || AV.req)[0]}</span>`;
  const ST = { sent: ["New", "st-sent"], confirmed: ["Confirmed", "st-confirmed"], dispatched: ["Dispatched", "st-dispatched"], delivered: ["Delivered", "st-dispatched"], billed: ["Billed", "st-billed"], rejected: ["Can't supply", "st-callback"], cancelled: ["Cancelled", "st-callback"] };
  const ST_CUST = { sent: "Sent to DHH", confirmed: "Order confirmed", dispatched: "Dispatched", delivered: "Delivered", billed: "Billed", rejected: "Can't supply", cancelled: "Cancelled" };
  const stPill = (s, cust) => `<span class="pill ${(ST[s] || ST.sent)[1]}">${cust ? ST_CUST[s] || s : (ST[s] || [s])[0]}</span>`;
  const FLOW = ["sent", "confirmed", "dispatched", "delivered", "billed"];
  const TYPES = { hospital: { label: "Hospital", dues: true }, surgeon: { label: "Surgeon / doctor", dues: true }, clinic: { label: "Clinic / dealer", dues: true }, patient: { label: "Patient / public", dues: true } };
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="m15 18-6-6 6-6"/>', doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'
  };
  /* ---------- product pictures: a drawing per product type, or the admin's photo ---------- */
  const ART = {
    screw: '<path d="M30 14h40v10H30z"/><path d="M38 24h24"/><path d="M42 24v58l8 12 8-12V24"/><path d="M42 34l16 6M42 44l16 6M42 54l16 6M42 64l16 6M42 74l14 6"/><path d="M44 19h12"/>',
    lockscrew: '<path d="M32 12h36l-4 14H36z"/><path d="M36 18l2 3 2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3 2-3"/><path d="M42 26v56l8 12 8-12V26"/><path d="M42 36l16 6M42 46l16 6M42 56l16 6M42 66l16 6M42 76l14 6"/>',
    cannu: '<path d="M30 14h40v10H30z"/><path d="M42 24v24h16V24"/><path d="M42 48v34l8 12 8-12V48"/><path d="M42 58l16 6M42 68l16 6M42 78l14 6"/><path d="M50 14v80" stroke-dasharray="3 3"/>',
    bolt: '<path d="M32 12h36v14H32z"/><path d="M42 26v66h16V26"/><path d="M42 70l16 5M42 78l16 5M42 86l16 5"/>',
    plate: '<g transform="rotate(-25 50 50)"><rect x="6" y="37" width="88" height="26" rx="13"/><circle cx="20" cy="50" r="5"/><circle cx="35" cy="50" r="5"/><circle cx="50" cy="50" r="5"/><circle cx="65" cy="50" r="5"/><circle cx="80" cy="50" r="5"/></g>',
    nail: '<path d="M44 8h12v8l-2 70-4 8-4-8-2-70z"/><circle cx="50" cy="30" r="2.5"/><circle cx="50" cy="66" r="2.5"/><path d="M47 16h6"/>',
    washer: '<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="12"/><path d="M28 64c8 10 36 10 44 0"/>',
    hip: '<circle cx="62" cy="22" r="13"/><path d="M54 32l-10 14c-4 6-6 12-6 20l2 28h10l2-26c1-8 4-14 10-20l8-8"/><path d="M58 36l6 6"/>',
    stent: '<rect x="22" y="36" width="56" height="28" rx="14"/><path d="M30 36l8 28M38 36l-8 28M46 36l8 28M54 36l-8 28M62 36l8 28M70 36l-8 28"/>',
    catheter: '<path d="M14 80c20 0 20-20 36-20s16-40 36-40"/><path d="M80 14l8 6-6 8"/><circle cx="14" cy="80" r="5"/>',
    wire: '<path d="M10 70c10-30 20 30 30 0s20 30 30 0 14-20 20-30"/><circle cx="90" cy="40" r="3"/>',
    suture: '<path d="M26 74c0-30 20-50 48-50"/><path d="M74 24l-8-4 2 8z"/><path d="M26 74c-6 6 0 14 8 10s4-14-2-10"/>',
    kit: '<path d="M38 12h24M42 12v52a8 8 0 0016 0V12"/><path d="M42 44h16"/><rect x="20" y="70" width="60" height="18" rx="4"/>',
    box: '<path d="M20 34l30-14 30 14v34L50 82 20 68z"/><path d="M20 34l30 14 30-14M50 48v34"/>',
  };
  function artOf(type) {
    const t = String(type || "").toLowerCase(); let k = "box";
    if (/lock/.test(t)) k = "lockscrew"; else if (/cancell|cannul/.test(t)) k = "cannu"; else if (/cortex/.test(t)) k = "screw"; else if (/screw|bolt/.test(t)) k = "bolt";
    else if (/plate/.test(t)) k = "plate"; else if (/nail/.test(t)) k = "nail"; else if (/washer/.test(t)) k = "washer"; else if (/hip|joint/.test(t)) k = "hip";
    else if (/stent/.test(t)) k = "stent"; else if (/balloon|sheath|catheter/.test(t)) k = "catheter"; else if (/wire/.test(t)) k = "wire"; else if (/stapl|suture/.test(t)) k = "suture"; else if (/test|kit/.test(t)) k = "kit";
    return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:72%;height:72%;max-width:150px;max-height:150px">${ART[k]}</svg>`;
  }
  // a picture box: shows the admin's photo when there is one, otherwise the type drawing
  const pic = (type, img) => img ? `<span class="picbox" data-imgk="${esc(img)}">${artOf(type)}</span>` : artOf(type);
  const IMG = {}; // key → data URL | "" (none) | Promise
  function loadPics() {
    document.querySelectorAll("[data-imgk]:not([data-done])").forEach(el => {
      const k = el.getAttribute("data-imgk"); el.setAttribute("data-done", "1");
      const put = u => { if (u) el.innerHTML = `<img src="${u}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`; };
      if (typeof IMG[k] === "string") return put(IMG[k]);
      if (!IMG[k]) IMG[k] = fs.doc("images/" + k).get().then(s => (IMG[k] = s.exists ? s.data().data || "" : "")).catch(() => (IMG[k] = ""));
      Promise.resolve(IMG[k]).then(() => put(typeof IMG[k] === "string" ? IMG[k] : ""));
    });
  }
  let picT = null; new MutationObserver(() => { clearTimeout(picT); picT = setTimeout(loadPics, 60); }).observe(document.documentElement, { childList: true, subtree: true });
  const ico = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${ICON[n]}</svg>`;
  const SHORT = t => (t || "?").split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  /* ---------- Firebase ---------- */
  const cfg = window.FIREBASE_CONFIG;
  if (!window.firebase || !cfg || !cfg.apiKey || /PASTE/.test(cfg.apiKey)) {
    document.getElementById("app").innerHTML = '<div class="card pad empty"><b>D Shop isn\'t connected yet.</b><br>Put your Firebase settings in <code>firebase-config.js</code> (see SETUP.md).</div>'; return;
  }
  firebase.initializeApp(cfg);
  const auth = firebase.auth(), fs = firebase.firestore();
  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
  const DOMAIN = cfg.authDomain || (cfg.projectId + ".firebaseapp.com");      // login IDs become <id>@<domain>; nothing is ever emailed
  const ADMIN_EMAIL = "admin@" + DOMAIN;

  const D = { state: "loading", role: null, user: null, me: null, cust: null, catalog: null, settings: {}, orders: {}, payments: {}, advices: {}, err: "", unsubs: [], hasOwner: null };
  function stopSubs() { D.unsubs.forEach(u => { try { u(); } catch (e) {} }); D.unsubs = []; }
  const rr = () => { if (document.querySelector("#app input:focus, #app textarea:focus, #app select:focus")) { D.dirty = true; renderNav(currentRoute().name); } else route(); };
  document.addEventListener("focusout", () => setTimeout(() => { if (D.dirty && !document.querySelector("#app input:focus, #app textarea:focus, #app select:focus")) { D.dirty = false; route(); } }, 150));

  auth.onAuthStateChanged(async u => {
    stopSubs(); Object.assign(D, { user: u, role: null, me: null, cust: null, catalog: null, orders: {}, payments: {}, advices: {}, err: "" });
    if (!u) {
      if (D.hasOwner === null) { D.state = "loading"; route(); try { const o = await fs.doc("config/owner").get(); D.hasOwner = o.exists; } catch (e) { D.hasOwner = true; } }
      const want = D.hasOwner ? "login" : "setup";
      if (D.state !== want || !document.getElementById(want + "form")) { D.state = want; route(); }
      return;
    }
    D.state = "loading"; route();
    try {
      const o = await fs.doc("config/owner").get();
      if (o.exists && o.data().uid === u.uid) { D.role = "admin"; D.me = { uid: u.uid, loginId: "admin", name: "DHH Admin" }; return window.DSAdmin.start(); }
      if (!o.exists && u.email === ADMIN_EMAIL) { D.state = "setup"; return route(); }
      const snap = await fs.doc("users/" + u.uid).get();
      if (!snap.exists || snap.data().active === false) { D.loginErr = "This login has been switched off. Please call DHH."; await auth.signOut(); return; }
      D.role = "customer"; D.me = { uid: u.uid, ...snap.data() };
      if (D.me.mustReset) { D.state = "reset"; return route(); }
      startCustomer();
    } catch (e) { D.loginErr = niceErr(e); try { await auth.signOut(); } catch (x) {} }
  });
  function startCustomer() {
    D.state = "app"; const cid = D.me.cid;
    D.unsubs.push(fs.doc("customers/" + cid).onSnapshot(s => { D.cust = s.exists ? { id: cid, ...s.data() } : { id: cid, name: "", type: "patient", discount: 0 }; rr(); }, loadErr));
    D.unsubs.push(fs.doc("catalog/main").onSnapshot(s => { D.catalog = s.exists ? s.data() : { list: [], gstPct: 5 }; D.fam = null; rr(); }, loadErr));
    D.unsubs.push(fs.collection("orders").where("cid", "==", cid).onSnapshot(s => { D.orders = {}; s.docs.forEach(d => D.orders[d.id] = d.data()); rr(); }, loadErr));
    D.unsubs.push(fs.collection("payments").where("cid", "==", cid).onSnapshot(s => { D.payments = {}; s.docs.forEach(d => D.payments[d.id] = d.data()); rr(); }, () => {}));
    D.unsubs.push(fs.collection("advices").where("cid", "==", cid).onSnapshot(s => { D.advices = {}; s.docs.forEach(d => D.advices[d.id] = d.data()); rr(); }, () => {}));
    fs.doc("users/" + D.me.uid).update({ lastSeen: nowIso() }).catch(() => {});
    route();
  }
  function loadErr(e) { D.err = niceErr(e); route(); }
  function niceErr(e) {
    const c = (e && e.code) || "";
    if (/wrong-password|invalid-credential|user-not-found|invalid-login|invalid-email/.test(c)) return "Login ID or password is not right.";
    if (/too-many-requests/.test(c)) return "Too many tries. Wait a few minutes and try again.";
    if (/network|unavailable/.test(c)) return "No internet connection. Check it and try again.";
    if (/permission/.test(c)) return "Not allowed. Check the Firestore rules (SETUP.md step 3), or call DHH.";
    if (/requires-recent-login/.test(c)) return "Please sign out and sign in again, then try once more.";
    if (/operation-not-allowed/.test(c)) return "Email/Password sign-in is off in Firebase (SETUP.md step 2).";
    if (/email-already-in-use/.test(c)) return "That login ID was used before. Choose another.";
    if (/weak-password/.test(c)) return "Password too weak.";
    return (e && e.message) || "Something went wrong. Try again.";
  }

  /* ---------- shared money logic (same steps as a DHH sales invoice) ---------- */
  function totals(lines, discPct, gstPct) {
    const gross = r2(lines.reduce((n, l) => n + r2((+l.price || 0) * (+l.qty || 0)), 0));
    const disc = r2(gross * (+discPct || 0) / 100); const taxable = r2(gross - disc); const gst = r2(taxable * (+gstPct || 0) / 100);
    const exact = r2(taxable + gst); const grand = Math.round(exact);
    return { gross, disc, taxable, gst, exact, roundOff: r2(grand - exact), grand };
  }
  function orderBalance(o, payments) { if (o.status !== "billed" || !o.bill) return 0; const paid = Object.values(payments).filter(p => p.orderId === o.id && p.status !== "void").reduce((n, p) => n + (+p.amount || 0), 0); return r2((+o.bill.amount || 0) - paid); }
  function duesOf(orders, payments) {
    return Object.entries(orders).map(([id, o]) => ({ id, ...o })).filter(o => o.status === "billed" && o.bill)
      .map(o => { const paid = r2((+o.bill.amount || 0) - orderBalance(o, payments)); return { o, paid, balance: orderBalance(o, payments) }; })
      .filter(x => x.balance > 0.5).sort((a, b) => (a.o.bill.due || "").localeCompare(b.o.bill.due || ""));
  }

  /* ---------- toast / modal ---------- */
  function toast(m) { const r = $("#toast-root"); r.innerHTML = `<div class="toast">${esc(m)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => (r.innerHTML = ""), 3000); }
  function modal(html, wide) { $("#modal-root").innerHTML = `<div class="scrim"><div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`; const f = $("#modal-root input:not([type=hidden]), #modal-root select, #modal-root button"); if (f) f.focus(); }
  function closeModal() { $("#modal-root").innerHTML = ""; }

  /* ---------- customer data helpers ---------- */
  const caps = () => TYPES[(D.cust || {}).type] || TYPES.patient;
  const items = () => (D.catalog && D.catalog.list) || [];
  const item = mat => items().find(i => i.mat === mat);
  function families() {
    if (D.fam) return D.fam; const m = new Map();
    for (const it of items()) { const k = it.type + "|" + it.family; if (!m.has(k)) m.set(k, { key: k, type: it.type, name: it.family, items: [] }); m.get(k).items.push(it); }
    for (const f of m.values()) { f.img = (f.items.find(i => i.img) || {}).img || ""; f.items.sort((a, b) => a.desc.localeCompare(b.desc, undefined, { numeric: true })); f.avail = f.items.some(i => i.avail === "ok") ? "ok" : f.items.some(i => i.avail === "low") ? "low" : "req"; f.id = encodeURIComponent(f.key); }
    D.fam = [...m.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, undefined, { numeric: true }));
    return D.fam;
  }
  const typesList = () => [...new Set(families().map(f => f.type))];
  const cartKey = () => "dshop-cart-" + (D.me ? D.me.uid : "");
  function cart() { if (!D._cart || D._cartFor !== cartKey()) { let c = null; try { c = JSON.parse(localStorage.getItem(cartKey()) || "null"); } catch (e) {} D._cart = c || { items: [], patient: "", surgeon: "", date: "", deliverTo: "", note: "" }; D._cartFor = cartKey(); } return D._cart; }
  function saveCart() { try { localStorage.setItem(cartKey(), JSON.stringify(cart())); } catch (e) {} }
  const cartCount = () => D.state === "app" && D.role === "customer" ? cart().items.reduce((n, i) => n + i.qty, 0) : 0;
  function cartLines() { return cart().items.map(i => ({ ...i, it: item(i.mat) })).filter(l => l.it).map(l => ({ mat: l.mat, qty: l.qty, desc: l.it.desc, uom: l.it.uom || "", hsn: l.it.hsn || "", price: +l.it.price || 0, avail: l.it.avail })); }
  const myOrders = () => Object.entries(D.orders).map(([id, o]) => ({ id, ...o })).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  /* ---------- nav ---------- */
  function navItems() {
    if (D.role === "admin") return window.DSAdmin.nav();
    return [["home", "Home", "home"], ["catalog", "Catalog", "grid"], ["cart", "Cart", "cart"], ["orders", "Orders", "box"], ["dues", "Dues", "card"]];
  }
  function renderNav(r) {
    const on = D.state === "app"; const bottom = $("#bottomnav");
    $(".search").style.display = on && D.role === "customer" ? "" : "none"; bottom.style.display = on ? "" : "none";
    document.body.classList.toggle("is-admin", D.role === "admin" && on);
    if (!on) { $("#topnav").innerHTML = ""; bottom.innerHTML = ""; return; }
    const its = navItems(), n = cartCount();
    bottom.style.gridTemplateColumns = `repeat(${its.length},1fr)`;
    bottom.innerHTML = its.map(([k, l, i, b]) => `<a href="#${k}" class="${r === k ? "on" : ""}" ${r === k ? 'aria-current="page"' : ""}>${ico(i)}${l}${k === "cart" && n ? `<span class="badge-dot">${n}</span>` : b ? `<span class="badge-dot">${b}</span>` : ""}</a>`).join("");
    const t = its.filter(([k]) => k !== "cart" && k !== "home"); if (!t.some(([k]) => k === "account")) t.push(["account", "Account", "user"]);
    $("#topnav").innerHTML = t.map(([k, l, , b]) => `<a href="#${k}" class="${r === k ? "on" : ""}">${l}${b ? ` <span class="nbadge">${b}</span>` : ""}</a>`).join("") + (D.role === "customer" ? `<a href="#cart" class="reqbtn">Cart${n ? ` (${n})` : ""}</a>` : "");
  }

  /* ---------- auth views ---------- */
  function vSetup() {
    return `<div class="card pad stack" style="max-width:460px;margin:24px auto;gap:14px">
      <h1 class="display" style="font-size:26px">Set up the D Shop admin</h1>
      <div class="small muted">This is a new D Shop. Choose the admin password now. You'll sign in with login ID <b>admin</b> and this password to manage customers, products and orders. Only one admin can be set up, so do this yourself right after publishing.</div>
      <form id="setupform" class="stack" novalidate>
        <label class="field">Admin password<input name="p1" type="password" autocomplete="new-password"></label>
        <label class="field">Type it again<input name="p2" type="password" autocomplete="new-password"></label>
        <div class="tiny muted">At least 8 characters, with a letter and a number. Keep it safe: it can't be reset from the app.</div>
        <div id="setuperr" class="small err" role="alert"></div>
        <button class="btn primary block" type="submit">Create admin</button></form></div>`;
  }
  function vLogin() {
    return `<div class="card pad stack" style="max-width:420px;margin:24px auto;gap:14px">
      <h1 class="display" style="font-size:26px">Sign in to D Shop</h1>
      <div class="small muted">Use the login ID and password Dr Han Health Care gave you. The first time, you'll be asked to set your own password.</div>
      <form id="loginform" class="stack" novalidate>
        <label class="field">Login ID<input name="loginid" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
        <label class="field">Password<input name="pw" type="password" autocomplete="current-password"></label>
        <div id="loginerr" class="small err" role="alert">${esc(D.loginErr || "")}</div>
        <button class="btn primary block" type="submit">Sign in</button></form>
      <div class="small muted">Forgot your password? Call DHH and ask for a new temporary password.</div></div>`;
  }
  function vReset() {
    return `<div class="card pad stack" style="max-width:420px;margin:24px auto;gap:14px">
      <h1 class="display" style="font-size:24px">Set your own password</h1>
      <div class="small muted">Hello ${esc(D.me.name || D.me.loginId)}. You signed in with a temporary password. Choose a new one to continue.</div>
      <form id="resetform" class="stack" novalidate>
        <label class="field">New password<input name="p1" type="password" autocomplete="new-password"></label>
        <label class="field">Type it again<input name="p2" type="password" autocomplete="new-password"></label>
        <div class="tiny muted">At least 8 characters, with a letter and a number.</div>
        <div id="reseterr" class="small err" role="alert"></div>
        <button class="btn primary block" type="submit">Save password and continue</button></form>
      <button class="btn ghost" data-logout>Sign out</button></div>`;
  }
  function vLoading() { return `<div class="empty">${D.err ? `<b>Couldn't load your data.</b><br>${esc(D.err)}<br><br><button class="btn ghost" data-logout>Sign out</button>` : "Loading…"}</div>`; }

  /* ---------- customer views ---------- */
  function vHome() {
    const cu = D.cust || {}, o = myOrders();
    const open = o.filter(x => ["sent", "confirmed", "dispatched", "delivered"].includes(x.status)).length;
    const dues = duesOf(D.orders, D.payments); const dueAmt = dues.reduce((n, x) => n + x.balance, 0);
    const k = [`<a href="#orders" class="card pad kpi"><b>${open}</b><span class="tiny muted">Open orders</span></a>`,
      `<a href="#dues" class="card pad kpi ${dues.length ? "warn" : ""}"><b>${dues.length ? inr(dueAmt) : "Nil"}</b><span class="tiny">${dues.length ? `Due on ${dues.length} invoice${dues.length > 1 ? "s" : ""}` : "Nothing due"}</span></a>`];
    const recent = []; o.forEach(x => (x.lines || []).forEach(l => { if (!recent.includes(l.mat) && item(l.mat)) recent.push(l.mat); }));
    return `<div class="stack" style="gap:22px">
      <div><h1 class="display" style="font-size:26px">Hello, ${esc(D.me.name || D.me.loginId)}</h1><div class="muted small">${esc(cu.name || "")}${cu.type ? " · " + esc((TYPES[cu.type] || {}).label || "") : ""}</div></div>
      <div class="grid kpis">${k.join("")}</div>
      <section class="stack"><div class="row between"><h2>Products</h2><a href="#catalog" class="small strong">Full catalog</a></div>
        ${items().length ? `<div class="grid types">${typesList().map(t => { const n = families().filter(f => f.type === t).length; return `<a href="#catalog-${encodeURIComponent(t)}" class="card pad row"><span class="thumb" style="width:46px;height:46px;flex-shrink:0">${artOf(t)}</span><span><b class="tname">${esc(t)}</b><span class="tiny muted">${n} product${n > 1 ? "s" : ""}</span></span></a>`; }).join("")}</div>` : `<div class="card empty">The catalog is being prepared. Please check again soon.</div>`}</section>
      ${recent.length ? `<section class="stack"><h2>Order again</h2><div class="card list">${recent.slice(0, 5).map(m => { const it = item(m); return `<div class="row" style="padding:10px 14px"><div style="flex:1;min-width:0"><b class="small">${esc(it.desc)}</b><div class="tiny muted">${esc(it.mat)}</div></div>${avPill(it.avail)}<button class="btn sm" data-add="${esc(m)}" aria-label="Add ${esc(it.desc)} to cart">+ Add</button></div>`; }).join("")}</div></section>` : ""}
    </div>`;
  }
  let catState = { type: "ALL", avail: { ok: true, low: true, req: true } };
  function vCatalog(arg) {
    if (arg !== undefined) catState.type = decodeURIComponent(arg) || "ALL";
    const q = ($("#q").value || "").trim().toLowerCase();
    const list = families().filter(f => (q || catState.type === "ALL" || f.type === catState.type) && (!q || (f.name + " " + f.type + " " + f.items.map(i => i.mat + " " + i.desc).join(" ")).toLowerCase().includes(q)) && f.items.some(i => catState.avail[i.avail]));
    const title = q ? `Results for “${esc(q)}”` : catState.type === "ALL" ? "All products" : esc(catState.type);
    return `<div class="layout">
      <aside class="side card pad stack" style="gap:16px">
        <div class="stack" style="gap:8px"><div class="label">Product type</div>
          <select id="typesel" aria-label="Product type"><option value="ALL">All products</option>${typesList().map(t => `<option ${catState.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
        <div class="stack" style="gap:8px"><div class="label">Availability</div>
          ${Object.keys(AV).map(a => `<label class="row small" style="gap:10px"><input type="checkbox" data-av="${a}" ${catState.avail[a] ? "checked" : ""}>${AV[a][0]}</label>`).join("")}</div>
      </aside>
      <section class="content stack">
        <div class="row between wrap"><h1 class="display" style="font-size:24px">${title}</h1><span class="small muted">${list.length} product${list.length === 1 ? "" : "s"}</span></div>
        ${list.length ? `<div class="grid cards">${list.slice(0, 240).map(f => `<div class="card pad stack" style="gap:8px">
          <a href="#product-${f.id}" class="thumb" style="height:120px;overflow:hidden" aria-hidden="true" tabindex="-1">${pic(f.type, f.img)}</a>
          <a href="#product-${f.id}" class="pname">${esc(f.name)}</a>
          <div class="tiny muted">${esc(f.type)}${f.items.length > 1 ? ` · ${f.items.length} sizes` : ""}</div>
          <div>${avPill(f.avail)}</div>
          ${f.items.length > 1 ? `<a href="#product-${f.id}" class="btn sm">Choose size</a>` : `<button class="btn sm" data-add="${esc(f.items[0].mat)}">Add to cart</button>`}</div>`).join("")}</div>${list.length > 240 ? '<div class="small muted">Showing the first 240. Search to narrow down.</div>' : ""}` : `<div class="card empty">${items().length ? "No products match. Try another word or product type." : "The catalog is being prepared."}</div>`}
      </section></div>`;
  }
  let pState = { fid: null, mat: null, qty: 1 };
  function vProduct(fid) {
    const f = families().find(x => x.id === fid || x.key === decodeURIComponent(fid || "")); if (!f) return `<div class="card empty">Product not found. <a href="#catalog">Back to catalog</a></div>`;
    if (pState.fid !== f.id || !f.items.some(i => i.mat === pState.mat)) pState = { fid: f.id, mat: f.items[0].mat, qty: 1 };
    const v = item(pState.mat);
    return `<div class="stack" style="gap:18px;max-width:900px">
      <a href="#catalog-${encodeURIComponent(f.type)}" class="row small strong" style="gap:4px">${ico("back", 18)}${esc(f.type)}</a>
      <div class="layout">
        <div class="thumb" style="flex:1 1 260px;height:240px;overflow:hidden" aria-hidden="true">${pic(f.type, f.img)}</div>
        <div class="stack" style="flex:1 1 320px;gap:14px">
          <h1 class="display" style="font-size:24px;line-height:1.2">${esc(f.name)}</h1>
          <div class="small muted">Code ${esc(v.mat)}${v.hsn ? " · HSN " + esc(v.hsn) : ""}${v.uom ? " · per " + esc(v.uom) : ""}</div>
          ${f.items.length > 1 ? `<div class="stack" style="gap:8px"><div class="small strong">Size</div><div class="row wrap" style="gap:8px">${f.items.map(x => `<button class="chip ${x.mat === v.mat ? "on" : ""} av-${x.avail}" data-variant="${esc(x.mat)}" aria-pressed="${x.mat === v.mat}" title="${esc(x.desc)} · ${AV[x.avail][0]}">${esc(x.size || x.desc)}</button>`).join("")}</div></div>` : ""}
          <div class="small">${esc(v.desc)}</div>
          <div class="row small">Availability: ${avPill(v.avail)}${v.avail === "req" ? '<span class="tiny muted">DHH will confirm supply time</span>' : ""}</div>
          <div class="small muted">Your price is shown in the cart.</div>
          <div class="row wrap"><div class="qty"><button data-pq="-1" aria-label="Less">−</button><span aria-live="polite">${pState.qty}</span><button data-pq="1" aria-label="More">+</button></div>
            <button class="btn primary" style="flex:1;min-width:180px" data-add="${esc(v.mat)}" data-q="${pState.qty}">Add to cart</button></div>
        </div></div></div>`;
  }
  function vCart() {
    const c = cart(), cu = D.cust || {}, lines = cartLines(); const gp = +(D.catalog || {}).gstPct || 0;
    const gone = c.items.filter(i => !item(i.mat));
    if (!lines.length) return `<div class="card empty stack" style="align-items:center"><h1 class="display" style="font-size:22px;color:var(--ink)">Your cart is empty</h1><div>Add products from the catalog to see your price.</div><a class="btn primary" href="#catalog">Browse catalog</a></div>`;
    const t = totals(lines, cu.discount, gp);
    return `<div class="layout">
      <section class="content stack">
        <h1 class="display" style="font-size:24px">Cart <span class="muted" style="font-weight:400;font-size:18px">(${cartCount()} items)</span></h1>
        ${gone.length ? `<div class="demo">${gone.length} item${gone.length > 1 ? "s are" : " is"} no longer in the catalog and won't be ordered.</div>` : ""}
        <div class="card list">${lines.map(l => `<div class="stack" style="padding:12px 14px;gap:8px">
          <div class="row between" style="align-items:flex-start"><div style="min-width:0"><b style="font-size:14.5px">${esc(l.desc)}</b><div class="tiny muted">${esc(l.mat)}</div><div style="margin-top:4px">${avPill(l.avail)}</div></div>
            <div style="text-align:right;white-space:nowrap"><b>${inr(l.price * l.qty)}</b><div class="tiny muted">${inr(l.price)} each</div></div></div>
          <div class="row between"><div class="qty"><button data-iq="${esc(l.mat)}|-1" aria-label="Less">−</button><span>${l.qty}</span><button data-iq="${esc(l.mat)}|1" aria-label="More">+</button></div>
            <button class="btn sm ghost" data-rm="${esc(l.mat)}">Remove</button></div></div>`).join("")}</div>
        <div class="card pad stack" style="gap:6px">
          <div class="row between small"><span>Item total</span><span>${inr(t.gross)}</span></div>
          ${+cu.discount ? `<div class="row between small good"><span>Your discount (${esc(cu.discount)}%)</span><span>− ${inr(t.disc)}</span></div>` : ""}
          <div class="row between small"><span>Amount before GST</span><b>${inr(t.taxable)}</b></div>
          <div class="tiny muted">Prices exclude GST. ${gp}% GST is added when you confirm.</div></div>
      </section>
      <aside class="side card pad stack" style="max-width:420px;flex-basis:320px">
        <h2 style="font-size:16px">Surgery and delivery details</h2>
        <label class="field">Patient name / IP no.<input data-f="patient" value="${esc(c.patient)}" placeholder="Optional"></label>
        <div class="grid two"><label class="field">Surgeon<input data-f="surgeon" value="${esc(c.surgeon || (cu.type === "surgeon" ? cu.name : ""))}"></label>
          <label class="field">Surgery date<input type="date" data-f="date" value="${esc(c.date)}"></label></div>
        <label class="field">Deliver to<input data-f="deliverTo" value="${esc(c.deliverTo)}" placeholder="e.g. Ortho OT, Cath lab"></label>
        <label class="field">Note for DHH<textarea data-f="note" placeholder="Optional">${esc(c.note)}</textarea></label>
        <button class="btn primary block" id="review">Review and confirm</button>
      </aside></div>`;
  }
  function confirmModal() {
    const c = cart(), cu = D.cust || {}, lines = cartLines(), gp = +(D.catalog || {}).gstPct || 0, t = totals(lines, cu.discount, gp);
    modal(`<div class="stack" style="gap:12px">
      <div class="row between"><h2 class="display" style="font-size:20px">Confirm your order</h2><button class="btn sm ghost" data-close>Back</button></div>
      <div class="small muted">${esc(cu.name || "")}${c.deliverTo ? " · " + esc(c.deliverTo) : ""}</div>
      <div class="card list small">${lines.map(l => `<div class="row between" style="padding:8px 12px"><span>${esc(l.desc)} × ${l.qty}</span><span style="white-space:nowrap">${inr(l.price * l.qty)}</span></div>`).join("")}</div>
      ${totalsHtml(t, cu.discount, gp)}
      <div id="ordererr" class="small err" role="alert"></div>
      <button class="btn primary block" id="placeorder">Confirm order · ${inr(t.grand)}</button>
      <div class="tiny muted" style="text-align:center">DHH confirms stock and dispatches. The tax invoice follows.</div></div>`);
  }
  function totalsHtml(t, disc, gp) {
    return `<div class="stack" style="gap:6px">
      <div class="row between small"><span>Item total</span><span>${inr(t.gross)}</span></div>
      ${+disc ? `<div class="row between small good"><span>Discount (${esc(disc)}%)</span><span>− ${inr(t.disc)}</span></div>` : ""}
      <div class="row between small"><span>Amount before GST</span><span>${inr(t.taxable)}</span></div>
      <div class="row between small"><span>GST ${esc(gp)}%</span><span>+ ${inr(t.gst)}</span></div>
      ${t.roundOff ? `<div class="row between small muted"><span>Round off</span><span>${t.roundOff > 0 ? "+" : "−"} ${inr(Math.abs(t.roundOff))}</span></div>` : ""}
      <div class="row between total"><b>Grand total</b><b class="display">${inr(t.grand)}</b></div></div>`;
  }
  let ordTab = "open";
  function vOrders(tab) {
    if (tab) ordTab = tab;
    const all = myOrders(); const isOpen = o => ["sent", "confirmed", "dispatched", "delivered"].includes(o.status);
    const list = all.filter(o => ordTab === "open" ? isOpen(o) : !isOpen(o));
    return `<div class="stack"><h1 class="display" style="font-size:24px">Orders</h1>
      <div class="tabs" role="tablist"><button role="tab" data-otab="open" class="${ordTab === "open" ? "on" : ""}" aria-selected="${ordTab === "open"}">Open (${all.filter(isOpen).length})</button>
        <button role="tab" data-otab="done" class="${ordTab === "done" ? "on" : ""}" aria-selected="${ordTab === "done"}">Billed and closed</button></div>
      ${list.length ? `<div class="stack" style="gap:10px">${list.map(o => `<a href="#order-${encodeURIComponent(o.id)}" class="card pad stack" style="gap:6px">
        <div class="row between"><b>Order ${esc(o.no || o.id)}</b>${stPill(o.status, true)}</div>
        <div class="small ink2">${(o.lines || []).map(l => `${esc(l.desc)} × ${l.qty}`).join(", ")}</div>
        <div class="row between tiny muted"><span>${fmtDT(o.createdAt)}</span><b class="ink">${inr((o.totals || {}).grand)}</b></div></a>`).join("")}</div>` : `<div class="card empty">${ordTab === "open" ? "No open orders." : "Nothing here yet."}</div>`}</div>`;
  }
  function timelineHtml(o, cust) {
    if (o.status === "rejected" || o.status === "cancelled") return `<div class="card pad small"><b>${ST_CUST[o.status]}.</b> ${esc(o.reason || (cust ? "Please call DHH for details." : ""))}</div>`;
    const idx = FLOW.indexOf(o.status);
    const sub = { dispatched: o.dispatch ? [o.dispatch.no ? "Challan " + o.dispatch.no : "", o.dispatch.via || ""].filter(Boolean).join(" · ") : "", billed: o.bill ? `Invoice ${o.bill.no || ""} · due ${fmtDate(o.bill.due)}` : "" };
    return `<section class="card pad"><div class="tl">${FLOW.map((st, i) => { const h = (o.history || []).filter(y => y.s === st).pop(); const done = i <= idx; return `<div class="st"><div class="dotcol"><span class="dot ${done ? "done" : ""} ${i === idx + 1 ? "now" : ""}"></span>${i < FLOW.length - 1 ? `<span class="ln ${i < idx ? "done" : ""}"></span>` : ""}</div><div style="padding-bottom:12px"><b style="font-size:14.5px;${done ? "" : "color:var(--muted)"}">${ST_CUST[st]}</b><div class="tiny muted">${h ? fmtDT(h.at) : "Waiting"}${done && sub[st] ? " · " + esc(sub[st]) : ""}</div></div></div>`; }).join("")}</div></section>`;
  }
  function vOrder(id) {
    id = decodeURIComponent(id || ""); const o = D.orders[id] ? { id, ...D.orders[id] } : null; if (!o) return `<div class="card empty">Order not found. <a href="#orders">Back to orders</a></div>`;
    const t = o.totals || {}; const s = o.surgery || {}; const bal = orderBalance(o, D.payments);
    return `<div class="stack" style="max-width:760px;gap:16px">
      <div class="row between noprint"><a href="#orders" class="row small strong" style="gap:4px">${ico("back", 18)}Orders</a><button class="btn sm" data-print>Print / save as PDF</button></div>
      <div class="banner"><div class="row between wrap"><h1 class="display" style="font-size:22px">${ST_CUST[o.status] || o.status}</h1><span class="sub">Order ${esc(o.no || id)}</span></div>
        <div class="sub">${esc([o.deliverTo, s.surgeon, s.patient, s.date ? "surgery " + fmtDate(s.date) : ""].filter(Boolean).join(" · ") || "Placed " + fmtDT(o.createdAt))}</div></div>
      ${timelineHtml(o, true)}
      ${o.status === "billed" && o.bill ? `<div class="card pad row between wrap"><div><b>Invoice ${esc(o.bill.no || "")}</b><div class="tiny muted">${fmtDate(o.bill.date)} · due ${fmtDate(o.bill.due)}</div></div><div style="text-align:right"><b>${bal > 0.5 ? inr(bal) + " to pay" : "Paid"}</b><div class="tiny muted">Invoice amount ${inr(o.bill.amount)}</div></div></div>` : ""}
      <section class="card"><div class="pad" style="padding-bottom:6px"><h2 style="font-size:16px">Items</h2></div><div class="list">${(o.lines || []).map(l => `<div class="row between" style="padding:10px 16px"><span>${esc(l.desc)} <span class="muted small">× ${l.qty}</span></span><span style="white-space:nowrap">${inr(l.price * l.qty)}</span></div>`).join("")}
        <div style="padding:12px 16px">${totalsHtml(t, o.discount, o.gstPct)}<div class="tiny muted" style="margin-top:6px">As ordered. The tax invoice from DHH is final.</div></div></div></section>
      ${o.note ? `<div class="card pad small"><b>Your note:</b> ${esc(o.note)}</div>` : ""}</div>`;
  }
  function vDues() {
    const dues = duesOf(D.orders, D.payments); const adv = Object.values(D.advices);
    const out = dues.reduce((n, v) => n + v.balance, 0), over = dues.filter(v => v.o.bill.due < today()).reduce((n, v) => n + v.balance, 0);
    const paid = Object.values(D.payments).filter(p => p.status !== "void").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 10);
    return `<div class="stack" style="max-width:760px;gap:16px">
      <h1 class="display" style="font-size:24px">Dues and payments</h1>
      <div class="card pad grid two"><div class="kpi"><span class="tiny muted">Outstanding</span><b>${inr(out)}</b></div><div class="kpi"><span class="tiny warnc">Overdue</span><b class="warnc">${inr(over)}</b></div></div>
      <h2 style="font-size:17px">Unpaid invoices</h2>
      ${dues.length ? dues.map(({ o, paid, balance }) => { const late = daysBetween(o.bill.due, today()); const a = adv.filter(x => x.orderId === o.id && (x.status || "new") === "new"); return `<div class="card pad stack" style="gap:8px;${late > 0 ? "border-color:var(--warn-line)" : ""}">
        <div class="row between"><b>Invoice ${esc(o.bill.no || "")}</b><span class="pill ${late > 0 ? "st-callback" : "st-sent"}">${late > 0 ? `${late} days overdue` : late === 0 ? "Due today" : `Due in ${-late} days`}</span></div>
        <div class="row between small ink2"><span>${fmtDate(o.bill.date)} · due ${fmtDate(o.bill.due)} · order ${esc(o.no)}${paid ? ` · paid ${inr(paid)}` : ""}</span><b class="ink">${inr(balance)}</b></div>
        ${a.map(x => `<div class="tiny bluec">Payment advice sent: ${inr(x.amount)} · ${esc(x.mode)} ${esc(x.ref)} · waiting for DHH to check</div>`).join("")}
        <div class="row"><a class="btn sm ghost" style="flex:1" href="#order-${encodeURIComponent(o.id)}">View order</a><button class="btn sm primary" style="flex:1" data-pay="${esc(o.id)}">I have paid</button></div></div>`; }).join("") : `<div class="card empty">No unpaid invoices.</div>`}
      ${paid.length ? `<h2 style="font-size:17px">Payments received by DHH</h2><div class="card list">${paid.map(p => `<div class="row between" style="padding:10px 14px"><span class="small">${fmtDate(p.date)} · ${esc(p.mode || "")} ${esc(p.ref || "")}${p.invNo ? " · invoice " + esc(p.invNo) : ""}</span><b>${inr(p.amount)}</b></div>`).join("")}</div>` : ""}
    </div>`;
  }
  function vAccount() {
    const cu = D.cust || {}; const isA = D.role === "admin";
    return `<div class="stack" style="max-width:560px;gap:16px">
      <h1 class="display" style="font-size:24px">Account</h1>
      <div class="card pad stack" style="gap:4px"><b style="font-size:16px">${esc(D.me.name || D.me.loginId)}</b><div class="small muted">Login ID: ${esc(D.me.loginId)}${isA ? " · D Shop admin" : ` · ${esc(cu.name || "")}${cu.type ? " · " + esc((TYPES[cu.type] || {}).label || "") : ""}`}</div></div>
      <form id="pwform" class="card pad stack" novalidate><b>Change password</b>
        <label class="field">Current password<input name="old" type="password" autocomplete="current-password"></label>
        <label class="field">New password<input name="p1" type="password" autocomplete="new-password"></label>
        <label class="field">Type it again<input name="p2" type="password" autocomplete="new-password"></label>
        <div id="pwerr" class="small err" role="alert"></div><button class="btn primary" type="submit">Save new password</button></form>
      <div class="card pad stack" style="gap:6px"><b>Install D Shop on your phone</b><div class="small muted">Android (Chrome): menu ⋮ → <b>Install app</b> or <b>Add to Home screen</b>. iPhone (Safari): Share → <b>Add to Home Screen</b>.</div>${D.installEvt ? '<button class="btn" id="install">Install D Shop</button>' : ""}</div>
      <button class="btn ghost" data-logout>Sign out</button></div>`;
  }

  /* ---------- router ---------- */
  function currentRoute() { const h = (location.hash || "#").slice(1); const k = h.indexOf("-"); return { name: (k < 0 ? h : h.slice(0, k)) || "", arg: k < 0 ? undefined : h.slice(k + 1) }; }
  function route() {
    let { name, arg } = currentRoute(); let html;
    if (D.state === "setup") { html = vSetup(); name = "setup"; }
    else if (D.state === "login") { html = vLogin(); name = "login"; }
    else if (D.state === "reset") { html = vReset(); name = "reset"; }
    else if (D.state !== "app") { html = vLoading(); name = "loading"; }
    else if (D.role === "admin") { const r = window.DSAdmin.view(name, arg); html = r.html; name = r.name; }
    else if (!D.cust || !D.catalog) { html = vLoading(); name = "loading"; }
    else { const v = { home: vHome, catalog: vCatalog, product: vProduct, cart: vCart, orders: vOrders, order: vOrder, dues: vDues, account: vAccount }[name]; if (!v) name = "home"; html = (v || vHome)(arg); }
    $("#app").innerHTML = html; renderNav(name === "product" ? "catalog" : name === "order" ? "orders" : name);
    if (D.role === "admin" && D.state === "app") window.DSAdmin.after(name);
    return name;
  }
  let last = "";
  function go() { const n = route(); if (n !== last) { window.scrollTo(0, 0); last = n; } }
  function nav(h) { if ((location.hash || "#") === h || (h === "#" && !location.hash)) route(); else location.hash = h; }

  /* ---------- customer actions ---------- */
  function addToCart(mat, q) { const c = cart(), ex = c.items.find(i => i.mat === mat); if (ex) ex.qty += q; else c.items.push({ mat, qty: q }); saveCart(); const it = item(mat); toast("Added to cart: " + (it ? it.desc : mat)); route(); }
  async function placeOrder(btn) {
    const c = cart(), cu = D.cust || {}, lines = cartLines().map(({ avail, ...l }) => l), gp = +(D.catalog || {}).gstPct || 0;
    if (!lines.length) return;
    const t = totals(lines, cu.discount, gp); const d = new Date();
    const no = "DS" + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const now = d.toISOString();
    const doc = { no, cid: D.me.cid, uid: D.me.uid, loginId: D.me.loginId, userName: D.me.name || "", custName: cu.name || "", custType: cu.type || "", lines, discount: +cu.discount || 0, gstPct: gp, totals: t,
      surgery: { patient: c.patient || "", surgeon: c.surgeon || (cu.type === "surgeon" ? cu.name || "" : ""), date: c.date || "" }, deliverTo: c.deliverTo || "", note: c.note || "", status: "sent", createdAt: now, history: [{ s: "sent", at: now }] };
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await fs.doc("orders/" + no).set(doc);
      D._cart = { items: [], patient: "", surgeon: "", date: "", deliverTo: "", note: "" }; saveCart();
      modal(`<div class="stack" style="gap:12px;text-align:center;align-items:center"><div class="thumb" style="width:56px;height:56px;border-radius:28px;font-size:26px">✓</div>
        <h2 class="display" style="font-size:22px">Order ${esc(no)} placed</h2><div class="small muted">DHH has it now and will confirm it. You can track it under Orders.</div>
        <div class="row" style="width:100%"><button class="btn ghost" style="flex:1" data-close>Keep browsing</button><a class="btn primary" style="flex:1" href="#order-${encodeURIComponent(no)}" data-close>Track order</a></div></div>`);
      route();
    } catch (e) { btn.disabled = false; btn.textContent = "Confirm order"; const el = $("#ordererr"); if (el) el.textContent = "Couldn't send the order: " + niceErr(e); }
  }
  function payModal(oid) {
    const o = D.orders[oid]; if (!o) return; const bal = orderBalance({ id: oid, ...o }, D.payments);
    modal(`<form class="stack" id="payform" data-oid="${esc(oid)}" novalidate><div class="row between"><h2 style="font-size:18px">Paid invoice ${esc(o.bill.no || "")}?</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
      <div class="small muted">Pay Dr Han Health Care by UPI, NEFT or cheque as usual, then send the details here so DHH can match the payment.</div>
      ${(D.catalog || {}).payTo ? `<div class="card pad small" style="background:var(--bg);white-space:pre-line">${esc(D.catalog.payTo)}</div>` : ""}
      <label class="field">Amount paid (₹)<input name="amount" inputmode="decimal" value="${bal}"></label>
      <div class="grid two"><label class="field">Mode<select name="mode"><option>UPI</option><option>NEFT / RTGS</option><option>Cheque</option><option>Cash</option></select></label><label class="field">Date paid<input name="date" type="date" value="${today()}"></label></div>
      <label class="field">UTR / cheque no.<input name="ref"></label>
      <div id="payerr" class="small err" role="alert"></div>
      <button class="btn primary block" type="submit">Send payment advice</button></form>`);
  }
  const strong = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

  /* ---------- events ---------- */
  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-add],[data-variant],[data-pq],[data-iq],[data-rm],[data-otab],[data-pay],[data-close],[data-logout],[data-print],#review,#placeorder,#install");
    if (!t) return; const d = t.dataset;
    if (d.close !== undefined) { closeModal(); return; }
    if (d.logout !== undefined) { closeModal(); history.replaceState(null, "", location.pathname); await auth.signOut(); return; }
    if (d.print !== undefined) { window.print(); return; }
    if (D.role !== "customer") return;
    if (d.add) { addToCart(d.add, +(d.q || 1)); pState.qty = 1; return; }
    if (d.variant) { pState.mat = d.variant; route(); return; }
    if (d.pq) { pState.qty = Math.max(1, pState.qty + +d.pq); route(); return; }
    if (d.iq) { const [m, q] = d.iq.split("|"); const it = cart().items.find(i => i.mat === m); if (it) { it.qty += +q; if (it.qty < 1) cart().items.splice(cart().items.indexOf(it), 1); } saveCart(); route(); return; }
    if (d.rm) { const c = cart(); c.items = c.items.filter(i => i.mat !== d.rm); saveCart(); route(); return; }
    if (d.otab) { nav("#orders-" + d.otab); return; }
    if (d.pay) { payModal(d.pay); return; }
    if (t.id === "review") { confirmModal(); return; }
    if (t.id === "placeorder") { placeOrder(t); return; }
    if (t.id === "install" && D.installEvt) { D.installEvt.prompt(); D.installEvt = null; }
  });
  document.addEventListener("input", e => { const f = e.target.dataset && e.target.dataset.f; if (f && D.role === "customer") { cart()[f] = e.target.value; saveCart(); } });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {}; if (D.role !== "customer") return;
    if (e.target.id === "typesel") { catState.type = e.target.value; nav(e.target.value === "ALL" ? "#catalog" : "#catalog-" + encodeURIComponent(e.target.value)); }
    if (d.av) { catState.avail[d.av] = e.target.checked; route(); }
  });
  document.addEventListener("submit", async e => {
    const f = e.target; if (!["setupform", "loginform", "resetform", "pwform", "payform"].includes(f.id)) return;
    e.preventDefault(); const fd = new FormData(f); const btn = f.querySelector("button[type=submit]");
    const busy = on => { if (btn) btn.disabled = on; };
    if (f.id === "setupform") {
      const p1 = String(fd.get("p1")), p2 = String(fd.get("p2")); const err = $("#setuperr");
      if (p1 !== p2) { err.textContent = "The two passwords do not match."; return; }
      if (!strong(p1)) { err.textContent = "Use at least 8 characters with a letter and a number."; return; }
      busy(true);
      try {
        let cred; try { cred = await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, p1); } catch (x) { if (/email-already-in-use/.test(x.code || "")) cred = await auth.signInWithEmailAndPassword(ADMIN_EMAIL, p1); else throw x; }
        await fs.doc("config/owner").set({ uid: cred.user.uid, at: nowIso() });
        await fs.doc("config/settings").set({ sellPct: 200, gstPct: 5, lowAt: 3, creditDays: 30, payTo: "", updatedAt: nowIso() });
        D.hasOwner = true; toast("Admin created."); history.replaceState(null, "", "#dash");
        D.role = "admin"; D.me = { uid: cred.user.uid, loginId: "admin", name: "DHH Admin" }; window.DSAdmin.start();
      } catch (x) { err.textContent = niceErr(x); busy(false); }
      return;
    }
    if (f.id === "loginform") {
      const id = String(fd.get("loginid") || "").trim().toLowerCase(), pw = String(fd.get("pw") || ""); const err = $("#loginerr");
      if (!id || !pw) { err.textContent = "Enter your login ID and password."; return; }
      busy(true); err.textContent = ""; D.loginErr = "";
      try {
        let email = ADMIN_EMAIL;
        if (id !== "admin") { const L = await fs.doc("logins/" + id.replace(/[\/.#$\[\]]/g, "_")).get(); if (!L.exists || L.data().disabled) throw { code: L.exists ? "permission-denied" : "invalid-credential" }; email = L.data().email; }
        await auth.signInWithEmailAndPassword(email, pw);
        history.replaceState(null, "", id === "admin" ? "#dash" : "#home");
      } catch (x) { err.textContent = x.code === "permission-denied" ? "This login has been switched off. Please call DHH." : niceErr(x); busy(false); }
      return;
    }
    if (f.id === "resetform") {
      const p1 = String(fd.get("p1")), p2 = String(fd.get("p2")); const err = $("#reseterr");
      if (p1 !== p2) { err.textContent = "The two passwords do not match."; return; }
      if (!strong(p1)) { err.textContent = "Use at least 8 characters with a letter and a number."; return; }
      busy(true);
      try { await auth.currentUser.updatePassword(p1); await fs.doc("users/" + D.me.uid).update({ mustReset: false, pwChangedAt: nowIso() }); D.me.mustReset = false; toast("Password saved."); history.replaceState(null, "", "#home"); startCustomer(); }
      catch (x) { err.textContent = niceErr(x); busy(false); }
      return;
    }
    if (f.id === "pwform") {
      const old = String(fd.get("old")), p1 = String(fd.get("p1")), p2 = String(fd.get("p2")); const err = $("#pwerr");
      if (!old) { err.textContent = "Enter your current password."; return; }
      if (p1 !== p2) { err.textContent = "The two new passwords do not match."; return; }
      if (!strong(p1)) { err.textContent = "Use at least 8 characters with a letter and a number."; return; }
      busy(true);
      try { const u = auth.currentUser; await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, old)); await u.updatePassword(p1); f.reset(); err.textContent = ""; toast("Password changed."); }
      catch (x) { err.textContent = /wrong-password|invalid-credential/.test(x.code || "") ? "Current password is not right." : niceErr(x); }
      busy(false); return;
    }
    if (f.id === "payform") {
      const o = D.orders[f.dataset.oid]; const err = $("#payerr");
      const amt = Number(String(fd.get("amount")).replace(/[^\d.]/g, "")); const ref = String(fd.get("ref") || "").trim();
      if (!(amt > 0)) { err.textContent = "Enter the amount paid."; return; }
      if (!ref) { err.textContent = "Enter the UTR or cheque number."; return; }
      busy(true);
      try { await fs.collection("advices").add({ cid: D.me.cid, uid: D.me.uid, userName: D.me.name || D.me.loginId, custName: (D.cust || {}).name || "", orderId: f.dataset.oid, orderNo: o.no, invNo: (o.bill || {}).no || "", amount: amt, mode: String(fd.get("mode")), ref, date: String(fd.get("date") || ""), status: "new", at: nowIso() }); closeModal(); toast("Payment advice sent to DHH."); route(); }
      catch (x) { err.textContent = niceErr(x); busy(false); }
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#modal-root").innerHTML) closeModal(); });
  $("#modal-root").addEventListener("click", e => { if (e.target.classList.contains("scrim")) closeModal(); });
  let qt; $("#q").addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => { if (!location.hash.startsWith("#catalog")) location.hash = "#catalog"; else route(); }, 250); });
  window.addEventListener("hashchange", go);
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); D.installEvt = e; });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  window.DS = { artOf, pic, IMG, D, fs, auth, cfg, DOMAIN, $, esc, r2, inr, num, fmtDate, fmtDT, today, addDays, daysBetween, nowIso, AV, avPill, ST, stPill, FLOW, TYPES, ico, totals, totalsHtml, orderBalance, duesOf, timelineHtml, toast, modal, closeModal, route, nav, niceErr, strong, vAccount, rr, stopSubs };
})();
