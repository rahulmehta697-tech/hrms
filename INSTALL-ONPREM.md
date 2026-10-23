# Installing on your own server

These steps are for the customer's IT team. They take about 20 minutes.

## What you need

- A Linux server (Ubuntu 22.04 or later is fine) with at least 2 CPU cores, 4 GB RAM and 20 GB disk.
- Docker with the Compose plugin: `curl -fsSL https://get.docker.com | sh`
- The HRMS code folder and the licence key from your vendor.

## 1. Configure

In the code folder:

```bash
cp .env.onprem.example .env
nano .env
```

| Setting | What to put |
|---|---|
| `DB_PASSWORD` | A long password for the built-in database. You don't need to remember it. |
| `SETUP_KEY` | A long random phrase. You'll type it once on the first-run page. |
| `LICENSE_KEY` | The key from your vendor (starts with `HRMS1.`). It can also be pasted later in the portal. |
| `HTTP_PORT` | The port staff use, default `3000`. |
| `DOMAIN` | Only for HTTPS (step 3), e.g. `hrms.yourorg.in`. |

## 2. Start

```bash
docker compose up -d
```

The first start builds the app (a few minutes) and creates the database tables. Then open `http://<server-address>:3000` and complete the setup page with the setup key.

Check it's healthy: `curl http://localhost:3000/api/health` should show `"db":"connected"`.

## 3. HTTPS (recommended)

If staff reach the portal by a name such as `hrms.yourorg.in` and that name points at this server, with ports 80 and 443 open:

```bash
docker compose --profile https up -d
```

This adds an HTTPS front end with a free, auto-renewing certificate for `DOMAIN`. Without it, the portal works over plain HTTP on your local network.

## Backups

Back up the database every night, for example with this cron line, and copy the files off the server:

```bash
0 2 * * * cd /opt/hrms && docker compose exec -T db pg_dump -U hrms hrms | gzip > /backups/hrms-$(date +\%F).sql.gz
```

To restore into an empty installation:

```bash
gunzip -c hrms-DATE.sql.gz | docker compose exec -T db psql -U hrms hrms
```

## Updating

Replace the code folder with the new version from your vendor, keeping your `.env`, then run:

```bash
docker compose up -d --build
```

Database changes apply automatically and your data is kept.

## Useful commands

| Task | Command |
|---|---|
| See logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Stop | `docker compose down` (data is kept in the `hrms-db` volume) |
| Lost Master Admin password | `docker compose exec db psql -U hrms hrms -c "DELETE FROM users WHERE login='ADMIN';"`, then open `/setup` and use the setup key. All other data is kept. |
