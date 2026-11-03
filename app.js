/* Voertuigenlogboek: zoeken op nummerplaat, historiek tonen, interventies toevoegen. */
(function () {
  "use strict";

  var TYPES = ["Onderhoud", "Herstelling", "Keuring", "Overig"];
  var TCLASS = { Onderhoud: "t1", Herstelling: "t2", Keuring: "t3", Overig: "t4" };
  var POLL_MS = 60000;

  var $ = function (s) { return document.querySelector(s); };
  var entries = [];
  var labels = {};
  var loaded = false;
  var loadError = "";
  var plate = "";
  var query = "";
  var filter = "all";
  var confirmId = "";
  var account = null;
  var refreshing = false;
  var saving = false;
  var statusTimer = null;

  /* ---------- Hulpfuncties ---------- */
  function norm(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function fmt(p) {
    var m = /^(\d)([A-Z]{3})(\d{3})$/.exec(p);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = /^([A-Z]{3})(\d{3})$/.exec(p);
    if (m) return m[1] + "-" + m[2];
    return p;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] : (iso || "");
  }
  function fmtKm(n) { return Number(n).toLocaleString("nl-BE") + " km"; }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function plateHtml(p, size) {
    return '<span class="plate"' + (size ? ' style="--ps:' + size + 'px"' : "") + '><span class="eu" aria-hidden="true">B</span><span class="chars">' + esc(fmt(p)) + "</span></span>";
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* opslag niet beschikbaar */ }
    return null;
  }
  function byDateDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }
  function recompute() {
    labels = {};
    entries.slice().sort(byDateDesc).forEach(function (e) {
      if (e.vehicle && !labels[e.plate]) labels[e.plate] = e.vehicle;
    });
  }
  function knownVehicles() {
    var map = {};
    entries.forEach(function (e) {
      var v = map[e.plate] || (map[e.plate] = { plate: e.plate, count: 0, last: "", label: labels[e.plate] || "" });
      v.count++;
      if (e.date > v.last) v.last = e.date;
    });
    return Object.keys(map).map(function (p) { return map[p]; })
      .sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : a.plate.localeCompare(b.plate); });
  }
  function setStatus(msg, isErr, keep) {
    var s = $("#status");
    s.textContent = msg || "";
    s.className = "status" + (isErr ? " err" : "");
    clearTimeout(statusTimer);
    if (msg && !isErr && !keep) statusTimer = setTimeout(function () { renderStatus(); }, 5000);
  }

  /* ---------- Weergave ---------- */
  function renderStatus() {
    var banner = $("#banner");
    if (!navigator.onLine) { banner.hidden = false; banner.textContent = "Geen verbinding. Je ziet de laatst geladen gegevens. Opslaan kan pas als je weer online bent."; }
    else banner.hidden = true;
    if (loadError) setStatus(loadError, true);
    else if (!loaded) setStatus("Gegevens laden…", false, true);
    else setStatus("");
  }

  function render() {
    renderStatus();
    renderList();
    renderForm();
  }

  function renderList() {
    var area = $("#list-area");
    if (plate) { area.innerHTML = vehicleHtml(); return; }
    var list = knownVehicles();
    var q = norm(query);
    if (q) list = list.filter(function (v) { return v.plate.indexOf(q) !== -1; });
    var html = "";
    if (q) {
      html += '<div class="empty"><h3>' + (list.length ? "Ander voertuig?" : "Geen voertuig met deze nummerplaat") + "</h3><p>Open " + esc(fmt(q)) +
        ' om de historiek te bekijken of de eerste interventie toe te voegen.</p><button class="btn" type="button" data-act="open" data-plate="' + esc(q) + '">Open ' + esc(fmt(q)) + "</button></div>";
    }
    if (list.length) {
      html += '<ul class="known">' + list.map(function (v) {
        return '<li><button type="button" data-act="open" data-plate="' + esc(v.plate) + '">' + plateHtml(v.plate, 26) +
          '<span class="lbl">' + (v.label ? esc(v.label) : "Geen omschrijving") + "<small>" + (v.last ? "Laatste interventie " + fmtDate(v.last) : "Nog geen interventies") + "</small></span>" +
          '<span class="cnt">' + v.count + (v.count === 1 ? " interventie" : " interventies") + "</span></button></li>";
      }).join("") + "</ul>";
    } else if (!q && loaded) {
      html += '<div class="empty"><h3>Nog geen voertuigen</h3><p>Voer rechtsboven een nummerplaat in en kies Toon historiek. Daarna kan je de eerste interventie registreren, bijvoorbeeld een vervangen oliefilter met datum en naam van de uitvoerder.</p></div>';
    }
    area.innerHTML = html;
  }

  function vehicleHtml() {
    var all = entries.filter(function (e) { return e.plate === plate; }).sort(byDateDesc);
    var label = labels[plate] || "";
    var last = all[0];
    var counts = { all: all.length };
    TYPES.forEach(function (t) { counts[t] = all.filter(function (e) { return e.type === t; }).length; });
    var shown = filter === "all" ? all : all.filter(function (e) { return e.type === filter; });
    var h = '<div class="vehicle-head"><div class="who">' + plateHtml(plate, 40) + "<span>" + (label ? esc(label) : "Geen omschrijving") + "</span></div>" +
      '<div class="stats"><div><b>' + all.length + "</b><span>Interventies</span></div><div><b>" + (last ? fmtDate(last.date) : "–") + "</b><span>Laatste</span></div></div></div>";
    h += '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><div class="chips">' +
      ["all"].concat(TYPES).map(function (t) {
        return '<button type="button" class="chip" data-act="filter" data-f="' + t + '" aria-pressed="' + (filter === t) + '">' + (t === "all" ? "Alles" : t) + " (" + counts[t] + ")</button>";
      }).join("") + '</div><button type="button" class="btn ghost" data-act="back">Alle voertuigen</button></div>';
    if (!shown.length) {
      h += '<p class="timeline none">' + (all.length ? "Geen interventies van dit type." : (loaded ? "Nog geen historiek voor dit voertuig. Voeg de eerste interventie toe." : "Gegevens laden…")) + "</p>";
    } else {
      h += '<ol class="timeline">' + shown.map(entryHtml).join("") + "</ol>";
    }
    return h;
  }

  function entryHtml(e) {
    var meta = ["Uitgevoerd door " + esc(e.doneBy || "onbekend")];
    if (e.km !== null && e.km !== undefined && !isNaN(e.km)) meta.push(fmtKm(e.km));
    var acts = confirmId === e.id
      ? '<button type="button" class="link danger" data-act="del-yes" data-id="' + esc(e.id) + '">Definitief verwijderen</button><button type="button" class="link" data-act="del-no">Annuleer</button>'
      : '<button type="button" class="link" data-act="del" data-id="' + esc(e.id) + '">Verwijderen</button>';
    return '<li class="entry"><div class="when"><span class="date">' + fmtDate(e.date) + '</span><span class="pill ' + (TCLASS[e.type] || "t4") + '">' + esc(e.type || "Overig") + "</span></div>" +
      '<div class="body"><p class="desc">' + esc(e.description) + "</p>" +
      (e.part ? '<p class="part">Onderdeel/type: <code>' + esc(e.part) + "</code></p>" : "") +
      '<p class="meta">' + meta.join(" · ") + '</p></div><div class="acts">' + acts + "</div></li>";
  }

  function renderForm() {
    var form = $("#entry-form"), hint = $("#form-hint"), fp = $("#for-plate");
    if (!plate) { form.hidden = true; fp.hidden = true; hint.hidden = false; hint.textContent = "Zoek of voer eerst een nummerplaat in."; return; }
    fp.hidden = false;
    fp.innerHTML = "Voor " + plateHtml(plate, 22);
    hint.hidden = true;
    form.hidden = false;
    $("#label-field").hidden = !!labels[plate];
  }

  /* ---------- Navigatie ---------- */
  function openPlate(p) { location.hash = "v-" + p; }
  function applyHash() {
    var m = /^#v-([A-Z0-9]+)$/.exec(location.hash || "");
    plate = m ? m[1] : "";
    confirmId = "";
    filter = "all";
    var inp = $("#plate-input");
    if (plate) { inp.value = fmt(plate); query = ""; }
    else if (document.activeElement !== inp) { inp.value = ""; query = ""; }
    $("#form-status").textContent = "";
    render();
  }

  /* ---------- Gegevens laden ---------- */
  async function refresh() {
    if (refreshing || !navigator.onLine) return;
    refreshing = true;
    try {
      entries = await Graph.loadEntries();
      loaded = true;
      loadError = "";
      recompute();
    } catch (e) {
      if (e && e.code === "auth_redirect") return;
      loadError = e && e.message ? e.message : "De gegevens konden niet geladen worden.";
      if (e && e.code === "network") loadError = "";
    } finally {
      refreshing = false;
    }
    render();
  }

  /* ---------- Excel-export ---------- */
  function exportExcel() {
    if (!entries.length) { setStatus("Er zijn nog geen interventies om te exporteren."); return; }
    if (!window.XLSX) { setStatus("De Excel-bibliotheek is niet geladen.", true); return; }
    var sorted = entries.slice().sort(function (a, b) { return a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : byDateDesc(a, b); });
    var rows = sorted.map(function (e) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date || "");
      return {
        "Nummerplaat": fmt(e.plate),
        "Voertuig": labels[e.plate] || "",
        "Datum": m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : (e.date || ""),
        "Soort": e.type || "",
        "Omschrijving": e.description || "",
        "Onderdeel/type": e.part || "",
        "Uitgevoerd door": e.doneBy || "",
        "Kilometerstand": e.km === null || isNaN(e.km) ? "" : e.km,
        "Geregistreerd op": e.createdAt ? new Date(e.createdAt) : ""
      };
    });
    var ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    rows.forEach(function (r, i) {
      if (ws["C" + (i + 2)] && r["Datum"] instanceof Date) ws["C" + (i + 2)].z = "dd/mm/yyyy";
      if (ws["I" + (i + 2)] && r["Geregistreerd op"] instanceof Date) ws["I" + (i + 2)].z = "dd/mm/yyyy hh:mm";
    });
    ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 13 }, { wch: 44 }, { wch: 18 }, { wch: 16 }, { wch: 15 }, { wch: 18 }];
    var ws2 = XLSX.utils.json_to_sheet(knownVehicles().map(function (v) {
      return { "Nummerplaat": fmt(v.plate), "Voertuig": v.label, "Aantal interventies": v.count, "Laatste interventie": v.last ? fmtDate(v.last) : "" };
    }));
    ws2["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 20 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Interventies");
    XLSX.utils.book_append_sheet(wb, ws2, "Voertuigen");
    var out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    var blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voertuigenlogboek-" + today() + ".xlsx";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setStatus("Excelbestand aangemaakt.");
  }

  /* ---------- Gebeurtenissen ---------- */
  function wireApp() {
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("online", function () { renderStatus(); refresh(); });
    window.addEventListener("offline", renderStatus);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refresh(); });
    setInterval(function () { if (document.visibilityState === "visible" && !saving) refresh(); }, POLL_MS);

    $("#plate-input").addEventListener("input", function (e) {
      if (plate) { plate = ""; if (location.hash) history.replaceState(null, "", location.pathname + location.search); }
      query = e.target.value;
      render();
    });
    $("#search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var p = norm($("#plate-input").value);
      if (p.length < 2) { setStatus("Voer een nummerplaat in, bijvoorbeeld 1-ABC-123.", true); return; }
      openPlate(p);
    });
    $("#refresh-btn").addEventListener("click", function () { setStatus("Vernieuwen…", false, true); refresh().then(function () { if (!loadError) setStatus("Bijgewerkt."); }); });
    $("#export-btn").addEventListener("click", exportExcel);
    $("#signout-btn").addEventListener("click", function () { Graph.logout(); });

    $("#list-area").addEventListener("click", async function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "open") openPlate(b.getAttribute("data-plate"));
      else if (act === "back") { if (location.hash) location.hash = ""; else applyHash(); }
      else if (act === "filter") { filter = b.getAttribute("data-f"); renderList(); }
      else if (act === "del") { confirmId = b.getAttribute("data-id"); renderList(); }
      else if (act === "del-no") { confirmId = ""; renderList(); }
      else if (act === "del-yes") {
        var id = b.getAttribute("data-id");
        confirmId = "";
        if (!navigator.onLine) { setStatus("Je bent offline. Verwijderen kan pas met verbinding.", true); renderList(); return; }
        try {
          await Graph.deleteEntry(id);
          entries = entries.filter(function (x) { return x.id !== id; });
          recompute();
          setStatus("Interventie verwijderd.");
        } catch (err) {
          if (err && err.code === "auth_redirect") return;
          setStatus(err && err.message ? err.message : "Verwijderen is niet gelukt.", true);
        }
        render();
      }
    });

    var f = { date: $("#f-date"), type: $("#f-type"), desc: $("#f-desc"), part: $("#f-part"), who: $("#f-who"), km: $("#f-km"), label: $("#f-label") };
    f.date.value = today();
    var savedWho = store("vl-who");
    if (savedWho) f.who.value = savedWho;

    $("#entry-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var fs = $("#form-status"), btn = $("#save-btn");
      if (!plate || saving) return;
      var desc = f.desc.value.trim(), who = f.who.value.trim();
      if (!f.date.value || !desc || !who) { fs.className = "status err"; fs.textContent = "Vul datum, omschrijving en naam van de uitvoerder in."; return; }
      if (!navigator.onLine) { fs.className = "status err"; fs.textContent = "Je bent offline. Opslaan kan pas met verbinding."; return; }
      var rec = {
        plate: plate, date: f.date.value, type: f.type.value, description: desc,
        part: f.part.value.trim(), doneBy: who,
        km: f.km.value === "" ? null : Number(f.km.value),
        vehicle: labels[plate] ? "" : f.label.value.trim()
      };
      saving = true;
      btn.disabled = true;
      fs.className = "status";
      fs.textContent = "Opslaan…";
      try {
        rec.id = await Graph.addEntry(rec);
        rec.createdAt = Date.now();
        entries.push(rec);
        recompute();
        store("vl-who", who);
        f.desc.value = ""; f.part.value = ""; f.km.value = ""; f.label.value = "";
        fs.textContent = "Opgeslagen op " + fmtDate(rec.date) + ".";
        render();
      } catch (err) {
        if (err && err.code === "auth_redirect") return;
        fs.className = "status err";
        fs.textContent = err && err.message ? err.message : "Opslaan is niet gelukt. Probeer het opnieuw.";
      } finally {
        saving = false;
        btn.disabled = false;
      }
    });
  }

  /* ---------- Opstarten ---------- */
  function showAuth(kind, detail) {
    $("#app-view").hidden = true;
    $("#auth-view").hidden = false;
    var c = $("#auth-card");
    if (kind === "login") {
      c.innerHTML = "<h3>Aanmelden</h3><p>Meld je aan met je werkaccount van Microsoft 365 om het logboek te openen.</p>" +
        '<button class="btn" id="login-btn" type="button">Aanmelden met Microsoft</button>';
      $("#login-btn").addEventListener("click", function () { Graph.login(); });
    } else if (kind === "config") {
      c.innerHTML = "<h3>De app is nog niet ingesteld</h3><p>Open het bestand config.js en vul de tenant-ID, client-ID, SharePoint-site en lijstnaam in. De stappen staan in README.md.</p>";
    } else {
      c.innerHTML = "<h3>Aanmelden is niet gelukt</h3><p>" + esc(detail || "Onbekende fout.") + '</p><button class="btn" id="retry-btn" type="button">Opnieuw proberen</button>';
      $("#retry-btn").addEventListener("click", function () { location.href = location.pathname; });
    }
  }

  async function boot() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* app werkt ook zonder */ });
    }
    if (!Graph.configured()) { showAuth("config"); return; }
    try { account = await Graph.init(); }
    catch (e) { showAuth("error", e && e.message); return; }
    if (!account) { showAuth("login"); return; }
    $("#auth-view").hidden = true;
    $("#app-view").hidden = false;
    $("#user-name").textContent = account.name || account.username || "";
    wireApp();
    applyHash();
    refresh();
  }

  boot();
})();
