# Looker Studio PostgreSQL Access

Looker Studio should connect to PostgreSQL with a dedicated read-only user, not
the application owner or the `postgres` superuser.

## Current Production Shape

The production Docker Compose file currently publishes PostgreSQL only on the
server loopback interface:

```yaml
ports:
  - "127.0.0.1:5434:5432"
```

That is good for private server access, but Looker Studio cannot reach it from
Google infrastructure. To allow Looker Studio, publish the port on the server
network interface and restrict access with firewall rules.

## 1. Create Read-Only User And Reporting Views

Run this from the project directory on the server after choosing a strong
password:

```bash
docker exec -i customer-hub-postgres psql \
  -U postgres \
  -d customer_hub \
  -v looker_password='replace_with_strong_password' \
  < scripts/setup-looker-readonly.sql
```

The script is idempotent. It creates or updates:

- `looker_readonly` database role
- `looker_clients` reporting view
- `looker_messages` reporting view
- `looker_lead_sources` reporting view

The views expose Looker-friendly `snake_case` column names and avoid requiring
Looker reports to quote TypeORM camelCase columns.

## 2. Publish PostgreSQL For External Access

Change the server `docker-compose.yml` PostgreSQL port mapping from:

```yaml
ports:
  - "127.0.0.1:5434:5432"
```

to:

```yaml
ports:
  - "5434:5432"
```

Then apply the Compose change:

```bash
docker compose up -d
```

## 3. Restrict Firewall Access To Looker Studio

Allow only the Looker Studio PostgreSQL connector source range:

```bash
ufw allow from 142.251.74.0/23 to any port 5434 proto tcp
ufw enable
ufw status numbered
```

For Looker Studio Pro with data residency enabled, use Google's documented
data-residency range instead of the default range.

## 4. Connect In Looker Studio

Use the PostgreSQL connector with these values:

```text
Host: 208.116.19.64
Port: 5434
Database: customer_hub
Username: looker_readonly
Password: password from step 1
```

Start with one of the reporting views:

- `looker_clients`
- `looker_messages`
- `looker_lead_sources`

## Notes

Do not connect Looker Studio as `postgres`.

Do not open PostgreSQL to `0.0.0.0/0`. If access is still blocked after the
firewall change, check whether the hosting provider has a separate network
firewall that also needs the same allowlist rule.
