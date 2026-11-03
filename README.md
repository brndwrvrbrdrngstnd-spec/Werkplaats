# Voertuigenlogboek

Webapp om per voertuig (op nummerplaat) onderhoud en herstellingen te bekijken en nieuwe interventies te registreren. Mechaniekers installeren ze op een tablet als app. De gegevens staan in een SharePoint-lijst in jullie Microsoft 365, waar je ze ook met één klik naar Excel kan exporteren.

Hoe het werkt:

- De bestanden staan op GitHub Pages (alleen de pagina zelf, geen gegevens).
- Wie de app opent, meldt zich aan met zijn eigen werkaccount van Microsoft 365.
- De app leest en schrijft de gegevens rechtstreeks in de SharePoint-lijst, met de rechten van de ingelogde persoon.

De installatie bestaat uit vier delen. Deel 1 en 2 vragen meestal de beheerder van Microsoft 365 (IT).

## 1. SharePoint-lijst maken

Maak op een bestaande of nieuwe SharePoint-site een lijst met de naam **Voertuigenlogboek**. Maak de kolommen aan met **exact** deze namen, zonder spaties of accenten (je kan de weergavenaam achteraf wel aanpassen):

| Kolomnaam | Type | Opmerking |
|---|---|---|
| Title | Eén regel tekst (bestaat al) | Bevat de nummerplaat. Mag je in de weergave "Nummerplaat" noemen. |
| Datum | Eén regel tekst | De app schrijft hier een datum als 2026-10-19. |
| Soort | Keuze | Keuzes: Onderhoud, Herstelling, Keuring, Overig |
| Omschrijving | Meerdere regels tekst | Gewone tekst, geen uitgebreide opmaak |
| Onderdeel | Eén regel tekst | Bv. het type van de oliefilter |
| UitgevoerdDoor | Eén regel tekst | Naam van de mecanicien |
| Km | Getal | Geen decimalen |
| Voertuig | Eén regel tekst | Merk of omschrijving, optioneel |

Geef de mechaniekers bewerkingsrechten op de site of de lijst (groep Leden). Wie alleen mag bekijken, kan wel de historiek zien maar niets toevoegen.

## 2. App registreren in Microsoft Entra

1. Ga naar het Microsoft Entra-beheercentrum, dan Identiteit, Toepassingen, App-registraties, Nieuwe registratie.
2. Naam: Voertuigenlogboek. Ondersteunde accounttypen: alleen accounts in deze organisatie.
3. Platform: **Toepassing met één pagina (SPA)**. Omleidings-URI: het adres van je GitHub-pagina uit deel 3, **exact** zoals het in de browser staat en met de slash op het einde, bv. `https://jouwnaam.github.io/voertuigenlogboek/`.
4. Ga naar API-machtigingen, voeg Microsoft Graph toe, delegated: **User.Read** en **Sites.ReadWrite.All**, en kies "Beheerderstoestemming verlenen".
5. Noteer op de overzichtspagina de **Toepassings-ID (client)** en de **Map-ID (tenant)**.

De app werkt altijd met de rechten van de ingelogde persoon: wie geen toegang heeft tot de site, ziet niets. Wil IT de app strenger beperken tot één site, dan kan dat met de machtiging Sites.Selected. Dat vraagt extra instellingen per site en een aanpassing van de scope bovenaan in `graph.js`.

## 3. Op GitHub zetten

1. Maak een nieuwe repository, bv. `voertuigenlogboek`.
2. Upload alle bestanden en mappen uit deze zip (index.html, app.js, graph.js, config.js, styles.css, sw.js, manifest.webmanifest, mappen `vendor` en `icons`, plus `.nojekyll`).
3. Ga naar Settings, Pages, en kies "Deploy from a branch", branch `main`, map `/ (root)`.
4. Na een minuut staat de app op `https://jouwnaam.github.io/voertuigenlogboek/`. Gebruik dit adres bij de omleidings-URI in deel 2.

Let op: GitHub Pages bij een gratis account vereist een openbare repository. De code is dan voor iedereen zichtbaar, maar de gegevens niet, want die staan achter de Microsoft-aanmelding. De waarden in config.js zijn geen geheimen. Wil het bedrijf de code niet openbaar, bespreek dan met IT een GitHub-organisatie met privé-pagina's of een andere vaste plek om de bestanden te hosten (bv. Azure Static Web Apps).

## 4. Instellen en op de tablets zetten

1. Open `config.js` in de repository en vul in: `tenantId`, `clientId`, `sharePointHost` (bv. `contoso.sharepoint.com`), `sitePath` (bv. `/sites/Voertuigen`) en `listName`. Sla op (commit).
2. Open het GitHub-adres op een computer en meld je aan. Voeg een testinterventie toe en controleer in SharePoint dat er een rij bijkwam.
3. Op de tablet:
   - **Android (Chrome):** open het adres, menu, "App installeren" of "Toevoegen aan startscherm".
   - **iPad (Safari):** open het adres, Delen, "Zet op beginscherm".
4. Open de app via het nieuwe icoon en meld je één keer aan. Daarna blijft de tablet aangemeld.

## Gebruik en beperkingen

- **Opslaan vraagt verbinding.** Zonder internet toont de app de laatst geladen gegevens en een melding, maar nieuwe interventies kunnen pas bewaard worden als de tablet weer online is.
- **Verversen:** de app laadt de gegevens opnieuw bij het openen, elke minuut en via de knop Vernieuwen. Wijzigingen van collega's verschijnen dus met korte vertraging.
- **Excel:** de knop "Exporteer naar Excel" in de app maakt een bestand met alle interventies en een overzicht per voertuig. In SharePoint zelf kan je de lijst ook exporteren naar Excel of er weergaven, filters en meldingen op maken.
- **Verwijderen** haalt de rij definitief uit de lijst. SharePoint bewaart verwijderde items nog enige tijd in de prullenbak van de site.
- **Updates:** pas bestanden aan in GitHub. De tablets krijgen de nieuwe versie bij de eerstvolgende keer dat de app met internet opent.

## Als iets niet werkt

- *"App is nog niet ingesteld":* config.js bevat nog de voorbeeldwaarden.
- *Aanmelden loopt vast of geeft een fout over de omleidings-URI:* het adres in de Entra-app moet exact gelijk zijn aan het adres van de app, inclusief slash op het einde en hoofdletters.
- *"Geen toegang":* de aangemelde persoon heeft geen rechten op de site, of de beheerderstoestemming ontbreekt.
- *"SharePoint weigert de gegevens":* een kolomnaam klopt niet met de tabel in deel 1, of een keuze bij Soort ontbreekt.
- *"Lijst niet gevonden":* controleer `sitePath` en `listName` in config.js.

## Meegeleverde bibliotheken

In de map `vendor` staan Microsoft Authentication Library for JavaScript (msal-browser 3.28.1, MIT) en SheetJS Community Edition (xlsx 0.18.5, Apache-2.0), met hun licenties. Ze staan lokaal in de repository, zodat de app geen externe scripts hoeft te laden.
