/* Aanmelden en gegevens lezen/schrijven via Supabase (Postgres met beveiliging per rij). */
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var TABLE = "interventies";
  var PAGE = 1000;
  var client = null;
  var user = null;

  function configured() {
    var all = [cfg.supabaseUrl, cfg.supabaseAnonKey].join("|");
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey) && !/VERVANG/.test(all) && /^https:\/\//.test(cfg.supabaseUrl);
  }

  function fail(message, code, status) {
    var e = new Error(message);
    if (code) e.code = code;
    if (status) e.status = status;
    return e;
  }

  function friendly(err) {
    var msg = String((err && err.message) || "");
    var status = err && err.status;
    var code = err && err.code;
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return fail("Geen verbinding. Controleer het netwerk.", "network");
    if (/invalid login credentials/i.test(msg)) return fail("E-mailadres of wachtwoord klopt niet.", "login");
    if (/email not confirmed/i.test(msg)) return fail("Dit account is nog niet bevestigd. Vraag de beheerder om het account te bevestigen.", "login");
    if (status === 401 || code === "PGRST301" || code === "PGRST303" || /jwt/i.test(msg)) return fail("Je sessie is verlopen. Meld je opnieuw aan.", "auth", 401);
    if (code === "42501" || status === 403) return fail("Je hebt hier geen rechten voor.", "forbidden", 403);
    if (code === "42P01" || code === "PGRST205") return fail("De tabel 'interventies' bestaat niet. Voer schema.sql uit in Supabase.", "schema", 404);
    if (code === "23514" || code === "22P02") return fail("De database weigert deze waarde. Controleer de ingevulde velden.", "invalid", 400);
    if (status === 429) return fail("Te veel aanvragen tegelijk. Probeer het over enkele seconden opnieuw.", "rate", 429);
    return fail("Er ging iets mis bij de database. " + msg, code || "error", status);
  }

  function who(session) {
    var u = session && session.user;
    if (!u) return null;
    return { id: u.id, name: u.email || "", username: u.email || "" };
  }

  async function init() {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.localStorage }
    });
    var res = await client.auth.getSession();
    if (res.error) throw friendly(res.error);
    user = who(res.data && res.data.session);
    return user;
  }

  async function login(email, password) {
    var res = await client.auth.signInWithPassword({ email: String(email || "").trim(), password: String(password || "") });
    if (res.error) throw friendly(res.error);
    user = who(res.data && res.data.session);
    return user;
  }

  async function logout() {
    try { await client.auth.signOut(); } catch (e) { /* sessie lokaal toch wissen */ }
    user = null;
  }

  function rowToEntry(r) {
    return {
      id: String(r.id),
      plate: String(r.nummerplaat || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      date: String(r.datum || "").slice(0, 10),
      type: r.soort || "Overig",
      description: r.omschrijving || "",
      part: r.onderdeel || "",
      doneBy: r.uitgevoerd_door || "",
      km: r.kilometerstand === null || r.kilometerstand === undefined ? null : Number(r.kilometerstand),
      vehicle: r.voertuig || "",
      createdAt: r.aangemaakt_op ? Date.parse(r.aangemaakt_op) : 0,
      createdBy: r.aangemaakt_door || null
    };
  }

  function entryToRow(rec) {
    var row = {
      nummerplaat: rec.plate,
      datum: rec.date,
      soort: rec.type,
      omschrijving: rec.description,
      onderdeel: rec.part || "",
      uitgevoerd_door: rec.doneBy,
      voertuig: rec.vehicle || ""
    };
    if (rec.km !== null && rec.km !== undefined && !isNaN(rec.km)) row.kilometerstand = Math.round(rec.km);
    return row;
  }

  async function loadEntries() {
    var out = [];
    var from = 0;
    for (;;) {
      var res;
      try {
        res = await client.from(TABLE).select("*").order("aangemaakt_op", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
      } catch (e) { throw friendly(e); }
      if (res.error) throw friendly(res.error);
      var rows = res.data || [];
      rows.forEach(function (r) { out.push(rowToEntry(r)); });
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  async function addEntry(rec) {
    var res;
    try { res = await client.from(TABLE).insert(entryToRow(rec)).select("id").single(); }
    catch (e) { throw friendly(e); }
    if (res.error) throw friendly(res.error);
    return String(res.data.id);
  }

  async function deleteEntry(id) {
    var res;
    try { res = await client.from(TABLE).delete().eq("id", id).select("id"); }
    catch (e) { throw friendly(e); }
    if (res.error) throw friendly(res.error);
    if (!res.data || !res.data.length) throw fail("Je kan alleen interventies verwijderen die je zelf hebt toegevoegd.", "forbidden", 403);
  }

  window.Backend = {
    configured: configured, init: init, login: login, logout: logout,
    loadEntries: loadEntries, addEntry: addEntry, deleteEntry: deleteEntry,
    _rowToEntry: rowToEntry, _entryToRow: entryToRow
  };
})();
