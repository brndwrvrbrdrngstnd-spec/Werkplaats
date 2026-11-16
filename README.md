# Voertuigenlogboek (versie met Supabase)

Webapp om per voertuig (op nummerplaat) onderhoud en herstellingen te bekijken en nieuwe interventies te registreren. De pagina staat op GitHub Pages en bewaart de gegevens in een online database (Supabase). Elke mecanicien meldt zich aan met een eigen account. Op de tablet installeer je de pagina als app.

Er is geen Microsoft Entra of andere beheerrechten van IT voor nodig. Wel moet je werkgever akkoord zijn dat de gegevens buiten Microsoft 365 worden bewaard, zie "Voor je begint".

## Voor je begint

- **Gegevens buiten Microsoft 365.** De database staat bij Supabase, in de EU-regio die je kiest. Er staan namen van mechaniekers in en een logboek van voertuigen. Vraag dus eerst toestemming aan je werkgever of IT, en maak het Supabase-account aan met een bedrijfsmailadres, niet met een privé-adres. Een verwerkersovereenkomst met Supabase kan je op hun website aanvragen of ondertekenen.
- **Gratis plan.** Een gratis Supabase-project wordt na ongeveer een week zonder gebruik automatisch gepauzeerd en heeft geen automatische back-ups. In een werkplaats waar elke week gebruikt wordt is dat meestal geen probleem. Neem toch af en toe een back-up met de knop "Exporteer naar Excel" in de app, en kijk bij betaalde plannen als er veel op staat.
- **Wie wat mag.** Elke aangemelde mecanicien ziet alle interventies en kan nieuwe toevoegen. Verwijderen kan alleen wat je zelf hebt toegevoegd. De beheerder (jij) kan in het Supabase-dashboard alles aanpassen of verwijderen.

## 1. Supabase-project maken

1. Ga naar supabase.com en maak een account (met je bedrijfsmailadres).
2. Kies New project. Geef een naam (bv. Voertuigenlogboek), kies bij Region een regio in de EU (bv. Frankfurt) en bedenk een sterk databasewachtwoord. Bewaar dat wachtwoord, je hebt het zelden nodig. Wacht tot het project klaar is.
3. Open links **SQL Editor**, kies New query, plak de volledige inhoud van `schema.sql` en kies **Run**. Er moet "Success" verschijnen. Dit maakt de tabel en de beveiligingsregels aan.

## 2. Aanmelden regelen

De app gebruikt e-mailadres en wachtwoord. Nieuwe accounts maak jij zelf aan, zodat niemand zich zomaar kan registreren.

1. Ga naar **Authentication**, dan **Sign In / Providers** (of Providers) en zorg dat Email aanstaat. Zet **Allow new users to sign up** uit (of "Enable sign ups" in oudere versies). Zet "Confirm email" uit of laat het aan, maar vink bij elke gebruiker hieronder "Auto Confirm User" aan.
2. Ga naar **Authentication**, dan **Users**, kies **Add user**, dan **Create new user**. Vul het e-mailadres en een wachtwoord in voor elke mecanicien en vink **Auto Confirm User** aan. Geef hen hun gegevens en laat hen het wachtwoord bewaren in hun eigen wachtwoordbeheer.
3. Een gebruiker verwijderen of een wachtwoord veranderen kan op dezelfde pagina.

## 3. Sleutels in de app zetten

1. Ga in Supabase naar **Project Settings**, dan **API** (of **API Keys**).
2. Kopieer de **Project URL** (begint met https:// en eindigt op .supabase.co).
3. Kopieer de **publieke sleutel**. Dat is de "publishable key" (begint met `sb_publishable_`) of de "anon public" sleutel, afhankelijk van je project. Werkt de ene niet, probeer dan de andere (onder Legacy API keys).
4. Kopieer **nooit** de `service_role` of "secret" sleutel naar de app. Die geeft volledige toegang en mag nergens in de code staan.
5. Open `config.js` en vul `supabaseUrl` en `supabaseAnonKey` in. De publieke sleutel mag zichtbaar zijn, want zonder aanmelding geeft de database niets vrij.

## 4. Op GitHub zetten

1. Zet alle bestanden en mappen uit deze zip in je repository, inclusief `vendor`, `icons` en `.nojekyll`. Een bestaande `index.html` mag je overschrijven. Je mag de bestanden `graph.js` en `vendor/msal-browser.min.js` uit de vorige versie verwijderen.
2. Ga naar Settings, Pages, kies "Deploy from a branch", branch `main`, map `/ (root)`.
3. Na een minuut of twee staat de app op het adres dat GitHub toont, bv. `https://jouwnaam.github.io/reponaam/`.

De code is openbaar zichtbaar bij een gratis GitHub-account. De gegevens zijn dat niet, want die staan achter de aanmelding. `schema.sql` en `README.md` hoef je niet te uploaden.

## 5. Testen en op de tablets zetten

1. Open het adres op een computer en meld je aan met een van de accounts. Voeg een testinterventie toe, bijvoorbeeld 19/10/2026, oliefilter vervangen, 12356abc, door Bart. Controleer in Supabase onder **Table Editor**, tabel `interventies`, of de rij erin staat.
2. Op de tablet:
   - **Android (Chrome):** open het adres, menu, "App installeren" of "Toevoegen aan startscherm".
   - **iPad (Safari):** open het adres, Delen, "Zet op beginscherm".
3. Open de app via het nieuwe icoon en meld je één keer aan. De tablet blijft aangemeld.

## Gebruik en beperkingen

- **Opslaan vraagt verbinding.** Zonder internet toont de app de laatst geladen gegevens met een melding, maar nieuwe interventies kunnen pas bewaard worden als de tablet weer online is.
- **Verversen:** de app laadt de gegevens bij het openen, elke minuut en via de knop Vernieuwen.
- **Excel:** de knop "Exporteer naar Excel" maakt een bestand met alle interventies en een overzicht per voertuig. In Supabase kan je de tabel ook als CSV exporteren (Table Editor, Export).
- **Updates:** pas bestanden aan in GitHub. De tablets krijgen de nieuwe versie bij de eerstvolgende keer dat de app met internet opent.

## Als iets niet werkt

- *"De app is nog niet ingesteld":* config.js bevat nog de voorbeeldwaarden.
- *"E-mailadres of wachtwoord klopt niet":* controleer het account onder Authentication, Users. Is het account niet bevestigd, kies dan bij de gebruiker de optie om hem te bevestigen of maak hem opnieuw aan met "Auto Confirm User".
- *"De tabel 'interventies' bestaat niet":* voer `schema.sql` uit in de SQL Editor.
- *"Je hebt hier geen rechten voor":* de beveiligingsregels uit `schema.sql` ontbreken of zijn gewijzigd. Voer het bestand opnieuw uit.
- *Alles laadt niet meer na een tijd van inactiviteit:* het gratis project is gepauzeerd. Open het project in het Supabase-dashboard en kies Restore.
- *Het nieuwe uiterlijk of een wijziging verschijnt niet op de tablet:* sluit de app volledig en open ze opnieuw met internet.

## Meegeleverde bibliotheken

In de map `vendor` staan Supabase JavaScript client (supabase-js 2.45.4, MIT) en SheetJS Community Edition (xlsx 0.18.5, Apache-2.0), met hun licenties. Ze staan lokaal in de repository, zodat de app geen externe scripts hoeft te laden.
