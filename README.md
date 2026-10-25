# 2T2M Arena

Echtzeit-Duell-Plattform: Spieler melden sich mit Google an, werden per Matchmaking mit einem Gegner auf ähnlichem Niveau gepaart und treten 60 Sekunden lang gegeneinander an. Wer mehr Fragen richtig beantwortet, gewinnt Elo-Punkte, der Verlierer gibt welche ab.

Erster Modus: **Geografie – Flaggen & Umrisse** (Ranked).

## Tech-Stack

| Bereich  | Technologie |
| -------- | ----------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Motion (Animationen), TanStack Query, Recharts |
| Backend  | Node.js, TypeScript, Express 5, Socket.IO (Echtzeit) |
| Datenbank | PostgreSQL mit Drizzle ORM (Migrationen in `server/drizzle`) |
| Auth     | Google Identity Services → ID-Token wird serverseitig geprüft → Session als httpOnly-JWT-Cookie |

## Projektstruktur

```
shared/   Gemeinsame Typen, Socket-Events, Modi, Rangstufen
server/   API, Matchmaking, Spiellogik, Elo, DB-Schema
client/   React-App (Login, Dashboard, Duell, Verlauf, Rangliste)
```

## Lokales Setup

Voraussetzungen: Node.js ≥ 22, Docker (für Postgres).

```bash
npm install
```

```bash
npm run db:up
```

```bash
cp server/.env.example server/.env
```

Danach in `server/.env` mindestens `JWT_SECRET` auf einen langen Zufallswert setzen und (für Google-Login) `GOOGLE_CLIENT_ID` eintragen.

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001 (Vite leitet `/api` und `/socket.io` dorthin weiter)

Migrationen laufen beim Serverstart automatisch.

### Google-Login einrichten

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Anmeldedaten erstellen → OAuth-Client-ID** → Typ **Webanwendung**.
2. Unter **Autorisierte JavaScript-Quellen** `http://localhost:5173` (und später die Produktions-Domain) eintragen.
3. Die Client-ID in `server/.env` als `GOOGLE_CLIENT_ID` setzen. Ein Client-Secret wird nicht benötigt.

### Duelle lokal testen

Mit `DEV_LOGIN=true` (nur außerhalb von `NODE_ENV=production`) erscheint auf der Login-Seite ein Test-Login per Name. Öffne die App in einem normalen und einem privaten Fenster, melde dich mit zwei Namen an und starte in beiden ein Duell.

## Spielablauf

1. **Queue** – Spieler tritt der Warteschlange bei. Der erlaubte Rating-Abstand startet bei ±100 und wächst pro Sekunde Wartezeit um 20 (max. ±600).
2. **Intro** – Gegner gefunden: VS-Animation, danach Countdown 3-2-1 (insgesamt 6 s).
3. **Spiel** – 60 Sekunden, beide Spieler bekommen dieselbe Fragenfolge (Flagge oder Umriss, 4 Antworten, Ablenker bevorzugt aus derselben Region). Falsche Antwort = 1 s Sperre. Der Punktestand des Gegners wird live angezeigt.
4. **Ergebnis** – Elo-Berechnung (K-Faktor 40 → 32 → 24 je nach Anzahl gespielter Duelle), Rangstufe, Trefferquote.

Die richtigen Antworten kennt nur der Server; Flaggen und Umrisse werden als SVG ausgeliefert, ohne Ländercode.

Rangstufen: Bronze (< 900), Silber, Gold (1100), Platin (1300), Diamant (1500), Meister (1700), Großmeister (1900+). Startwert: 1000.

## Neue Themen hinzufügen

Modi sind in `shared/src/index.ts` (`TOPICS`, `MODES`) registriert; Ratings, Matches und Matchmaking sind bereits pro Modus getrennt. Für ein neues Thema:

1. Modus in `MODES` ergänzen.
2. Einen Fragengenerator analog zu `server/src/game/questions.ts` schreiben und in `Match` je nach Modus auswählen.
3. Im Dashboard eine Karte für den Modus anlegen.

## Produktion

```bash
npm run build
```

```bash
NODE_ENV=production npm start -w server
```

Der Server liefert dann den gebauten Client aus `client/dist` mit aus. `CLIENT_ORIGIN` auf die öffentliche URL setzen und die Domain bei Google als JavaScript-Quelle eintragen.
