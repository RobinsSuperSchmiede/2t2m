# 2T2M Battle

Echtzeit-Duell-Plattform: Besucher landen direkt beim Spiel, melden sich beim Klick auf „Spielen“ mit Google an, werden per Matchmaking mit einem Gegner auf ähnlichem Niveau gepaart und treten 60 Sekunden lang gegeneinander an. Wer mehr Fragen richtig beantwortet, gewinnt Elo-Punkte, der Verlierer gibt welche ab.

Erster Modus: **Geografie – Flaggen & Umrisse** (Ranked).

## Tech-Stack

| Bereich  | Technologie |
| -------- | ----------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Motion (Animationen), TanStack Query, Recharts |
| Backend  | Node.js, TypeScript, Express 5, Socket.IO (Echtzeit) |
| Datenbank | PostgreSQL mit Drizzle ORM (Migrationen in `apps/server/drizzle`) |
| Auth     | Google Identity Services → ID-Token wird serverseitig geprüft → Session als httpOnly-JWT-Cookie |
| Zahlungen | Stripe Checkout (Abo), Kundenportal, signierte Webhooks |

## Projektstruktur

```
apps/
  client/        React-App (Spiel, Statistiken, Verlauf, Rangliste, Pro), Übersetzungen in src/locales
  server/        API, Socket.IO-Spielserver, Matchmaking, Elo, DB-Schema und Migrationen
packages/
  shared/        Gemeinsame Typen, Socket-Events, Modi, Rangstufen, Sprachen
deploy/aws/      ECS-Task-Definition für das Deployment
docs/            Deployment-Anleitung
.github/         CI (Typecheck, Build, Docker) und Deploy-Workflow
Dockerfile       Produktions-Image (Server + gebauter Client)
```

## Lokales Setup

Voraussetzungen: Node.js ≥ 22 (empfohlen: Version aus `.nvmrc`), Docker (für Postgres).

```bash
npm install
```

```bash
npm run db:up
```

```bash
cp apps/server/.env.example apps/server/.env
```

Danach in `apps/server/.env` mindestens `JWT_SECRET` auf einen langen Zufallswert setzen und (für Google-Login) `GOOGLE_CLIENT_ID` eintragen.

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001 (Vite leitet `/api` und `/socket.io` dorthin weiter)

Migrationen laufen beim Serverstart automatisch.

### Google-Login einrichten

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Anmeldedaten erstellen → OAuth-Client-ID** → Typ **Webanwendung**.
2. Unter **Autorisierte JavaScript-Quellen** `http://localhost:5173` (und später die Produktions-Domain) eintragen.
3. Die Client-ID in `apps/server/.env` als `GOOGLE_CLIENT_ID` setzen. Ein Client-Secret wird nicht benötigt.

### Stripe (Pro-Abo) einrichten

1. Im [Stripe-Dashboard](https://dashboard.stripe.com/test/apikeys) den geheimen Schlüssel kopieren und als `STRIPE_SECRET_KEY` in `apps/server/.env` setzen (zum Testen den `sk_test_…`-Schlüssel).
2. Optional ein Produkt mit 3 €/Monat anlegen und dessen Preis-ID als `STRIPE_PRICE_ID` eintragen. Ohne Preis-ID legt der Checkout 3 €/Monat automatisch an.
3. Webhook einrichten – lokal mit der [Stripe CLI](https://docs.stripe.com/stripe-cli):

   ```bash
   stripe listen --forward-to localhost:3001/api/stripe/webhook
   ```

   Das angezeigte `whsec_…` als `STRIPE_WEBHOOK_SECRET` eintragen. In Produktion im Dashboard einen Endpunkt `https://<domain>/api/stripe/webhook` mit den Events `checkout.session.completed` und `customer.subscription.*` anlegen.
4. Unter **Einstellungen → Billing → Kundenportal** das Portal aktivieren (dort kündigen Nutzer ihr Abo).

Pro gilt, solange das Stripe-Abo den Status `active` oder `trialing` hat. Nach dem Checkout wird das Abo sofort abgeglichen; der Webhook hält es danach aktuell (Verlängerung, Kündigung, fehlgeschlagene Zahlung).

### Werbung

Ohne Konfiguration zeigen die Werbeplätze eine eigene Anzeige für Pro. Für Google AdSense in `apps/client/.env` (beim Docker-Build als `--build-arg`):

```
VITE_ADSENSE_CLIENT=ca-pub-…
VITE_ADSENSE_SLOT_RAIL=…     # 160×600 am linken/rechten Rand (ab 1280 px Breite)
VITE_ADSENSE_SLOT_INLINE=…   # kleiner Banner im Inhalt auf schmalen Bildschirmen
```

Während Intro und Duell gibt es keine Anzeigen im Inhalt; Pro-Spieler sehen nirgends Werbung.

### Duelle lokal testen

Mit `DEV_LOGIN=true` (nur außerhalb von `NODE_ENV=production`) erscheint im Anmeldefenster ein Test-Login per Name. Auf der Pro-Seite gibt es dann außerdem einen Dev-Schalter, der Pro ohne Zahlung an- und ausschaltet. Öffne die App in einem normalen und einem privaten Fenster, melde dich mit zwei Namen an und starte in beiden ein Duell.

## Spielablauf

1. **Queue** – Spieler tritt der Warteschlange bei. Der erlaubte Rating-Abstand startet bei ±100 und wächst pro Sekunde Wartezeit um 20 (max. ±600).
   Sucht sonst niemand, bekommt der Spieler nach 6–12 s einen **Bot** mit unauffälligem Namen und einem Rating knapp neben seinem eigenen (warten andere Spieler mit zu großem Abstand, erst nach 30 s). Der Bot antwortet nach 1–4 s Bedenkzeit zufällig. Das Duell zählt normal für Rating und Stundenlimit; Bots erscheinen nicht in der Rangliste. Abschalten mit `BOTS_ENABLED=false`.
2. **Intro** – Gegner gefunden: VS-Animation, danach Countdown 3-2-1 (insgesamt 6 s).
3. **Spiel** – 60 Sekunden, beide Spieler bekommen dieselbe Fragenfolge (Flagge oder Umriss, 4 Antworten, Ablenker bevorzugt aus derselben Region). Falsche Antwort = 1 s Sperre. Der Punktestand des Gegners wird live angezeigt.
4. **Ergebnis** – Elo-Berechnung (K-Faktor 40 → 32 → 24 je nach Anzahl gespielter Duelle), Rangstufe, Trefferquote.

## Free vs. Pro

| | Free | Pro (3 €/Monat) |
| --- | --- | --- |
| Ranked-Duelle | 1 pro Stunde | unbegrenzt |
| Rating, Rang, Verlauf | ✓ | ✓ |
| Detaillierte Statistiken (Rating-Verlauf, Antwortzeit, Fragetypen, schwächste/stärkste Länder) | – | ✓ |
| Werbung | kleine Anzeigen am Rand | keine |

Das Stundenlimit setzt der Server durch: Beim Start eines Duells wird der Zeitpunkt gespeichert, und ein kostenloser Spieler kann der Warteschlange erst eine Stunde danach wieder beitreten. Der Client zeigt nur den Countdown an. Auch die Detail-Statistiken liefert der Server nur an Pro-Spieler aus.

Die richtigen Antworten kennt nur der Server; Flaggen und Umrisse werden als SVG ausgeliefert, ohne Ländercode.

Rangstufen: Bronze (< 900), Silber, Gold (1100), Platin (1300), Diamant (1500), Meister (1700), Großmeister (1900+). Startwert: 1000.

## Neue Themen hinzufügen

Modi sind in `packages/shared/src/index.ts` (`MODES`) registriert; Texte dazu in `apps/client/src/locales`; Ratings, Matches und Matchmaking sind bereits pro Modus getrennt. Für ein neues Thema:

1. Modus in `MODES` ergänzen.
2. Einen Fragengenerator analog zu `apps/server/src/game/questions.ts` schreiben und in `Match` je nach Modus auswählen.
3. Auf der Spielseite eine Karte für den Modus anlegen.

## Produktion

Die App läuft als **ein Docker-Container** (API, Socket.IO-Spielserver und gebauter Client) mit PostgreSQL daneben. Empfohlenes Ziel ist **AWS ECS Fargate + Application Load Balancer + RDS** – Schritt für Schritt in [docs/deployment.md](docs/deployment.md), inklusive der Gründe, warum Vercel und Cloudflare für den Spielserver nicht passen.

Produktionsnah lokal testen (App auf http://localhost:8080):

```bash
npm run docker:prod
```

Wichtig für den Betrieb:

- **Health-Checks:** `/api/health` (Prozess läuft) und `/api/health/ready` (DB erreichbar, kein Shutdown) – Letzteren im Load Balancer verwenden.
- **Deploys ohne abgebrochene Duelle:** Bei `SIGTERM` nimmt der Server keine neuen Duelle mehr an, schickt wartende Spieler zur neuen Instanz und spielt laufende Duelle zu Ende (`SHUTDOWN_TIMEOUT_MS`, Standard 90 s).
- **Migrationen** laufen beim Start, abgesichert über eine Postgres-Advisory-Lock.
- **Logs** sind in Produktion JSON (pino), lokal lesbar formatiert.
- **Skalierung:** Warteschlange und laufende Duelle liegen im Speicher – es läuft genau **eine** Instanz gleichzeitig (außer kurz während eines Deploys). Für mehrere Instanzen siehe „Skalierung“ in der Deployment-Anleitung.
