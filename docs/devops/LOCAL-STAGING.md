# CineHunt Local Staging DevOps (Mac ARM64 + Ubuntu VM)

## Architecture and safety boundaries

- The repository also has a separate root-level `docker-compose.monitoring.yml` for local Mac Docker Desktop monitoring. That stack is not the Ubuntu VM staging stack. The new `deploy/compose.staging.yaml` runs on Ubuntu and collects actual Ubuntu host metrics plus its Docker container metrics.
- Mac Apple Silicon remains the development host.
- Ubuntu Server ARM64 runs the staging application and monitoring stack in Docker Compose.
- Backend, Admin Web and AI images are published to GHCR as multi-platform images: `linux/amd64` and `linux/arm64`.
- GitHub Actions joins the private Tailscale network and deploys to Ubuntu over SSH.
- Prometheus scrapes Ubuntu host metrics (Node Exporter), container metrics (cAdvisor), and HTTP health probes (Blackbox Exporter).
- Grafana is provisioned with a CineHunt dashboard and Prometheus datasource.
- SQL Server is deliberately NOT installed in the ARM64 VM. The staging app connects through a Tailscale-only TCP proxy to the existing Mac SQL Server test instance.
- The staging database name is `CineHunt_Test`. Never set `DB_DATABASE=CineHuntDB`.
- `DB_MIGRATIONS_RUN=false`; no migration, schema or seed is executed by deployment.
- Deploy and rollback never run `docker compose down -v`, `docker volume rm`, or `docker system prune`.

The SQL Server Linux container is supported by Microsoft only on Intel/AMD x86-64 hosts; emulation/translation is not tested or supported. Therefore the existing Mac SQL instance is reused only as a lab/test dependency, not recreated inside the ARM64 VM.

## 1. Create the Ubuntu ARM64 VM with UTM

1. Install UTM on macOS and download an Ubuntu Server 24.04 LTS ARM64 ISO.
2. UTM > `+` > `Virtualize` > `Linux`; choose the ARM64 Ubuntu Server ISO.
3. Suggested allocation: 4 CPU cores, 6 GB RAM, 40 GB disk (reduce RAM if the Mac has limited memory).
4. In the VM network device choose `macOS Shared Network`. This allows host/guest services to see each other.
5. Install Ubuntu, create a normal user, update the OS, and confirm architecture:

```bash
uname -m
lsb_release -a
```

Expected architecture: `aarch64`.

UTM network documentation: https://docs.getutm.app/settings-qemu/devices/network/network/

## 2. Install Docker Engine and tools inside Ubuntu

Run inside the Ubuntu VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git jq netcat-openbsd openssh-server
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
sudo systemctl enable --now ssh
```

Log out and log back in, then verify:

```bash
docker run --rm hello-world
docker compose version
docker info --format '{{.Architecture}}'
```

Expected Docker architecture: `aarch64`.

## 3. Configure Tailscale private access

Install/sign in to Tailscale on both the Mac and Ubuntu VM using the same tailnet.

On Ubuntu, after creating the `tag:staging` tag in the Tailscale access policy:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --advertise-tags=tag:staging
tailscale ip -4
```

On the Mac, install the Tailscale app, sign in, and obtain its IPv4 address:

```bash
tailscale ip -4
```

In the Tailscale admin console, tag the Mac device as `tag:db-host`.

Merge the following rules into the existing tailnet policy. Do not delete existing rules your other devices need:

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"],
    "tag:staging": ["autogroup:admin"],
    "tag:db-host": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:staging:22"]
    },
    {
      "action": "accept",
      "src": ["tag:staging"],
      "dst": ["tag:db-host:14333"]
    },
    {
      "action": "accept",
      "src": ["tag:db-host"],
      "dst": ["tag:staging:22"]
    },
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["tag:staging:22", "tag:db-host:14333"]
    }
  ]
}
```

Create a Tailscale OAuth client with the `auth_keys` scope and tag `tag:ci`. Save its client ID and secret as GitHub Actions repository secrets:
- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`

Tailscale's GitHub Action supports securely reaching private deployment hosts from GitHub-hosted runners: https://tailscale.com/docs/integrations/github/github-action

## 4. Prepare a dedicated SSH deploy user

Inside Ubuntu VM:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo systemctl restart ssh
```

On the Mac, create a dedicated Ed25519 key (do not reuse your personal key):

```bash
ssh-keygen -t ed25519 -C "cinehunt-staging-deploy" -f "$HOME/.ssh/cinehunt_staging_deploy" -N ""
cat "$HOME/.ssh/cinehunt_staging_deploy.pub"
```

Copy the public key output into Ubuntu:

```bash
sudo tee /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Test from Mac using the Ubuntu VM's Tailscale IPv4:

```bash
ssh -i "$HOME/.ssh/cinehunt_staging_deploy" deploy@<UBUNTU_TAILSCALE_IP>
```

Verify the Ubuntu SSH host fingerprint before trusting it:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the Mac, collect the host key line:

```bash
ssh-keyscan -t ed25519 <UBUNTU_TAILSCALE_IP>
```

Compare the fingerprint with the value shown inside Ubuntu. Store the verified key line as GitHub secret `STAGING_KNOWN_HOSTS`.

Create these additional GitHub Actions repository secrets:
- `STAGING_HOST`: Ubuntu VM Tailscale IPv4 address (or MagicDNS name)
- `STAGING_USER`: `deploy`
- `STAGING_SSH_PRIVATE_KEY`: full contents of `~/.ssh/cinehunt_staging_deploy`
- `STAGING_KNOWN_HOSTS`: verified output from `ssh-keyscan`

## 5. Connect staging to the Mac SQL Server test instance

This step does not restart or recreate SQL Server. It only forwards TCP traffic.

On the Mac, verify the existing test container is running and the port mapping is still loopback-only:

```bash
docker ps --filter name=cinehunt-sql-dev
docker port cinehunt-sql-dev 1433/tcp
```

Expected mapping: `127.0.0.1:14332`.

Install socat on the Mac if needed:

```bash
brew install socat
```

From the repository root, start the proxy:

```bash
bash deploy/scripts/mac-db-proxy.sh
```

Leave this terminal open. It listens only on the Mac Tailscale IP at TCP 14333 and forwards to the existing local SQL port 14332. Stop it with Ctrl+C.

From Ubuntu, test connectivity:

```bash
nc -vz <MAC_TAILSCALE_IP> 14333
```

### Verify the staging database before any schema command

Run this read-only query against the SQL Server instance:

```sql
SELECT name, state_desc
FROM sys.databases
WHERE name IN (N'CineHuntDB', N'CineHunt_Test');
```

If `CineHunt_Test` exists, inspect it read-only before proceeding:

```sql
USE [CineHunt_Test];
SELECT COUNT(*) AS table_count FROM sys.tables;
SELECT OBJECT_ID(N'dbo.users', N'U') AS users_table_id;
```

- If `CineHunt_Test` exists, run the read-only table-count query. Only an empty database (zero tables and no data) is eligible for the schema script. If it has any tables or data, do not run the schema script; confirm that it is the intended staging/test database first. If it is not a dedicated staging DB, stop here.
- If `CineHunt_Test` does not exist, the reviewed `database/safe/CineHunt_Schema_Safe.sql` creates that database and its schema. The file itself says it has not yet been executed in the repository, so run it only after verifying the target SQL instance and database name. Run it from the Mac against the existing test SQL container, never against `CineHuntDB`:

```bash
cd "$HOME/Projects/Cinehunt-local-clean"
docker cp database/safe/CineHunt_Schema_Safe.sql cinehunt-sql-dev:/tmp/CineHunt_Schema_Safe.sql
docker exec cinehunt-sql-dev bash -lc '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -i /tmp/CineHunt_Schema_Safe.sql'
docker exec cinehunt-sql-dev rm -f /tmp/CineHunt_Schema_Safe.sql
```

- The original `database/reference/CineHunt_Database_V6_3_With_Sample_Data.sql` is destructive: it starts with `DROP DATABASE CineHuntDB` and drops database objects. Never execute it.
- Never set staging `DB_DATABASE` to `CineHuntDB`.

### Create a least-privilege staging login

Do not run the app as SQL Server `sa`. After the staging schema exists, use the dedicated script. It creates `cinehunt_staging_app` and grants only `db_datareader`, `db_datawriter`, and `EXECUTE` inside `CineHunt_Test`; it does not grant `db_owner` or `sysadmin`.

Run on the Mac from the repository root:

```bash
export STAGING_DB_PASSWORD="CineHunt_$(openssl rand -hex 24)A9"
cp deploy/sql/create-staging-login.sql /tmp/cinehunt-staging-login.sql
python3 - <<'PY'
import os
from pathlib import Path
path = Path("/tmp/cinehunt-staging-login.sql")
sql = path.read_text()
sql = sql.replace("REPLACE_WITH_RANDOM_PASSWORD", os.environ["STAGING_DB_PASSWORD"])
path.write_text(sql)
PY
docker cp /tmp/cinehunt-staging-login.sql cinehunt-sql-dev:/tmp/cinehunt-staging-login.sql
docker exec cinehunt-sql-dev bash -lc '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -i /tmp/cinehunt-staging-login.sql'
docker exec cinehunt-sql-dev rm -f /tmp/cinehunt-staging-login.sql
rm -f /tmp/cinehunt-staging-login.sql
printf 'DB_USERNAME=cinehunt_staging_app\nDB_PASSWORD=%s\n' "$STAGING_DB_PASSWORD"
```

Copy the printed password into the Ubuntu staging env file. Do not screenshot or commit it. If the login already exists, do not rerun the script with a newly generated password; stop and verify/reset that test login deliberately.

The reference seed file `database/safe/CineHunt_Seed_Reference_Safe.sql` is optional. Run it only after the schema exists and only on the isolated test database. It inserts reference roles, seat types, genres and concession combos, not customer accounts or bookings.

## 6. Configure the staging environment file on Ubuntu

Clone the repository once as the deploy user:

```bash
git clone https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim.git "$HOME/cinehunt"
cd "$HOME/cinehunt"
mkdir -p "$HOME/.config/cinehunt"
cp deploy/.env.staging.example "$HOME/.config/cinehunt/.env.staging"
chmod 600 "$HOME/.config/cinehunt/.env.staging"
```

Edit `~/.config/cinehunt/.env.staging`:
- `STAGING_DB_HOST`: Mac Tailscale IPv4 address
- `STAGING_DB_PORT`: `14333`
- `DB_DATABASE`: `CineHunt_Test`
- `DB_USERNAME`: `cinehunt_staging_app`
- `DB_PASSWORD`: the generated password printed by the least-privilege login setup above
- Generate separate secrets:

```bash
openssl rand -hex 32
```

Use different values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `OTP_HASH_SECRET`. Generate a separate Grafana admin password.

The three GHCR packages must be pullable by the Ubuntu deploy user. If packages are private, run `docker login ghcr.io` on Ubuntu with a GitHub token that has only `read:packages`, using `--password-stdin`. Do not put the token in Git.

## 7. Publish ARM64 images to GHCR

On GitHub:
1. Open Actions.
2. Select `CD - Publish CineHunt Docker images`.
3. Click `Run workflow` on `main`.
4. Wait for the CI dependency and all three publish jobs to succeed.
5. Record the full 40-character commit SHA from the run.

The workflow publishes each app image with:
- `latest`
- the full commit SHA as an immutable image tag

The build now targets `linux/amd64` and `linux/arm64`. Docker Buildx supports publishing multi-platform manifests using the `platforms` option: https://docs.docker.com/build/ci/github-actions/multi-platform/

## 8. First local deployment and SSH deployment

First, test manually inside Ubuntu:

```bash
cd "$HOME/cinehunt"
git fetch origin main
git checkout --detach <FULL_40_CHAR_COMMIT_SHA>
bash deploy/scripts/deploy-staging.sh <FULL_40_CHAR_COMMIT_SHA>
bash deploy/scripts/healthcheck-staging.sh
```

Then run GitHub Actions:
1. Open Actions > `Deploy CineHunt to Local Ubuntu Staging`.
2. Click `Run workflow` on `main`.
3. Enter the full commit SHA that was published to GHCR.
4. Start the workflow and inspect the SSH deployment job.

The workflow joins Tailscale, verifies the SSH host key, fetches the exact commit on Ubuntu, then runs the deployment script. It does not deploy on every push.

## 9. Monitoring and dashboard access

On the Mac, create SSH tunnels to the Ubuntu VM:

```bash
ssh -i "$HOME/.ssh/cinehunt_staging_deploy" \
  -L 8080:127.0.0.1:8080 \
  -L 3001:127.0.0.1:3001 \
  -L 9090:127.0.0.1:9090 \
  deploy@<UBUNTU_TAILSCALE_IP>
```

Open:
- Admin Web: http://127.0.0.1:8080
- Grafana: http://127.0.0.1:3001
- Prometheus: http://127.0.0.1:9090

Grafana dashboard: `CineHunt Staging Overview`.
Prometheus targets: http://127.0.0.1:9090/targets

Node Exporter reports Ubuntu VM host metrics. cAdvisor reports container metrics. Blackbox Exporter probes Admin Web, Backend health (including its DB query), and AI health.

## 10. Rollback

On Ubuntu:

```bash
cd "$HOME/cinehunt"
bash deploy/scripts/rollback-staging.sh
bash deploy/scripts/healthcheck-staging.sh
```

Rollback selects the previously recorded full image SHA and redeploys it. It does not run SQL changes or remove Docker volumes.

Do not use `docker compose down -v`, `docker volume rm`, `docker system prune --volumes`, or SQL rollback scripts as part of application rollback.

## 11. Evidence screenshots for the report

Capture:
1. UTM Ubuntu VM settings showing ARM64 and Shared Network.
2. Ubuntu terminal: `uname -m` and Docker architecture.
3. Tailscale admin showing tagged staging VM and private ACL.
4. GitHub Actions CD run with all three GHCR publish jobs green.
5. GHCR package page showing backend, admin-web and AI tags.
6. GitHub Actions Deploy Staging run with successful SSH deploy.
7. Ubuntu `docker compose ps` showing Backend, AI, Admin Web, Prometheus, Grafana, cAdvisor, Node Exporter and Blackbox Exporter.
8. CineHunt Admin Web loaded through SSH tunnel.
9. Prometheus Targets page with all targets UP.
10. Grafana CineHunt dashboard with CPU, memory, container and endpoint panels.
11. Rollback terminal showing previous SHA restored and health checks passing.

## Known boundaries

- This is a local educational staging environment, not production hosting.
- Mac must be awake, Docker Desktop running, Tailscale connected and the socat proxy terminal running for staging DB connectivity.
- SQL Server container emulation on Apple Silicon is not an officially supported Microsoft configuration.
- No database migration is part of deployment.
- If the database is missing schema, application health may fail. Stop and inspect the isolated test database; do not point staging at the primary database to make the health check green.
