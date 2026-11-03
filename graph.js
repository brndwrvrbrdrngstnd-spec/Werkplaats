/* Aanmelden met Microsoft 365 en lezen/schrijven in de SharePoint-lijst via Microsoft Graph. */
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var GRAPH = "https://graph.microsoft.com/v1.0";
  var SCOPES = ["User.Read", "Sites.ReadWrite.All"];
  var FIELDS = ["Title", "Datum", "Soort", "Omschrijving", "Onderdeel", "UitgevoerdDoor", "Km", "Voertuig"];
  var msalApp = null;
  var siteId = null;
  var listId = null;

  function configured() {
    var all = [cfg.tenantId, cfg.clientId, cfg.sharePointHost, cfg.sitePath, cfg.listName].join("|");
    return !!(cfg.tenantId && cfg.clientId && cfg.sharePointHost && cfg.sitePath && cfg.listName) && !/VERVANG/.test(all);
  }

  function redirectUri() { return location.origin + location.pathname; }

  async function init() {
    msalApp = new msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: "https://login.microsoftonline.com/" + cfg.tenantId,
        redirectUri: redirectUri(),
        navigateToLoginRequestUrl: false
      },
      cache: { cacheLocation: "localStorage" }
    });
    await msalApp.initialize();
    var res = await msalApp.handleRedirectPromise();
    if (res && res.account) msalApp.setActiveAccount(res.account);
    var acc = msalApp.getActiveAccount() || msalApp.getAllAccounts()[0] || null;
    if (acc) msalApp.setActiveAccount(acc);
    return acc;
  }

  function login() { return msalApp.loginRedirect({ scopes: SCOPES }); }
  function logout() { return msalApp.logoutRedirect({ account: msalApp.getActiveAccount(), postLogoutRedirectUri: redirectUri() }); }

  async function token() {
    var account = msalApp.getActiveAccount();
    try {
      var r = await msalApp.acquireTokenSilent({ scopes: SCOPES, account: account });
      return r.accessToken;
    } catch (e) {
      // Sessie verlopen of toestemming nodig: opnieuw aanmelden via omleiding.
      await msalApp.acquireTokenRedirect({ scopes: SCOPES, account: account });
      var err = new Error("Omleiden naar aanmelden");
      err.code = "auth_redirect";
      throw err;
    }
  }

  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : "";
    if (status === 401) return "Je sessie is verlopen. Meld je opnieuw aan.";
    if (status === 403) return "Geen toegang tot de SharePoint-site of -lijst. Vraag toegang aan je beheerder.";
    if (status === 404) return "Site of lijst niet gevonden. Controleer config.js en de naam van de lijst. " + msg;
    if (status === 400) return "SharePoint weigert de gegevens. Controleer of de kolomnamen van de lijst kloppen met de README. " + msg;
    if (status === 429) return "Te veel aanvragen tegelijk. Probeer het over enkele seconden opnieuw.";
    return "Er ging iets mis bij SharePoint (" + status + "). " + msg;
  }

  async function request(method, path, body, absolute) {
    var t = await token();
    var res;
    try {
      res = await fetch(absolute ? path : GRAPH + path, {
        method: method,
        headers: Object.assign({ Authorization: "Bearer " + t }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      var ne = new Error("Geen verbinding. Controleer het netwerk.");
      ne.code = "network";
      throw ne;
    }
    if (res.status === 204) return null;
    var json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    if (!res.ok) {
      var er = new Error(friendly(res.status, json));
      er.status = res.status;
      throw er;
    }
    return json;
  }

  async function ensureList() {
    if (listId) return;
    var site = await request("GET", "/sites/" + cfg.sharePointHost + ":" + cfg.sitePath + "?$select=id");
    siteId = site.id;
    var url = "/sites/" + encodeURIComponent(siteId) + "/lists?$select=id,displayName&$top=200";
    var abs = false;
    while (url) {
      var page = await request("GET", url, null, abs);
      var hit = (page.value || []).filter(function (l) { return String(l.displayName).toLowerCase() === String(cfg.listName).toLowerCase(); })[0];
      if (hit) { listId = hit.id; return; }
      url = page["@odata.nextLink"] || null;
      abs = true;
    }
    var e = new Error("De lijst '" + cfg.listName + "' bestaat niet op deze site. Controleer listName in config.js.");
    e.status = 404;
    throw e;
  }

  function itemToEntry(item) {
    var f = item.fields || {};
    var km = f.Km;
    return {
      id: String(item.id),
      plate: String(f.Title || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      date: String(f.Datum || "").slice(0, 10),
      type: f.Soort || "Overig",
      description: f.Omschrijving || "",
      part: f.Onderdeel || "",
      doneBy: f.UitgevoerdDoor || "",
      km: km === undefined || km === null || km === "" ? null : Number(km),
      vehicle: f.Voertuig || "",
      createdAt: item.createdDateTime ? Date.parse(item.createdDateTime) : 0
    };
  }

  function entryToFields(rec) {
    var fields = {
      Title: rec.plate,
      Datum: rec.date,
      Soort: rec.type,
      Omschrijving: rec.description,
      Onderdeel: rec.part || "",
      UitgevoerdDoor: rec.doneBy,
      Voertuig: rec.vehicle || ""
    };
    if (rec.km !== null && rec.km !== undefined && !isNaN(rec.km)) fields.Km = rec.km;
    return fields;
  }

  async function loadEntries() {
    await ensureList();
    var url = "/sites/" + encodeURIComponent(siteId) + "/lists/" + encodeURIComponent(listId) +
      "/items?$select=id,createdDateTime&$expand=fields($select=" + FIELDS.join(",") + ")&$top=500";
    var out = [];
    var abs = false;
    while (url) {
      var page = await request("GET", url, null, abs);
      (page.value || []).forEach(function (it) { out.push(itemToEntry(it)); });
      url = page["@odata.nextLink"] || null;
      abs = true;
    }
    return out;
  }

  async function addEntry(rec) {
    await ensureList();
    var created = await request("POST", "/sites/" + encodeURIComponent(siteId) + "/lists/" + encodeURIComponent(listId) + "/items", { fields: entryToFields(rec) });
    return String(created.id);
  }

  async function deleteEntry(id) {
    await ensureList();
    await request("DELETE", "/sites/" + encodeURIComponent(siteId) + "/lists/" + encodeURIComponent(listId) + "/items/" + encodeURIComponent(id));
  }

  window.Graph = {
    configured: configured, init: init, login: login, logout: logout,
    loadEntries: loadEntries, addEntry: addEntry, deleteEntry: deleteEntry,
    _itemToEntry: itemToEntry, _entryToFields: entryToFields
  };
})();
