/* D Shop — admin panel (sign in with login ID "admin").
   Dashboard · Orders · Customers (discounts, logins) · Products (rates, Excel upload) · Payments · Settings */
(function () {
  "use strict";
  const S = window.DS; if (!S) return;
  const { D, fs, $, esc, r2, inr, num, fmtDate, fmtDT, today, addDays, daysBetween, nowIso, avPill, stPill, TYPES, ico, totals, totalsHtml, orderBalance, timelineHtml, toast, modal, closeModal, route, nav, niceErr } = S;
  const A = { customers: {}, users: {}, logins: {}, orders: {}, payments: {}, advices: {}, products: [], prodLoaded: false, settings: { sellPct: 200, gstPct: 5, lowAt: 3, creditDays: 30, payTo: "" }, catalogInfo: null, temp: null,
    v: { ord: { st: "open", q: "" }, prod: { q: "", type: "", page: 0, only: "" }, pay: { tab: "advices" }, cust: { q: "" } } };
  const PRODUCT_TYPES = ["Locking screws", "Cortex screws", "Cancellous & cannulated screws", "Other screws & bolts", "Plates", "Nails", "Washers", "Hip & joint", "Stents", "Balloon catheters", "Guide wires", "Sheaths & catheters", "Staplers & sutures", "Test kits", "Other products"];
  function guessType(desc) {
    const d = " " + String(desc || "").toUpperCase() + " ";
    if (/NAIL/.test(d)) return "Nails";
    if (/PLATE|[\s,]PL[\s,]|PL\s*[LR]\s/.test(d)) return "Plates";
    if (/STENT/.test(d)) return "Stents";
    if (/BALLOON|PTCA/.test(d)) return "Balloon catheters";
    if (/GUIDE ?WIRE/.test(d)) return "Guide wires";
    if (/SHEATH|INTRODUCER|CATHETER/.test(d)) return "Sheaths & catheters";
    if (/STAPLER|RELOAD|SUTURE/.test(d)) return "Staplers & sutures";
    if (/TEST|KIT/.test(d)) return "Test kits";
    if (/LOCK(ING)?\s*(CANCELLOUS\s*)?(SCREW|SC\b)/.test(d)) return "Locking screws";
    if (/CORTEX/.test(d)) return "Cortex screws";
    if (/CANNU|CANCELL?OU/.test(d)) return "Cancellous & cannulated screws";
    if (/SCREW|[\s,]SC[\s,]|BOLT/.test(d)) return "Other screws & bolts";
    if (/WASHER/.test(d)) return "Washers";
    if (/BI-?POLAR|STEM|SHELL|FEMORAL HEAD|\bCUP\b|LINER/.test(d)) return "Hip & joint";
    return "Other products";
  }
  function splitSize(desc) { const s = String(desc || "").trim(); const m = s.match(/^(.*?)[\s,]*\bL\s?(\d+(?:\.\d+)?)\s*(MM)?$/i); return m && m[1].length >= 6 ? { family: m[1].trim(), size: "L" + m[2] } : { family: s, size: "" }; }
  const custName = cid => (A.customers[cid] || {}).name || "(removed customer)";
  const sellOf = p => +p.price > 0 ? r2(+p.price) : r2((+p.rate || 0) * (1 + (+A.settings.sellPct || 0) / 100));
  const isOpen = o => ["sent", "confirmed", "dispatched", "delivered"].includes(o.status);
  const ordersArr = () => Object.entries(A.orders).map(([id, o]) => ({ id, ...o })).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const custOutstanding = cid => ordersArr().filter(o => o.cid === cid).reduce((n, o) => n + orderBalance(o, A.payments), 0);
  const msgBox = () => `<div id="admmsg" class="small" role="status"></div>`;
  function say(kind, t) { const el = $("#admmsg"); if (el) { el.className = "admmsg " + kind; el.textContent = t; el.scrollIntoView({ block: "nearest" }); } else toast(t); }

  /* ---------- start + subscriptions ---------- */
  function start() {
    S.stopSubs(); D.state = "app";
    const col = (name, key) => D.unsubs.push(fs.collection(name).onSnapshot(s => { A[key] = {}; s.docs.forEach(d => A[key][d.id] = d.data()); S.rr(); }, e => { D.err = niceErr(e); S.rr(); }));
    col("customers", "customers"); col("users", "users"); col("logins", "logins"); col("orders", "orders"); col("payments", "payments"); col("advices", "advices");
    D.unsubs.push(fs.doc("private/products").onSnapshot(s => { if (!A.saving) { A.products = s.exists ? (s.data().list || []) : []; A.feedSig = s.exists ? s.data().feedSig || null : null; } A.prodLoaded = true; mergeFeed(); checkCatalog(); S.rr(); }, () => {}));
    D.unsubs.push(fs.doc("private/dcartFeed").onSnapshot(s => { A.feed = s.exists ? s.data() : null; mergeFeed(); S.rr(); }, () => {}));
    D.unsubs.push(fs.doc("config/settings").onSnapshot(s => { if (s.exists) A.settings = { ...A.settings, ...s.data() }; S.rr(); }, () => {}));
    D.unsubs.push(fs.doc("catalog/main").onSnapshot(s => { A.catalogInfo = s.exists ? { count: s.data().count, at: s.data().updatedAt, calc: s.data().calc } : null; A.catLoaded = true; checkCatalog(); S.rr(); }, () => {}));
    if (!location.hash || location.hash === "#") history.replaceState(null, "", "#dash");
    route();
  }
  function navList() {
    const nNew = Object.values(A.orders).filter(o => o.status === "sent").length, nAdv = Object.values(A.advices).filter(a => (a.status || "new") === "new").length;
    return [["dash", "Dashboard", "home"], ["orders", "Orders", "box", nNew || ""], ["customers", "Customers", "users"], ["products", "Products", "tag"], ["payments", "Payments", "card", nAdv || ""], ["settings", "Settings", "gear"]];
  }
  function view(name, arg) {
    const V = { dash: vDash, orders: vOrders, customers: vCustomers, products: vProducts, payments: vPayments, settings: vSettings, account: S.vAccount };
    if (!V[name]) name = "dash";
    return { html: (D.err ? `<div class="demo" style="margin-bottom:12px">${esc(D.err)}</div>` : "") + V[name](arg), name };
  }
  function after() {}

  /* ---------- catalog publishing (selling price only, never the rate) ---------- */
  const CALC = 2;   // price formula version: rate + sell % (same as D Cart)
  // Re-make the customer price list by itself if it was made with an older formula, or came out empty while priced products exist.
  function checkCatalog() {
    if (!A.prodLoaded || !A.catLoaded || A.checking) return;
    const priced = A.products.some(p => !p.hidden && sellOf(p) > 0);
    if (!A.catalogInfo || A.catalogInfo.calc !== CALC || (priced && !A.catalogInfo.count)) { A.checking = true; publishCatalog().catch(() => {}).finally(() => setTimeout(() => (A.checking = false), 3000)); }
  }
  let pubT = null;
  function schedulePublish() { clearTimeout(pubT); pubT = setTimeout(() => publishCatalog().catch(e => say("bad", "Couldn't publish the catalog: " + niceErr(e))), 700); }
  async function publishCatalog() {
    if (!A.prodLoaded) throw new Error("Products are still loading. Try again in a moment.");
    const low = +A.settings.lowAt || 0;
    const list = A.products.filter(p => p.code && p.desc && !p.hidden && sellOf(p) > 0).map(p => {
      const { family, size } = splitSize(p.desc); const st = +p.stock || 0;
      return { mat: String(p.code), desc: String(p.desc), family, size, type: p.type || guessType(p.desc), uom: String(p.uom || ""), hsn: String(p.hsn || ""), price: sellOf(p), avail: st > low ? "ok" : st > 0 ? "low" : "req" };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.family.localeCompare(b.family) || a.desc.localeCompare(b.desc, undefined, { numeric: true }));
    await fs.doc("catalog/main").set({ list, count: list.length, calc: CALC, gstPct: +A.settings.gstPct || 0, payTo: A.settings.payTo || "", updatedAt: nowIso() });
  }
  let saveT = null;
  function saveProducts(now) {
    clearTimeout(saveT); A.saving = true;
    const run = async () => { try { await fs.doc("private/products").set({ list: A.products, count: A.products.length, feedSig: A.feedSig || null, updatedAt: nowIso() }); await publishCatalog(); } catch (e) { say("bad", "Couldn't save products: " + niceErr(e)); } finally { A.saving = false; } };
    if (now) return run(); saveT = setTimeout(run, 700);
  }

  /* ---------- product names and sizes sent by D Cart (Admin panel → D Shop link) ---------- */
  // Same list already taken in, but some products still have no rate (e.g. an older
  // D Shop tab took the list in without rates): fill only the missing ones.
  async function fillMissingRates(F) {
    const rates = new Map((F.list || []).filter(f => f.code && +f.rate > 0).map(f => [f.code, r2(+f.rate)]));
    const miss = A.products.filter(p => !(+p.rate > 0) && rates.has(p.code));
    if (!miss.length || A.merging) return;
    A.merging = true;
    try { for (const p of miss) { p.rate = rates.get(p.code); p.rateFromDcart = true; } await saveProducts(true); toast(`Rates from D Cart added to ${miss.length} product${miss.length > 1 ? "s" : ""}.`); }
    catch (e) { say("bad", "Couldn't add D Cart's rates: " + niceErr(e)); }
    finally { A.merging = false; S.rr(); }
  }
  async function mergeFeed() {
    const F = A.feed; if (!F || !A.prodLoaded || A.merging || !F.sig || F.sig === A.failedSig) return;
    if (F.sig === A.feedSig) return fillMissingRates(F);
    A.merging = true;
    try {
      const idx = new Map(A.products.map((p, i) => [p.code, i])); const inFeed = new Set(); let added = 0, changed = 0;
      for (const f of F.list || []) {
        if (!f.code || !f.desc) continue; inFeed.add(f.code);
        if (idx.has(f.code)) { const p = A.products[idx.get(f.code)]; const fr = +f.rate > 0 ? r2(+f.rate) : null;
          if (p.desc !== f.desc || (f.hsn && p.hsn !== f.hsn) || (f.uom && p.uom !== f.uom) || p.notInDcart || (fr != null && p.rate !== fr)) { p.desc = f.desc; if (f.hsn) p.hsn = f.hsn; if (f.uom) p.uom = f.uom; if (fr != null) { p.rate = fr; p.rateFromDcart = true; } delete p.notInDcart; changed++; } p.fromDcart = true; }
        else { const np = { code: f.code, desc: f.desc, hsn: f.hsn || "", uom: f.uom || "", stock: 0, fromDcart: true, isNew: true }; if (+f.rate > 0) { np.rate = r2(+f.rate); np.rateFromDcart = true; } A.products.push(np); added++; }
      }
      for (const p of A.products) if (p.fromDcart && !inFeed.has(p.code) && !p.notInDcart) { p.notInDcart = true; changed++; }
      A.feedSig = F.sig; A.lastFeed = { added, changed, at: F.updatedAt };
      await saveProducts(true);
      if (added) toast(`${added} new product${added > 1 ? "s" : ""} from D Cart, priced automatically.`);
    } catch (e) { A.failedSig = F.sig; say("bad", "Couldn't take in D Cart's product list: " + niceErr(e)); }
    finally { A.merging = false; S.rr();
      // a newer list may have arrived from D Cart while this one was being taken in
      if (A.feed && A.feed.sig && A.feed.sig !== A.feedSig && A.feed.sig !== A.failedSig) setTimeout(mergeFeed, 300); }
  }

  /* ---------- logins ---------- */
  function tempPassword() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const r = crypto.getRandomValues(new Uint32Array(8)); let s = ""; for (let i = 0; i < 8; i++) s += a[r[i] % a.length]; return s.slice(0, 4) + "@" + s.slice(4) + (/\d/.test(s) ? "" : "7"); }
  let second = null;
  function secondAuth() { if (second) return second; const app = (firebase.apps || []).find(a => a.name === "dshopLogins") || firebase.initializeApp(S.cfg, "dshopLogins"); second = app.auth(); try { second.setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) {} return second; }
  async function createAuth(email, pw) { const a = secondAuth(); const c = await a.createUserWithEmailAndPassword(email, pw); const uid = c.user.uid; await a.signOut(); return uid; }
  async function addLogin(cid, loginId, person) {
    loginId = String(loginId || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(loginId)) throw new Error("Login ID: 3–30 lowercase letters or numbers (dash and underscore allowed).");
    if (loginId === "admin") throw new Error("\"admin\" is reserved for you. Choose another login ID.");
    if ((await fs.doc("logins/" + loginId).get()).exists) throw new Error("Login ID " + loginId + " is already used.");
    const pw = tempPassword(), email = loginId + "@" + S.DOMAIN;
    const uid = await createAuth(email, pw).catch(e => { throw new Error(niceErr(e)); });
    await fs.doc("users/" + uid).set({ uid, loginId, email, name: person || "", cid, mustReset: true, active: true, createdAt: nowIso() });
    await fs.doc("logins/" + loginId).set({ email, uid, cid, version: 1, disabled: false, updatedAt: nowIso() });
    return { loginId, pw, isNew: true };
  }
  // A person can only change their own Firebase password, so "new temporary password" gives the login ID a fresh sign-in account.
  async function resetLogin(loginId) {
    const L = A.logins[loginId]; if (!L) throw new Error("Login not found.");
    const old = A.users[L.uid] || {}; const v = (+L.version || 1) + 1; const pw = tempPassword(); const email = `${loginId}.r${v}@${S.DOMAIN}`;
    const uid = await createAuth(email, pw).catch(e => { throw new Error(niceErr(e)); });
    await fs.doc("users/" + uid).set({ uid, loginId, email, name: old.name || "", cid: L.cid, mustReset: true, active: true, createdAt: nowIso(), replaces: L.uid });
    if (A.users[L.uid]) await fs.doc("users/" + L.uid).update({ active: false, replacedAt: nowIso() });
    await fs.doc("logins/" + loginId).set({ email, uid, cid: L.cid, version: v, disabled: false, updatedAt: nowIso() });
    return { loginId, pw, isNew: false };
  }
  async function setLoginOn(loginId, on) { const L = A.logins[loginId]; if (!L) return; await fs.doc("users/" + L.uid).update({ active: !!on }); await fs.doc("logins/" + loginId).update({ disabled: !on, updatedAt: nowIso() }); }
  const shopLink = () => location.origin + location.pathname.replace(/index\.html$/, "");
  function showTemp(t) {
    A.temp = t;
    modal(`<div class="stack" style="gap:12px"><h2 class="display" style="font-size:20px">${t.isNew ? "Login created" : "New temporary password"}</h2>
      <div class="card pad stack" style="gap:6px;background:var(--bg)"><div>Login ID: <b class="mono big">${esc(t.loginId)}</b></div><div>Temporary password: <b class="mono big">${esc(t.pw)}</b></div><div class="small">D Shop: ${esc(shopLink())}</div></div>
      <div class="small muted">Send these to the customer (for example on WhatsApp). They must set their own password the first time they sign in. This password is shown only now.</div>
      <div class="row"><button class="btn ghost" style="flex:1" data-acopy>Copy</button><a class="btn ghost" style="flex:1" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`D Shop – Dr Han Health Care\n${shopLink()}\nLogin ID: ${t.loginId}\nTemporary password: ${t.pw}`)}">WhatsApp</a><button class="btn primary" style="flex:1" data-close>Done</button></div></div>`);
  }

  /* ---------- views ---------- */
  function tiles(arr) { return `<div class="grid kpis">${arr.map(([l, v, cls, href]) => `<a ${href ? `href="${href}"` : ""} class="card pad kpi ${cls || ""}"><b>${v}</b><span class="tiny ${cls ? "" : "muted"}">${l}</span></a>`).join("")}</div>`; }
  function vDash() {
    const os = ordersArr(); const nNew = os.filter(o => o.status === "sent"); const open = os.filter(isOpen);
    const dues = S.duesOf(A.orders, A.payments); const out = dues.reduce((n, x) => n + x.balance, 0), over = dues.filter(x => x.o.bill.due < today()).reduce((n, x) => n + x.balance, 0);
    const adv = Object.entries(A.advices).filter(([, a]) => (a.status || "new") === "new");
    const setup = [!A.products.length && ["Connect D Cart (D Cart → Admin panel → D Shop link) or upload products", "#products"], A.products.length && A.products.some(p => !p.hidden && !(sellOf(p) > 0)) && [`Give a rate to ${A.products.filter(p => !p.hidden && !(sellOf(p) > 0)).length} products without a price`, "#products"], !Object.keys(A.customers).length && ["Create your first customer login", "#customers"], !A.settings.payTo && ["Add your UPI / bank details for customers", "#settings"]].filter(Boolean);
    return `<div class="stack" style="gap:18px">
      <h1 class="display" style="font-size:26px">D Shop admin</h1>
      ${setup.length ? `<div class="card pad stack" style="gap:6px;border-color:var(--brand)"><b>Getting started</b>${setup.map(([t, h]) => `<a class="small strong" href="${h}">→ ${t}</a>`).join("")}</div>` : ""}
      ${tiles([["New orders", nNew.length, nNew.length ? "warn" : "", "#orders"], ["Open orders", open.length, "", "#orders"], ["Outstanding", inr(out), "", "#payments-dues"], ["Overdue", inr(over), over ? "warn" : "", "#payments-dues"]])}
      <section class="stack"><div class="row between"><h2>New orders</h2><a class="small strong" href="#orders">All orders</a></div>
        ${nNew.length ? `<div class="card list">${nNew.slice(0, 8).map(o => ordRow(o)).join("")}</div>` : `<div class="card empty">No new orders.</div>`}</section>
      ${adv.length ? `<section class="stack"><div class="row between"><h2>Payment advices to check</h2><a class="small strong" href="#payments">Open</a></div><div class="card list">${adv.slice(0, 5).map(([, a]) => `<div class="row between" style="padding:10px 14px"><span class="small"><b>${esc(a.custName || custName(a.cid))}</b> · invoice ${esc(a.invNo)} · ${esc(a.mode)} ${esc(a.ref)}</span><b>${inr(a.amount)}</b></div>`).join("")}</div></section>` : ""}
    </div>`;
  }
  function ordRow(o) { return `<a href="#orders-${encodeURIComponent(o.id)}" class="row" style="padding:12px 14px;gap:10px"><div style="flex:1;min-width:0"><b>${esc(custName(o.cid))}</b> <span class="tiny muted">${esc(o.no)}</span><div class="tiny muted ellip">${(o.lines || []).map(l => `${l.qty} × ${esc(l.desc)}`).join(", ")}</div></div><div style="text-align:right"><b class="small">${inr((o.totals || {}).grand)}</b><div>${stPill(o.status)}</div></div></a>`; }
  function vOrders(arg) {
    if (arg) return vOrder(decodeURIComponent(arg));
    const V = A.v.ord; const q = V.q.toLowerCase();
    const list = ordersArr().filter(o => (V.st === "all" || (V.st === "open" ? isOpen(o) : o.status === V.st)) && (!q || [o.no, custName(o.cid), o.userName, ...(o.lines || []).map(l => l.desc + " " + l.mat)].join(" ").toLowerCase().includes(q)));
    return `<div class="stack"><div class="row between wrap"><h1 class="display" style="font-size:24px">Orders</h1><button class="btn sm ghost" data-aexport="orders">Download Excel</button></div>
      <div class="row wrap"><select data-aord="st" aria-label="Status">${[["open", "Open"], ["sent", "New"], ["confirmed", "Confirmed"], ["dispatched", "Dispatched"], ["delivered", "Delivered"], ["billed", "Billed"], ["rejected", "Can't supply"], ["cancelled", "Cancelled"], ["all", "All"]].map(([k, l]) => `<option value="${k}" ${V.st === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <input type="search" class="inp" data-aord="q" placeholder="Search order, customer, product…" value="${esc(V.q)}" style="flex:1;min-width:200px"><span class="small muted">${list.length}</span></div>
      ${list.length ? `<div class="card list">${list.map(ordRow).join("")}</div>` : `<div class="card empty">No orders here.</div>`}</div>`;
  }
  function vOrder(id) {
    const o0 = A.orders[id]; if (!o0) return `<div class="card empty">Order not found. <a href="#orders">Back</a></div>`;
    const o = { id, ...o0 }; const c = A.customers[o.cid] || {}; const t = o.totals || {}; const s = o.surgery || {}; const bal = orderBalance(o, A.payments);
    const pays = Object.entries(A.payments).filter(([, p]) => p.orderId === id && p.status !== "void");
    const acts = [];
    if (o.status === "sent") acts.push(`<button class="btn primary" data-aact="confirm">Confirm order</button>`);
    if (["sent", "confirmed"].includes(o.status)) acts.push(`<button class="btn" data-aact="dispatch">Mark dispatched</button>`);
    if (o.status === "dispatched") acts.push(`<button class="btn" data-aact="deliver">Mark delivered</button>`);
    if (["confirmed", "dispatched", "delivered"].includes(o.status)) acts.push(`<button class="btn ${o.status === "delivered" ? "primary" : ""}" data-aact="bill">Enter invoice</button>`);
    if (o.status === "billed" && bal > 0.5) acts.push(`<button class="btn primary" data-aact="pay">Record payment</button>`);
    if (isOpen(o)) acts.push(`<button class="btn" data-aact="edit">Change items</button>`);
    if (o.status === "sent") acts.push(`<button class="btn danger" data-aact="reject">Can't supply</button>`);
    if (["confirmed", "dispatched", "delivered"].includes(o.status)) acts.push(`<button class="btn danger" data-aact="cancel">Cancel</button>`);
    return `<div class="stack" style="max-width:900px;gap:14px" data-order="${esc(id)}">
      <div class="row between noprint"><a href="#orders" class="row small strong" style="gap:4px">${ico("back", 18)}Orders</a><button class="btn sm ghost" data-print>Print</button></div>
      <div class="banner"><div class="row between wrap"><h1 class="display" style="font-size:22px">${esc(custName(o.cid))}</h1><span class="sub">${esc(o.no)} · ${S.ST[o.status] ? S.ST[o.status][0] : o.status}</span></div>
        <div class="sub">Placed ${fmtDT(o.createdAt)} by ${esc(o.userName || o.loginId)} · ${esc((TYPES[c.type] || {}).label || "")} · discount ${esc(o.discount)}%</div></div>
      ${msgBox()}
      ${acts.length ? `<div class="row wrap noprint">${acts.join("")}</div>` : ""}
      ${timelineHtml(o, false)}
      ${s.surgeon || s.patient || s.date || o.deliverTo || o.note ? `<div class="card pad small stack" style="gap:4px">${o.deliverTo ? `<div><b>Deliver to:</b> ${esc(o.deliverTo)}</div>` : ""}${s.surgeon ? `<div><b>Surgeon:</b> ${esc(s.surgeon)}</div>` : ""}${s.patient ? `<div><b>Patient / IP:</b> ${esc(s.patient)}</div>` : ""}${s.date ? `<div><b>Surgery date:</b> ${fmtDate(s.date)}</div>` : ""}${o.note ? `<div><b>Note:</b> ${esc(o.note)}</div>` : ""}</div>` : ""}
      <section class="card"><div class="scrollx"><table class="tbl"><thead><tr><th>Code</th><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th><th class="num">Stock now</th></tr></thead><tbody>
        ${(o.lines || []).map(l => { const p = A.products.find(x => x.code === l.mat); const st = p ? +p.stock || 0 : null; return `<tr><td class="mono">${esc(l.mat)}</td><td>${esc(l.desc)}</td><td class="num">${num(l.qty)}</td><td class="num">${inr(l.price)}</td><td class="num">${inr(l.price * l.qty)}</td><td class="num">${st == null ? "—" : st < l.qty ? `<b class="warnc">${num(st)}</b>` : num(st)}</td></tr>`; }).join("")}
      </tbody></table></div><div style="padding:12px 16px;max-width:420px;margin-left:auto">${totalsHtml(t, o.discount, o.gstPct)}</div></section>
      ${o.bill ? `<div class="card pad stack" style="gap:6px"><b>Invoice ${esc(o.bill.no)}</b><div class="small">${fmtDate(o.bill.date)} · due ${fmtDate(o.bill.due)} · amount ${inr(o.bill.amount)} · <b>${bal > 0.5 ? "balance " + inr(bal) : "paid in full"}</b></div>
        ${pays.length ? `<div class="list small">${pays.map(([pid, p]) => `<div class="row between" style="padding:6px 0"><span>${fmtDate(p.date)} · ${esc(p.mode)} ${esc(p.ref || "")}</span><span>${inr(p.amount)} <button class="btn sm ghost noprint" data-avoid="${esc(pid)}">Remove</button></span></div>`).join("")}</div>` : ""}</div>` : ""}
    </div>`;
  }
  function vCustomers() {
    const V = A.v.cust; const q = V.q.toLowerCase();
    const custs = Object.entries(A.customers).map(([id, c]) => ({ id, ...c })).filter(c => !q || (c.name + " " + Object.keys(A.logins).filter(l => A.logins[l].cid === c.id).join(" ")).toLowerCase().includes(q)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const loginsOf = cid => Object.entries(A.logins).filter(([, l]) => l.cid === cid).map(([id, l]) => ({ id, ...l, u: A.users[l.uid] || {} }));
    return `<div class="stack" style="gap:16px">
      <div class="row between wrap"><h1 class="display" style="font-size:24px">Customers</h1><button class="btn primary" data-anewcust>+ New customer</button></div>
      <div class="small muted">Discount % comes off every product in the customer's cart (Rate + ${num(A.settings.sellPct)}%), before ${num(A.settings.gstPct)}% GST. A new login gets a temporary password; the customer sets their own at first sign-in.</div>
      ${msgBox()}
      <input type="search" class="inp" data-acust="q" placeholder="Search customer or login ID…" value="${esc(V.q)}">
      <div class="card scrollx"><table class="tbl"><thead><tr><th>Customer</th><th>Type</th><th class="num">Discount %</th><th class="num">Credit days</th><th class="num">Outstanding</th><th>Logins</th></tr></thead><tbody>
      ${custs.length ? custs.map(c => { const ls = loginsOf(c.id); const out = custOutstanding(c.id); return `<tr>
        <td><b>${esc(c.name)}</b>${c.phone ? `<div class="tiny muted">${esc(c.phone)}</div>` : ""}</td>
        <td><select data-actype="${esc(c.id)}" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${c.type === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></td>
        <td class="num"><input class="inp sm num" type="number" min="0" max="90" step="0.5" value="${esc(c.discount || 0)}" data-adisc="${esc(c.id)}" aria-label="Discount % for ${esc(c.name)}"></td>
        <td class="num"><input class="inp sm num" type="number" min="0" max="365" step="1" value="${esc(c.creditDays ?? A.settings.creditDays)}" data-acred="${esc(c.id)}" aria-label="Credit days for ${esc(c.name)}"></td>
        <td class="num">${out > 0.5 ? inr(out) : "—"}</td>
        <td>${ls.map(l => `<div class="loginrow"><span class="mono">${esc(l.id)}</span> <span class="tiny muted">${esc(l.u.name || "")}</span> ${l.disabled || l.u.active === false ? '<span class="pill st-callback">Off</span>' : l.u.mustReset ? '<span class="pill av-low">Temporary password</span>' : '<span class="pill av-ok">Active</span>'}${l.u.lastSeen ? `<span class="tiny muted"> · seen ${fmtDT(l.u.lastSeen)}</span>` : ""}
          <div class="row wrap" style="gap:6px;margin-top:4px"><button class="btn sm ghost" data-areset="${esc(l.id)}">New temp password</button><button class="btn sm ghost" data-aonoff="${esc(l.id)}" data-on="${l.disabled ? 1 : 0}">${l.disabled ? "Switch on" : "Switch off"}</button></div></div>`).join("") || '<span class="tiny muted">No login</span>'}
          <button class="btn sm" data-aaddlogin="${esc(c.id)}" style="margin-top:6px">+ Login</button></td></tr>`; }).join("") : `<tr><td colspan="6" class="empty">No customers yet. Click “New customer”.</td></tr>`}
      </tbody></table></div></div>`;
  }
  function vProducts() {
    const V = A.v.prod; const q = V.q.toLowerCase(); const low = +A.settings.lowAt || 0;
    const types = [...new Set([...PRODUCT_TYPES, ...A.products.map(p => p.type).filter(Boolean)])];
    const all = A.products.map((p, i) => ({ p, i, type: p.type || guessType(p.desc) }));
    const f = all.filter(x => (!V.type || x.type === V.type) && (!q || (x.p.code + " " + x.p.desc).toLowerCase().includes(q)) && (V.only !== "hidden" || x.p.hidden) && (V.only !== "noprice" || !(sellOf(x.p) > 0)) && (V.only !== "out" || !(+x.p.stock > 0)) && (V.only !== "new" || x.p.isNew) && (V.only !== "gone" || x.p.notInDcart));
    const per = 60, pages = Math.max(1, Math.ceil(f.length / per)); if (V.page >= pages) V.page = pages - 1; const pg = f.slice(V.page * per, V.page * per + per);
    const shown = all.filter(x => !x.p.hidden && sellOf(x.p) > 0).length;
    return `<div class="stack" style="gap:14px">
      <div class="row between wrap"><h1 class="display" style="font-size:24px">Products</h1><div class="row wrap"><button class="btn primary" data-aupload>Upload Excel</button><button class="btn ghost" data-aexport="products">Download Excel</button><button class="btn ghost" data-aaddprod>+ Product</button></div></div>
      <div class="small muted">Customers see each product's <b>selling price = Rate + ${num(A.settings.sellPct)}%</b> (or your own price if you fill one in), less their discount, and availability: In stock (more than ${low}), Low (1–${low}) or On request (0). Rates and stock counts are never shown to customers.
        ${A.catalogInfo ? ` Published: ${A.catalogInfo.count} products, ${fmtDT(A.catalogInfo.at)}.` : " Not published yet."}</div>
      ${A.feed ? `<div class="card pad small stack" style="gap:4px;border-color:var(--brand)"><div><b>Products and rates come from D Cart automatically</b> (last update ${fmtDT(A.feed.updatedAt)}, ${A.feed.count} products, <b>${(A.feed.list || []).filter(f => +f.rate > 0).length}</b> with a rate). Customers see Rate + ${num(A.settings.sellPct)}% (same as D Cart's Sell %). A rate you type here is replaced when D Cart's rate changes, so to fix a price for a product, use <b>Own price</b>. Enter <b>Stock</b> here so customers see In stock / Low.</div>${(() => { const nNew = A.products.filter(p => p.isNew).length, nNo = A.products.filter(p => !p.hidden && !(sellOf(p) > 0)).length; return `${nNew ? `<div><b>${nNew}</b> new from D Cart · <button class="btn sm ghost" data-aonly="new">Show them</button> <button class="btn sm ghost" data-aseen>Mark as seen</button></div>` : ""}${nNo ? `<div class="tiny muted">${nNo} products have no price yet, so customers don't see them.</div>` : ""}`; })()}</div>` : `<div class="tiny muted">Tip: connect D Cart (D Cart → Admin panel → D Shop link) and product names and sizes arrive here automatically.</div>`}
      ${msgBox()}
      <div class="row wrap"><input type="search" class="inp" data-aprod="q" placeholder="Search code or description…" value="${esc(V.q)}" style="flex:1;min-width:200px">
        <select data-aprod="type" aria-label="Product type"><option value="">All types</option>${types.map(t => `<option ${V.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-aprod="only" aria-label="Show"><option value="">All</option><option value="hidden" ${V.only === "hidden" ? "selected" : ""}>Hidden</option><option value="noprice" ${V.only === "noprice" ? "selected" : ""}>No price</option><option value="out" ${V.only === "out" ? "selected" : ""}>Out of stock</option><option value="new" ${V.only === "new" ? "selected" : ""}>New from D Cart</option><option value="gone" ${V.only === "gone" ? "selected" : ""}>No longer in D Cart</option></select>
        <span class="small muted">${f.length} of ${A.products.length} · ${shown} shown to customers</span>
        ${f.length && f.length < A.products.length ? `<span class="row" style="gap:6px"><input class="inp sm num" type="number" min="0" step="0.01" id="abulkrate" value="${esc(V.bulkRate || "")}" placeholder="Rate" aria-label="Rate for all products shown"><button class="btn sm" data-abulk="rate">Set rate for these ${f.length}</button><input class="inp sm num" type="number" step="1" id="abulkstock" value="${esc(V.bulkStock || "")}" placeholder="Stock" aria-label="Stock for all products shown"><button class="btn sm ghost" data-abulk="stock">Set stock</button></span>` : ""}
        ${pages > 1 ? `<button class="btn sm ghost" data-apg="-1" ${V.page ? "" : "disabled"}>‹</button><span class="small">${V.page + 1}/${pages}</span><button class="btn sm ghost" data-apg="1" ${V.page < pages - 1 ? "" : "disabled"}>›</button>` : ""}</div>
      ${A.products.length ? `<div class="card scrollx"><table class="tbl"><thead><tr><th>Show</th><th>Code</th><th>Description</th><th>Type</th><th class="num">Stock</th><th class="num">Rate (₹)</th><th class="num">Own price (₹)</th><th class="num">Selling price</th><th></th></tr></thead><tbody>
        ${pg.map(({ p, i, type }) => `<tr><td><input type="checkbox" data-ashow="${i}" ${p.hidden ? "" : "checked"} aria-label="Show ${esc(p.desc)}"></td><td class="mono">${esc(p.code)}</td><td style="min-width:220px">${esc(p.desc)}${p.isNew ? ' <span class="pill av-low">New</span>' : ""}${p.notInDcart ? ' <span class="pill st-callback">Not in D Cart</span>' : ""}</td>
          <td><select data-atype="${i}" aria-label="Type">${types.map(t => `<option ${type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></td>
          <td class="num"><input class="inp sm num" type="number" step="1" value="${esc(p.stock ?? 0)}" data-astock="${i}" aria-label="Stock"></td>
          <td class="num"><input class="inp sm num" type="number" step="0.01" min="0" value="${esc(p.rate ?? "")}" data-arate="${i}" aria-label="Rate"></td>
          <td class="num"><input class="inp sm num" type="number" step="0.01" min="0" value="${esc(p.price || "")}" placeholder="auto" data-aprice="${i}" aria-label="Own selling price"></td>
          <td class="num" data-asell="${i}">${sellOf(p) > 0 ? inr(sellOf(p)) : '<span class="tiny muted">no price</span>'}</td><td><button class="btn sm ghost" data-adelprod="${i}" aria-label="Delete ${esc(p.desc)}">Delete</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="card empty stack" style="align-items:center"><b>No products yet.</b><div>Upload an Excel or CSV with columns like <b>Code</b>, <b>Description</b>, <b>Rate</b> and <b>Stock</b> (HSN, Unit and Type are optional). D Cart's product export works.</div><button class="btn primary" data-aupload>Upload Excel</button></div>`}
    </div>`;
  }
  function vPayments(arg) {
    if (arg) A.v.pay.tab = arg; const T = A.v.pay.tab;
    const adv = Object.entries(A.advices).map(([id, a]) => ({ id, ...a })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    const dues = S.duesOf(A.orders, A.payments); const byC = {};
    for (const x of dues) { const k = x.o.cid; byC[k] = byC[k] || { out: 0, over: 0, n: 0 }; byC[k].out += x.balance; byC[k].n++; if (x.o.bill.due < today()) byC[k].over += x.balance; }
    const pays = Object.entries(A.payments).map(([id, p]) => ({ id, ...p })).filter(p => p.status !== "void").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 100);
    const tab = (k, l) => `<button role="tab" data-aptab="${k}" class="${T === k ? "on" : ""}" aria-selected="${T === k}">${l}</button>`;
    let body = "";
    if (T === "advices") body = adv.length ? `<div class="card list">${adv.map(a => `<div class="row wrap" style="padding:12px 14px;gap:10px"><div style="flex:1;min-width:220px"><b>${esc(a.custName || custName(a.cid))}</b> <span class="tiny muted">${esc(a.userName || "")}</span><div class="small">Invoice ${esc(a.invNo)} · order ${esc(a.orderNo)} · ${esc(a.mode)} ${esc(a.ref)} · paid ${fmtDate(a.date)}</div><div class="tiny muted">Sent ${fmtDT(a.at)}</div></div><b>${inr(a.amount)}</b>
        ${(a.status || "new") === "new" ? `<button class="btn sm primary" data-aadvok="${esc(a.id)}">Received, record it</button><button class="btn sm ghost" data-aadvno="${esc(a.id)}">Not received</button>` : `<span class="pill ${a.status === "done" ? "av-ok" : "st-callback"}">${a.status === "done" ? "Recorded" : "Not received"}</span>`}</div>`).join("")}</div>` : `<div class="card empty">No payment advices yet.</div>`;
    if (T === "dues") body = Object.keys(byC).length ? `<div class="card scrollx"><table class="tbl"><thead><tr><th>Customer</th><th class="num">Invoices</th><th class="num">Outstanding</th><th class="num">Overdue</th></tr></thead><tbody>${Object.entries(byC).sort((a, b) => b[1].out - a[1].out).map(([cid, x]) => `<tr><td><b>${esc(custName(cid))}</b></td><td class="num">${x.n}</td><td class="num">${inr(x.out)}</td><td class="num">${x.over > 0.5 ? `<b class="warnc">${inr(x.over)}</b>` : "—"}</td></tr>`).join("")}</tbody></table></div>
      <div class="card list">${dues.map(x => `<a class="row between" href="#orders-${encodeURIComponent(x.o.id)}" style="padding:10px 14px"><span class="small"><b>${esc(custName(x.o.cid))}</b> · invoice ${esc(x.o.bill.no)} · due ${fmtDate(x.o.bill.due)}${x.o.bill.due < today() ? ` · <b class="warnc">${daysBetween(x.o.bill.due, today())} days overdue</b>` : ""}</span><b>${inr(x.balance)}</b></a>`).join("")}</div>` : `<div class="card empty">Nothing outstanding.</div>`;
    if (T === "received") body = pays.length ? `<div class="card list">${pays.map(p => `<div class="row between" style="padding:10px 14px"><span class="small"><b>${esc(custName(p.cid))}</b> · ${fmtDate(p.date)} · ${esc(p.mode)} ${esc(p.ref || "")} · invoice ${esc(p.invNo || "")}</span><b>${inr(p.amount)}</b></div>`).join("")}</div>` : `<div class="card empty">No payments recorded yet.</div>`;
    return `<div class="stack" style="gap:14px"><h1 class="display" style="font-size:24px">Payments</h1>${msgBox()}
      <div class="tabs" role="tablist">${tab("advices", `Advices (${adv.filter(a => (a.status || "new") === "new").length})`)}${tab("dues", "Outstanding")}${tab("received", "Received")}</div>${body}</div>`;
  }
  function vSettings() {
    const s = A.settings;
    return `<div class="stack" style="gap:16px;max-width:640px"><h1 class="display" style="font-size:24px">Settings</h1>${msgBox()}
      <form id="asettings" class="card pad stack" novalidate>
        <label class="field">Sell % added on the rate (same as D Cart's Sell %)<input name="sellPct" type="number" min="0" step="1" value="${esc(s.sellPct)}"></label>
        <div class="tiny muted">200 means the rate plus 200%: a ₹150 rate sells at ₹450, a ₹4,000 rate at ₹12,000 (Rate × 3). A product's own price, if filled in, wins.</div>
        <div class="grid two"><label class="field">GST % added at checkout<input name="gstPct" type="number" min="0" max="28" step="0.5" value="${esc(s.gstPct)}"></label>
          <label class="field">"Low" when stock is at or below<input name="lowAt" type="number" min="0" step="1" value="${esc(s.lowAt)}"></label></div>
        <label class="field">Default credit days (due date on invoices)<input name="creditDays" type="number" min="0" max="365" step="1" value="${esc(s.creditDays)}"></label>
        <label class="field">Payment details shown to customers<textarea name="payTo" rows="4" placeholder="UPI ID: …&#10;Bank: … · A/c … · IFSC …">${esc(s.payTo || "")}</textarea></label>
        <button class="btn primary" type="submit">Save settings</button></form>
      <div class="card pad stack" style="gap:6px"><b>Customer link</b><div class="small mono">${esc(shopLink())}</div><div class="tiny muted">Send this with each login. Customers can add it to their phone's home screen.</div></div>
      <a class="btn ghost" href="#account">Change admin password / sign out</a></div>`;
  }

  /* ---------- Excel / CSV ---------- */
  const COLS = { code: /^(material\s*code|mat(erial)?|item\s*code|product\s*code|code|sku|part\s*no)/i, desc: /^(description|desc|product(\s*name)?|item(\s*name)?|name)/i, rate: /^(rate|purchase\s*rate|cost|unit\s*rate|buy)/i, stock: /^(stock|qty|quantity|available|avail|balance|in\s*stock)/i, hsn: /^hsn/i, uom: /^(uom|unit)/i, type: /^(type|category|product\s*type|group)/i, price: /^(selling\s*price|sell\s*price|mrp|own\s*price|price)$/i };
  function readSheet(file) {
    return new Promise((res, rej) => {
      if (!window.XLSX) return rej(new Error("The Excel reader didn't load. Check the internet connection and try again."));
      const r = new FileReader(); r.onerror = () => rej(new Error("Couldn't read the file."));
      r.onload = () => { try { const wb = XLSX.read(new Uint8Array(r.result), { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]]; res(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true })); } catch (e) { rej(new Error("That file isn't a readable Excel or CSV.")); } };
      r.readAsArrayBuffer(file);
    });
  }
  function mapRows(rows) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const m = {}; rows[i].forEach((h, j) => { const t = String(h).trim(); for (const [k, re] of Object.entries(COLS)) if (m[k] == null && re.test(t)) { m[k] = j; break; } });
      if (m.code != null && m.desc != null) { hi = i; map = m; break; }
    }
    if (!map) throw new Error("Couldn't find the header row. The sheet needs at least a Code column and a Description column.");
    const n = v => { const x = parseFloat(String(v).replace(/[₹,\s]/g, "")); return isFinite(x) ? x : null; };
    const out = new Map();
    for (const r of rows.slice(hi + 1)) {
      const code = String(r[map.code] ?? "").trim(), desc = String(r[map.desc] ?? "").trim(); if (!code || !desc) continue;
      const p = { code, desc }; if (map.rate != null && n(r[map.rate]) != null) p.rate = r2(n(r[map.rate])); if (map.stock != null && n(r[map.stock]) != null) p.stock = n(r[map.stock]);
      if (map.hsn != null) p.hsn = String(r[map.hsn] ?? "").trim(); if (map.uom != null) p.uom = String(r[map.uom] ?? "").trim(); if (map.type != null && String(r[map.type]).trim()) p.type = String(r[map.type]).trim(); if (map.price != null && n(r[map.price]) != null) p.price = r2(n(r[map.price]));
      if (out.has(code)) { const e = out.get(code); if (p.stock != null) e.stock = (e.stock || 0) + p.stock; if (p.rate != null) e.rate = p.rate; } else out.set(code, p);
    }
    return { list: [...out.values()], map, headers: rows[hi] };
  }
  function uploadDialog() {
    modal(`<div class="stack" style="gap:12px"><div class="row between"><h2 class="display" style="font-size:20px">Upload products</h2><button class="btn sm ghost" data-close>Close</button></div>
      <div class="small muted">Excel (.xlsx, .xls) or CSV. Needed columns: <b>Code</b> and <b>Description</b>. Also read: <b>Rate</b>, <b>Stock</b>/Qty, HSN, Unit, Type, and a Selling price column if you set your own prices. The same code twice is added up.</div>
      <input type="file" id="aufile" accept=".xlsx,.xls,.csv" class="inp">
      <div id="auprev"></div></div>`, true);
  }
  async function previewUpload(file) {
    const box = $("#auprev"); box.innerHTML = '<div class="small muted">Reading…</div>';
    try {
      const { list, map, headers } = mapRows(await readSheet(file)); A.upload = list;
      const have = new Map(A.products.map(p => [p.code, p])); const nNew = list.filter(p => !have.has(p.code)).length;
      const found = Object.entries(map).map(([k, j]) => `${k} ← “${esc(headers[j])}”`).join(" · ");
      box.innerHTML = `<div class="stack" style="gap:10px"><div class="small"><b>${list.length}</b> products found: <b>${nNew}</b> new, <b>${list.length - nNew}</b> already in your list.</div><div class="tiny muted">Columns: ${found}</div>
        <div class="scrollx card"><table class="tbl"><thead><tr><th>Code</th><th>Description</th><th class="num">Rate</th><th class="num">Stock</th></tr></thead><tbody>${list.slice(0, 8).map(p => `<tr><td class="mono">${esc(p.code)}</td><td>${esc(p.desc)}</td><td class="num">${p.rate != null ? inr(p.rate) : "—"}</td><td class="num">${p.stock != null ? num(p.stock) : "—"}</td></tr>`).join("")}</tbody></table></div>
        <label class="row small" style="gap:8px"><input type="radio" name="aumode" value="merge" checked> Add new and update existing (keeps your types, own prices and hidden ticks)</label>
        <label class="row small" style="gap:8px"><input type="radio" name="aumode" value="replace"> Replace the whole list with this file</label>
        <button class="btn primary" data-auimport>Import ${list.length} products</button></div>`;
    } catch (e) { box.innerHTML = `<div class="small err">${esc(e.message)}</div>`; }
  }
  async function doImport() {
    const list = A.upload || []; const mode = (document.querySelector("input[name=aumode]:checked") || {}).value || "merge";
    if (mode === "replace") A.products = list.map(p => ({ ...p }));
    else { const idx = new Map(A.products.map((p, i) => [p.code, i])); for (const p of list) { if (idx.has(p.code)) { const e = A.products[idx.get(p.code)]; A.products[idx.get(p.code)] = { ...e, ...p, type: p.type || e.type, price: p.price != null ? p.price : e.price, hidden: e.hidden }; } else A.products.push({ ...p }); } }
    closeModal(); await saveProducts(true); toast(`Imported ${list.length} products. Catalog published.`); route();
  }
  function exportXlsx(kind) {
    if (!window.XLSX) return toast("The Excel writer didn't load. Check the internet connection.");
    let rows, name;
    if (kind === "products") { rows = A.products.map(p => ({ Code: p.code, Description: p.desc, Type: p.type || guessType(p.desc), HSN: p.hsn || "", Unit: p.uom || "", Stock: +p.stock || 0, Rate: p.rate ?? "", "Selling price": +p.price || "", "Shown to customers": p.hidden ? "No" : "Yes" })); name = "dshop_products"; }
    else { rows = []; for (const o of ordersArr()) for (const l of o.lines || []) rows.push({ Order: o.no, Date: (o.createdAt || "").slice(0, 10), Customer: custName(o.cid), Status: (S.ST[o.status] || [o.status])[0], Code: l.mat, Product: l.desc, Qty: l.qty, Price: l.price, Amount: r2(l.price * l.qty), "Discount %": o.discount, "GST %": o.gstPct, "Order grand total": (o.totals || {}).grand, Invoice: (o.bill || {}).no || "", "Invoice amount": (o.bill || {}).amount || "", Balance: orderBalance(o, A.payments) }); name = "dshop_orders"; }
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, kind === "products" ? "Products" : "Orders"); XLSX.writeFile(wb, `${name}_${today()}.xlsx`);
  }

  /* ---------- order actions ---------- */
  async function setStatus(id, st, extra, msg) {
    const o = A.orders[id]; const hist = [...(o.history || []), { s: st, at: nowIso() }];
    await fs.doc("orders/" + id).update({ status: st, history: hist, updatedAt: nowIso(), ...(extra || {}) }); closeModal(); toast(msg || "Saved.");
  }
  function orderAction(id, act) {
    const o = A.orders[id]; const c = A.customers[o.cid] || {}; const t = o.totals || {};
    if (act === "confirm") return setStatus(id, "confirmed", {}, "Order confirmed. The customer sees it.");
    if (act === "deliver") return setStatus(id, "delivered", { delivered: { date: today() } }, "Marked delivered.");
    if (act === "dispatch") return modal(`<form id="adispatch" data-id="${esc(id)}" class="stack"><div class="row between"><h2 style="font-size:18px">Mark dispatched</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
      <div class="grid two"><label class="field">Challan / DC no.<input name="no"></label><label class="field">Date<input name="date" type="date" value="${today()}"></label></div>
      <label class="field">Sent by (courier, person)<input name="via"></label>
      <label class="row small" style="gap:8px"><input type="checkbox" name="lessStock" checked> Take these items off stock</label>
      <button class="btn primary" type="submit">Save</button></form>`);
    if (act === "bill") { const cd = c.creditDays ?? A.settings.creditDays ?? 30; return modal(`<form id="abill" data-id="${esc(id)}" class="stack"><div class="row between"><h2 style="font-size:18px">Enter invoice</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
      <div class="grid two"><label class="field">Invoice no.<input name="no" required></label><label class="field">Invoice date<input name="date" type="date" value="${today()}"></label></div>
      <div class="grid two"><label class="field">Amount (₹, with GST)<input name="amount" inputmode="decimal" value="${esc(t.grand)}"></label><label class="field">Credit days<input name="days" type="number" min="0" value="${esc(cd)}"></label></div>
      <div class="tiny muted">The customer then sees this invoice under Dues, with its due date.</div><div id="aerr" class="small err"></div>
      <button class="btn primary" type="submit">Save invoice</button></form>`); }
    if (act === "pay") { const bal = orderBalance({ id, ...o }, A.payments); return modal(`<form id="apay" data-id="${esc(id)}" class="stack"><div class="row between"><h2 style="font-size:18px">Record payment · ${esc(o.bill.no)}</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
      <div class="grid two"><label class="field">Amount (₹)<input name="amount" inputmode="decimal" value="${bal}"></label><label class="field">Date<input name="date" type="date" value="${today()}"></label></div>
      <div class="grid two"><label class="field">Mode<select name="mode"><option>UPI</option><option>NEFT / RTGS</option><option>Cheque</option><option>Cash</option></select></label><label class="field">UTR / cheque no.<input name="ref"></label></div>
      <div id="aerr" class="small err"></div><button class="btn primary" type="submit">Save payment</button></form>`); }
    if (act === "reject" || act === "cancel") return modal(`<form id="areject" data-id="${esc(id)}" data-st="${act === "reject" ? "rejected" : "cancelled"}" class="stack"><div class="row between"><h2 style="font-size:18px">${act === "reject" ? "Can't supply this order" : "Cancel this order"}</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
      <label class="field">Reason (the customer sees this)<input name="reason" placeholder="e.g. Out of stock, will be back next week"></label><button class="btn danger" type="submit">Save</button></form>`);
    if (act === "edit") { A.editLines = (o.lines || []).map(l => ({ ...l })); return editLinesModal(id); }
  }
  function editLinesModal(id) {
    const o = A.orders[id]; const t = totals(A.editLines, o.discount, o.gstPct);
    modal(`<div class="stack" style="gap:10px" data-editid="${esc(id)}"><div class="row between"><h2 style="font-size:18px">Change items · ${esc(o.no)}</h2><button class="btn sm ghost" data-close>Close</button></div>
      <div class="scrollx"><table class="tbl"><thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th></th></tr></thead><tbody>${A.editLines.map((l, i) => `<tr><td>${esc(l.desc)}<div class="tiny muted">${esc(l.mat)}</div></td><td class="num"><input class="inp sm num" type="number" min="0" step="1" value="${l.qty}" data-elq="${i}"></td><td class="num"><input class="inp sm num" type="number" min="0" step="0.01" value="${l.price}" data-elp="${i}"></td><td><button class="btn sm ghost" data-eldel="${i}">Remove</button></td></tr>`).join("")}</tbody></table></div>
      <div id="eltot" class="small">New grand total: <b>${inr(t.grand)}</b> (was ${inr((o.totals || {}).grand)})</div>
      <button class="btn primary" data-elsave>Save changes</button></div>`, true);
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async e => {
    if (D.role !== "admin") return;
    const b = e.target.closest("button,a[data-acopy]"); if (!b) return; const d = b.dataset;
    try {
      if (d.aact) { const id = b.closest("[data-order]").dataset.order; return orderAction(id, d.aact); }
      if (d.avoid) { if (!d.sure) { d.sure = 1; b.textContent = "Click again to remove"; return; } await fs.doc("payments/" + d.avoid).update({ status: "void", voidAt: nowIso() }); return toast("Payment removed."); }
      if (d.aexport) return exportXlsx(d.aexport);
      if (d.aupload !== undefined) return uploadDialog();
      if (d.auimport !== undefined) return doImport();
      if (d.aaddprod !== undefined) return modal(`<form id="aprodform" class="stack"><div class="row between"><h2 style="font-size:18px">Add product</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
        <div class="grid two"><label class="field">Code<input name="code" required></label><label class="field">HSN<input name="hsn"></label></div><label class="field">Description<input name="desc" required></label>
        <div class="grid two"><label class="field">Rate (₹)<input name="rate" type="number" step="0.01" min="0"></label><label class="field">Stock<input name="stock" type="number" step="1" value="0"></label></div>
        <div class="grid two"><label class="field">Unit<input name="uom" value="EA"></label><label class="field">Type<select name="type"><option value="">Automatic</option>${PRODUCT_TYPES.map(t => `<option>${t}</option>`).join("")}</select></label></div>
        <div id="aerr" class="small err"></div><button class="btn primary" type="submit">Add</button></form>`);
      if (d.adelprod) { if (!d.sure) { d.sure = 1; b.textContent = "Sure?"; return; } A.products.splice(+d.adelprod, 1); saveProducts(); return route(); }
      if (d.apg) { A.v.prod.page += +d.apg; return route(); }
      if (d.abulk) {
        const V = A.v.prod, q = V.q.toLowerCase(), val = String((d.abulk === "rate" ? V.bulkRate : V.bulkStock) ?? "");
        if (val === "") return say("bad", d.abulk === "rate" ? "Type the rate first." : "Type the stock first.");
        const hit = A.products.filter(p => { const ty = p.type || guessType(p.desc); return (!V.type || ty === V.type) && (!q || (p.code + " " + p.desc).toLowerCase().includes(q)) && (V.only !== "hidden" || p.hidden) && (V.only !== "noprice" || !(sellOf(p) > 0)) && (V.only !== "out" || !(+p.stock > 0)) && (V.only !== "new" || p.isNew) && (V.only !== "gone" || p.notInDcart); });
        if (!hit.length) return say("bad", "No products match the search.");
        for (const p of hit) { if (d.abulk === "rate") { p.rate = r2(+val); delete p.isNew; } else p.stock = +val || 0; }
        V.bulkRate = ""; V.bulkStock = ""; await saveProducts(true); toast(`${d.abulk === "rate" ? "Rate ₹" + val : "Stock " + val} set for ${hit.length} products and published.`); return route();
      }
      if (d.aonly) { A.v.prod.only = d.aonly; A.v.prod.page = 0; return route(); }
      if (d.aseen !== undefined) { A.products.forEach(p => delete p.isNew); await saveProducts(true); return route(); }
      if (d.aptab) return nav("#payments-" + d.aptab);
      if (d.anewcust !== undefined) return modal(`<form id="acustform" class="stack"><div class="row between"><h2 style="font-size:18px">New customer and login</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
        <label class="field">Customer name<input name="name" placeholder="e.g. City Care Hospital, Chennai" required></label>
        <div class="grid two"><label class="field">Type<select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select></label><label class="field">Discount %<input name="disc" type="number" min="0" max="90" step="0.5" value="0"></label></div>
        <div class="grid two"><label class="field">Credit days<input name="days" type="number" min="0" value="${esc(A.settings.creditDays)}"></label><label class="field">Phone<input name="phone" inputmode="tel"></label></div>
        <div class="grid two"><label class="field">Login ID<input name="login" autocapitalize="none" placeholder="lowercase, e.g. citycare"></label><label class="field">Contact person<input name="person"></label></div>
        <div id="aerr" class="small err"></div><button class="btn primary" type="submit">Create customer and login</button></form>`);
      if (d.aaddlogin) return modal(`<form id="aloginform" data-cid="${esc(d.aaddlogin)}" class="stack"><div class="row between"><h2 style="font-size:18px">New login · ${esc(custName(d.aaddlogin))}</h2><button type="button" class="btn sm ghost" data-close>Close</button></div>
        <div class="grid two"><label class="field">Login ID<input name="login" autocapitalize="none"></label><label class="field">Person<input name="person"></label></div><div id="aerr" class="small err"></div><button class="btn primary" type="submit">Create login</button></form>`);
      if (d.areset) { if (!d.sure) { d.sure = 1; b.textContent = "Click again to confirm"; return; } b.disabled = true; const t = await resetLogin(d.areset); return showTemp(t); }
      if (d.aonoff) { await setLoginOn(d.aonoff, d.on === "1"); return toast(d.on === "1" ? "Login switched on." : "Login switched off. They can't sign in now."); }
      if (d.aadvok) { const a = A.advices[d.aadvok]; const o = A.orders[a.orderId]; if (!o) return toast("That order no longer exists."); await fs.collection("payments").add({ cid: a.cid, orderId: a.orderId, invNo: (o.bill || {}).no || a.invNo, amount: +a.amount, date: a.date || today(), mode: a.mode, ref: a.ref, adviceId: d.aadvok, status: "ok", at: nowIso() }); await fs.doc("advices/" + d.aadvok).update({ status: "done", checkedAt: nowIso() }); return toast("Payment recorded. The customer's dues are updated."); }
      if (d.aadvno) { await fs.doc("advices/" + d.aadvno).update({ status: "wrong", checkedAt: nowIso() }); return toast("Marked as not received."); }
      if (d.acopy !== undefined) { const t = A.temp; try { await navigator.clipboard.writeText(`D Shop – Dr Han Health Care\n${shopLink()}\nLogin ID: ${t.loginId}\nTemporary password: ${t.pw}`); b.textContent = "Copied"; } catch (x) { b.textContent = "Copy blocked"; } return; }
      if (d.eldel) { A.editLines.splice(+d.eldel, 1); return editLinesModal(b.closest("[data-editid]").dataset.editid); }
      if (d.elsave !== undefined) { const id = b.closest("[data-editid]").dataset.editid; const o = A.orders[id]; const lines = A.editLines.filter(l => +l.qty > 0).map(l => ({ ...l, qty: +l.qty, price: r2(+l.price) })); if (!lines.length) return toast("Keep at least one item, or use Can't supply / Cancel."); await fs.doc("orders/" + id).update({ lines, totals: totals(lines, o.discount, o.gstPct), changedByDhh: nowIso(), updatedAt: nowIso() }); closeModal(); return toast("Items changed. The customer sees the new total."); }
    } catch (err) { say("bad", err.message || niceErr(err)); toast(err.message || niceErr(err)); }
  });
  document.addEventListener("input", e => {
    if (D.role !== "admin") return; const d = e.target.dataset || {};
    if (d.aord === "q") { A.v.ord.q = e.target.value; refocus("[data-aord=q]"); }
    if (d.aprod === "q") { A.v.prod.q = e.target.value; A.v.prod.page = 0; refocus("[data-aprod=q]"); }
    if (e.target.id === "abulkrate") A.v.prod.bulkRate = e.target.value;
    if (e.target.id === "abulkstock") A.v.prod.bulkStock = e.target.value;
    if (d.acust === "q") { A.v.cust.q = e.target.value; refocus("[data-acust=q]"); }
    if (d.elq || d.elp) { const i = +(d.elq || d.elp); A.editLines[i][d.elq ? "qty" : "price"] = +e.target.value || 0; const id = e.target.closest("[data-editid]").dataset.editid; const o = A.orders[id]; const el = $("#eltot"); if (el) el.innerHTML = `New grand total: <b>${inr(totals(A.editLines.filter(l => l.qty > 0), o.discount, o.gstPct).grand)}</b> (was ${inr((o.totals || {}).grand)})`; }
  });
  function refocus(sel) { clearTimeout(refocus.t); refocus.t = setTimeout(() => { route(); const x = document.querySelector(sel); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); }
  document.addEventListener("change", async e => {
    if (D.role !== "admin") return; const t = e.target, d = t.dataset || {};
    try {
      if (t.id === "aufile" && t.files[0]) return previewUpload(t.files[0]);
      if (d.aord === "st") { A.v.ord.st = t.value; return route(); }
      if (d.aprod === "type") { A.v.prod.type = t.value; A.v.prod.page = 0; return route(); }
      if (d.aprod === "only") { A.v.prod.only = t.value; A.v.prod.page = 0; return route(); }
      if (d.adisc) { const v = Math.min(90, Math.max(0, +t.value || 0)); t.value = v; await fs.doc("customers/" + d.adisc).update({ discount: v, updatedAt: nowIso() }); return say("good", `Discount for ${custName(d.adisc)} set to ${v}%. It applies to their next orders.`); }
      if (d.acred) { const v = Math.max(0, Math.floor(+t.value || 0)); await fs.doc("customers/" + d.acred).update({ creditDays: v, updatedAt: nowIso() }); return say("good", `Credit days for ${custName(d.acred)} set to ${v}.`); }
      if (d.actype) { await fs.doc("customers/" + d.actype).update({ type: t.value, updatedAt: nowIso() }); return say("good", "Saved."); }
      const pi = d.ashow ?? d.atype ?? d.astock ?? d.arate ?? d.aprice;
      if (pi !== undefined) {
        const p = A.products[+pi]; if (!p) return;
        if (d.ashow !== undefined) p.hidden = !t.checked;
        if (d.atype !== undefined) { if (t.value === guessType(p.desc)) delete p.type; else p.type = t.value; }
        if (d.astock !== undefined) p.stock = +t.value || 0;
        if (d.arate !== undefined) p.rate = t.value === "" ? null : r2(+t.value);
        if (d.aprice !== undefined) p.price = t.value === "" ? null : r2(+t.value);
        if (d.arate !== undefined || d.aprice !== undefined) delete p.isNew;
        const cell = document.querySelector(`[data-asell="${pi}"]`); if (cell) cell.innerHTML = sellOf(p) > 0 ? inr(sellOf(p)) : '<span class="tiny muted">no price</span>';
        saveProducts();
      }
    } catch (err) { say("bad", niceErr(err)); }
  });
  document.addEventListener("submit", async e => {
    if (D.role !== "admin") return; const f = e.target; const ids = ["adispatch", "abill", "apay", "areject", "acustform", "aloginform", "asettings", "aprodform"]; if (!ids.includes(f.id)) return;
    e.preventDefault(); const fd = new FormData(f); const btn = f.querySelector("button[type=submit]"); const err = m => { const el = f.querySelector("#aerr"); if (el) el.textContent = m; else say("bad", m); if (btn) btn.disabled = false; };
    if (btn) btn.disabled = true;
    try {
      if (f.id === "adispatch") {
        const id = f.dataset.id, o = A.orders[id];
        if (fd.get("lessStock")) { for (const l of o.lines || []) { const p = A.products.find(x => x.code === l.mat); if (p) p.stock = r2((+p.stock || 0) - (+l.qty || 0)); } saveProducts(true); }
        return setStatus(id, "dispatched", { dispatch: { no: String(fd.get("no") || ""), date: String(fd.get("date") || today()), via: String(fd.get("via") || ""), stockTaken: !!fd.get("lessStock") } }, "Marked dispatched.");
      }
      if (f.id === "abill") {
        const no = String(fd.get("no") || "").trim(); if (!no) return err("Enter the invoice number."); const date = String(fd.get("date") || today()); const amount = r2(+String(fd.get("amount")).replace(/[^\d.]/g, "")); if (!(amount > 0)) return err("Enter the invoice amount.");
        return setStatus(f.dataset.id, "billed", { bill: { no, date, amount, due: addDays(date, Math.max(0, +fd.get("days") || 0)) } }, "Invoice saved. The customer sees it under Dues.");
      }
      if (f.id === "apay") {
        const id = f.dataset.id, o = A.orders[id]; const amount = r2(+String(fd.get("amount")).replace(/[^\d.]/g, "")); if (!(amount > 0)) return err("Enter the amount.");
        await fs.collection("payments").add({ cid: o.cid, orderId: id, invNo: o.bill.no, amount, date: String(fd.get("date") || today()), mode: String(fd.get("mode")), ref: String(fd.get("ref") || ""), status: "ok", at: nowIso() }); closeModal(); return toast("Payment recorded.");
      }
      if (f.id === "areject") return setStatus(f.dataset.id, f.dataset.st, { reason: String(fd.get("reason") || "") }, "Saved. The customer sees it.");
      if (f.id === "acustform") {
        const name = String(fd.get("name") || "").trim(), login = String(fd.get("login") || "").trim(); if (!name) return err("Enter the customer's name."); if (!login) return err("Enter a login ID.");
        if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(login.toLowerCase()) || login.toLowerCase() === "admin") return err("Login ID: 3–30 lowercase letters or numbers (dash and underscore allowed), not \"admin\".");
        if (A.logins[login.toLowerCase()]) return err("That login ID is already used.");
        const cid = "c" + Date.now().toString(36);
        await fs.doc("customers/" + cid).set({ name, type: String(fd.get("type")), discount: Math.min(90, Math.max(0, +fd.get("disc") || 0)), creditDays: Math.max(0, Math.floor(+fd.get("days") || 0)), phone: String(fd.get("phone") || ""), createdAt: nowIso() });
        try { const t = await addLogin(cid, login, String(fd.get("person") || "").trim()); return showTemp(t); }
        catch (x) { closeModal(); return say("bad", `Customer saved, but the login wasn't created: ${x.message} Use “+ Login” on their row.`); }
      }
      if (f.id === "aloginform") { try { const t = await addLogin(f.dataset.cid, fd.get("login"), String(fd.get("person") || "").trim()); return showTemp(t); } catch (x) { return err(x.message); } }
      if (f.id === "asettings") {
        const s = { sellPct: Math.max(0, +fd.get("sellPct") || 0), gstPct: Math.max(0, +fd.get("gstPct") || 0), lowAt: Math.max(0, Math.floor(+fd.get("lowAt") || 0)), creditDays: Math.max(0, Math.floor(+fd.get("creditDays") || 0)), payTo: String(fd.get("payTo") || "").trim(), updatedAt: nowIso() };
        await fs.doc("config/settings").set(s); A.settings = { ...A.settings, ...s }; await publishCatalog(); if (btn) btn.disabled = false; return say("good", "Settings saved and the catalog republished with these prices.");
      }
      if (f.id === "aprodform") {
        const code = String(fd.get("code") || "").trim(), desc = String(fd.get("desc") || "").trim(); if (!code || !desc) return err("Code and description are needed."); if (A.products.some(p => p.code === code)) return err("That code is already in the list.");
        const p = { code, desc, hsn: String(fd.get("hsn") || ""), uom: String(fd.get("uom") || ""), stock: +fd.get("stock") || 0 }; if (fd.get("rate") !== "") p.rate = r2(+fd.get("rate")); if (fd.get("type")) p.type = String(fd.get("type"));
        A.products.push(p); await saveProducts(true); closeModal(); toast("Product added."); return route();
      }
    } catch (x) { err(x.message || niceErr(x)); }
  });

  window.DSAdmin = { start, nav: navList, view, after, publishCatalog, guessType, splitSize, A };
})();
