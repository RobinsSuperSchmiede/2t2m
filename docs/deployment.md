# Deployment

## Warum AWS (und nicht Vercel oder Cloudflare)

2T2M Battle besteht aus einem **zustandsbehafteten Echtzeit-Server**: Warteschlange und laufende Duelle liegen im Arbeitsspeicher, jeder Spieler hält eine WebSocket-Verbindung (Socket.IO) über mehrere Minuten offen, und Timer laufen serverseitig.

| Plattform | Eignung |
| --- | --- |
| **Vercel** | Serverless-Funktionen mit kurzer Laufzeit, keine dauerhaften WebSockets, kein gemeinsamer Speicher → der Spielserver kann dort nicht laufen. |
| **Cloudflare** | Nur mit kompletter Neuentwicklung auf Durable Objects (kein Node-HTTP-Server, kein Socket.IO, kein `pg`). |
| **AWS ECS Fargate** | Läuft das Docker-Image unverändert, WebSockets über den Application Load Balancer, verwaltetes Postgres über RDS. ✅ |

Das Image ist plattformneutral – Fly.io, Render oder Railway funktionieren mit denselben Umgebungsvariablen ebenfalls.

## Architektur

```
Browser ──HTTPS/WSS──▶ Application Load Balancer (ACM-Zertifikat, Sticky Sessions)
                              │
                              ▼
                       ECS Fargate Service (1 Task: 2t2m-Container, Port 3001)
                              │  TLS (verify)
                              ▼
                       RDS PostgreSQL 17 (privates Subnetz)

Secrets Manager ──▶ DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, STRIPE_*
CloudWatch Logs ◀── JSON-Logs (pino)
```

Ein Container liefert API, Socket.IO und den gebauten Client aus – alles unter **einer Domain**, damit das Session-Cookie same-origin bleibt.

## Einmalige Einrichtung

Region, Account-ID und Domain im Folgenden durch eigene Werte ersetzen.

### 1. Datenbank (RDS)

- **RDS → Datenbank erstellen:** PostgreSQL 17, z. B. `db.t4g.micro` (später größer), Speicher 20 GB gp3, automatische Backups an (7 Tage), Löschschutz an.
- In der VPC des ECS-Clusters, **nicht öffentlich zugänglich**.
- Security Group: eingehend Port 5432 **nur** von der Security Group der ECS-Tasks.
- Verbindungs-URL: `postgres://<user>:<passwort>@<endpoint>:5432/<db>`

### 2. Secrets (Secrets Manager)

Ein Secret `2t2m/prod` (Typ „Anderer Secret-Typ“) mit den Schlüsseln:

| Schlüssel | Wert |
| --- | --- |
| `DATABASE_URL` | URL aus Schritt 1 |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` | OAuth-Client-ID (Produktions-Domain als JavaScript-Quelle eintragen) |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` des Produktions-Webhooks |

### 3. Container-Registry (ECR)

```bash
aws ecr create-repository --repository-name 2t2m --image-scanning-configuration scanOnPush=true
```

### 4. IAM

- **Execution Role** `2t2m-ecs-execution`: Managed Policy `AmazonECSTaskExecutionRolePolicy` plus `secretsmanager:GetSecretValue` auf `2t2m/prod` und `logs:CreateLogGroup`.
- **Deploy-Rolle für GitHub Actions** (OIDC, keine Zugangsschlüssel): Identity Provider `token.actions.githubusercontent.com` anlegen, Rolle mit Trust auf `repo:<owner>/<repo>:environment:production` und Rechten für `ecr:*` (auf das Repository), `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`, `ecs:DescribeTaskDefinition` sowie `iam:PassRole` auf die Execution Role.

### 5. Load Balancer

- **Application Load Balancer** (öffentlich), Listener 443 mit ACM-Zertifikat für die Domain, Listener 80 → Redirect auf 443.
- **Idle Timeout:** 120 s.
- **Target Group** (Typ IP, Port 3001, HTTP):
  - Health Check: Pfad `/api/health/ready`, Intervall 15 s, Healthy-Schwelle 2.
  - **Deregistration Delay: 90 s** – so lange werden laufende Duelle auf der alten Task zu Ende gespielt (Intro 6 s + Spiel 60 s + Speichern).
  - **Stickiness:** an (Load-Balancer-Cookie, 1 Tag) – nötig, damit Socket.IO während eines Deploys bei derselben Task bleibt.
- DNS: Domain per Alias/CNAME auf den Load Balancer.

### 6. ECS

- Cluster (Fargate) anlegen.
- In [`deploy/aws/task-definition.json`](../deploy/aws/task-definition.json) `<ACCOUNT_ID>`, `<REGION>` und `<DOMAIN>` ersetzen und einmal registrieren:

  ```bash
  aws ecs register-task-definition --cli-input-json file://deploy/aws/task-definition.json
  ```

- Service anlegen:
  - Launch Type Fargate, **Desired Count 1** (siehe [Skalierung](#skalierung)).
  - Deployment: Minimum 100 %, Maximum 200 % (neue Task startet, bevor die alte gestoppt wird), Circuit Breaker mit Rollback an.
  - Health Check Grace Period: 30 s.
  - Load Balancer: Target Group aus Schritt 5, Container `app:3001`.
  - Netzwerk: private Subnetze mit NAT (oder öffentliche Subnetze mit öffentlicher IP), Security Group: eingehend 3001 nur vom Load Balancer.

### 7. GitHub

Unter **Settings → Environments → production** diese Variablen anlegen:

| Variable | Beispiel |
| --- | --- |
| `AWS_REGION` | `eu-central-1` |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/2t2m-github-deploy` |
| `ECR_REPOSITORY` | `2t2m` |
| `ECS_CLUSTER` | `2t2m` |
| `ECS_SERVICE` | `2t2m` |
| `VITE_ADSENSE_*` | optional |

### 8. Externe Dienste

- **Google:** Produktions-Domain unter „Autorisierte JavaScript-Quellen“ eintragen.
- **Stripe:** Webhook-Endpunkt `https://<DOMAIN>/api/stripe/webhook` mit den Events `checkout.session.completed` und `customer.subscription.*`; Kundenportal aktivieren.

## Deployen

**Actions → Deploy (AWS ECS) → Run workflow.** Der Workflow baut das Image, pusht es nach ECR, registriert eine neue Task-Definition und wartet, bis der Service stabil ist. Migrationen führt der Server beim Start selbst aus (per Advisory-Lock gegen parallele Läufe abgesichert).

Ablauf eines Deploys ohne abgebrochene Duelle:

1. Neue Task startet, migriert, meldet sich über `/api/health/ready` gesund.
2. ECS markiert die alte Task zum Stoppen. Der Server erkennt das über die ECS-Task-Metadaten und **drained**: keine neuen Duelle, Spieler ohne laufendes Duell werden getrennt und verbinden sich über den Load Balancer mit der neuen Task (eine laufende Suche wird dort automatisch fortgesetzt).
3. Laufende Duelle werden auf der alten Task zu Ende gespielt und gespeichert; die Spieler sehen ihr Ergebnis und ziehen danach um.
4. Nach dem Deregistration Delay folgt `SIGTERM`, der Server beendet sich sauber.

## Betrieb

- **Logs:** CloudWatch-Log-Gruppe `/ecs/2t2m`, JSON pro Zeile (`level`, `msg`, `matchId`, `userId`, …). Nützliche Filter: `{ $.level >= 50 }` (Fehler), `{ $.msg = "Duell gestartet" }`.
- **Alarme (empfohlen):** Target Group `UnHealthyHostCount > 0`, ALB `HTTPCode_Target_5XX_Count`, RDS `CPUUtilization` und `FreeStorageSpace`.
- **Readiness-Endpunkt** `/api/health/ready` liefert zusätzlich `queued` und `activeMatches`.
- **Backups:** RDS-Snapshots automatisch; vor größeren Migrationen manuell einen Snapshot ziehen.
- **Neue Migration:** `npm run db:generate` lokal, Dateien in `apps/server/drizzle` committen – der nächste Deploy wendet sie an.

## Skalierung

Warteschlange und laufende Duelle liegen im Speicher einer Instanz. Deshalb läuft der Service mit **genau einer Task** (während eines Deploys kurz zwei). Für den Start reicht eine Fargate-Task mit 0,5 vCPU/1 GB; wird es eng (CPU/Speicher in CloudWatch beobachten), lässt sie sich vertikal bis 16 vCPU vergrößern.

Für mehrere gleichzeitige Instanzen sind diese Umbauten nötig:

1. **Redis** (ElastiCache) als gemeinsamer Speicher.
2. `@socket.io/redis-adapter`, damit Events alle Instanzen erreichen.
3. Warteschlange in Redis (z. B. Sorted Set nach Rating) mit einer Instanz, die per Lock das Pairing übernimmt.
4. Duell-Zustand an eine Instanz binden (Besitzer per Redis-Lock) und Antworten dorthin weiterleiten.
5. Rate-Limits (`express-rate-limit`) auf einen Redis-Store umstellen.
