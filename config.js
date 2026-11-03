// Vul deze vijf waarden in na de installatie (zie README.md, stap 1 en 2).
// Er staan hier geen geheimen in: de tenant-ID en client-ID zijn gewoon identificatiecodes.
window.APP_CONFIG = {
  tenantId: "VERVANG-MET-TENANT-ID",          // Directory (tenant) ID van de Entra-app
  clientId: "VERVANG-MET-CLIENT-ID",          // Application (client) ID van de Entra-app
  sharePointHost: "VERVANG.sharepoint.com",   // bv. "contoso.sharepoint.com"
  sitePath: "/sites/VERVANG",                 // bv. "/sites/Voertuigen"
  listName: "Voertuigenlogboek"               // naam van de SharePoint-lijst
};
