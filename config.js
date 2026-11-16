// Vul deze twee waarden in na de installatie in Supabase (zie README.md, deel 2).
// Gebruik de publieke sleutel (publishable of "anon"). Gebruik NOOIT de geheime sleutel (service_role of secret).
// De publieke sleutel mag in de code staan: de database beschermt zichzelf met aanmelding en beveiligingsregels.
window.APP_CONFIG = {
  supabaseUrl: "VERVANG-MET-PROJECT-URL",        // bv. https://abcdefgh.supabase.co
  supabaseAnonKey: "VERVANG-MET-PUBLIEKE-SLEUTEL"
};
