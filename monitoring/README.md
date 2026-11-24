# CineHunt monitoring - Docker local

Scope: Docker Desktop with Linux containers on the local machine. No VPS, SSH deploy, database changes, migration, or seed. This stack has a separate Compose project and does not require guessing or joining the application network: cAdvisor observes the Docker engine.

## Security and limitations

- All published ports bind to 127.0.0.1 only. Do not expose them publicly.
- cAdvisor runs privileged with host mounts. Read-only mounts do not remove the risks of privileged access or Docker socket access. Run only on a trusted development machine; do not give untrusted users access to its endpoint. It can observe containers outside CineHunt too.
- Docker Desktop uses a Linux environment. cAdvisor visibility, paths, labels and metric availability depend on the Docker Desktop backend/version and cgroup support. This configuration is not yet runtime-validated on your machine. UP only proves scraping works, not that CineHunt container metrics are complete.
- Native Windows host metrics, application health, restart counts and business metrics are not included. No Node Exporter is installed.
- Images use explicit baseline tags, not a claim of latest or vulnerability-free versions. Review compatibility and security updates before broader use.
- Retention is seven days; named volumes retain monitoring history and Grafana state.

## Start (PowerShell at repository root)

Do not overwrite an existing monitoring/.env. First time only:

```powershell
Copy-Item monitoring/.env.example monitoring/.env
notepad monitoring/.env
```

Set a unique strong GRAFANA_ADMIN_PASSWORD. monitoring/.env is ignored by the existing repository rules. Do not commit it or screenshot it. Changing the environment password after Grafana first initializes does not reset an existing admin password.

```powershell
git check-ignore monitoring/.env
docker info --format '{{.OSType}}'
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml config --quiet
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml run --rm --no-deps --entrypoint promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml up -d
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml ps
```

OSType must be linux. Do not use plain `config` for screenshots: interpolated secrets may be printed. First startup requires internet access to pull images. These commands do not update application containers.

## Verify

- Grafana: http://127.0.0.1:3001 (configured username/password), Dashboards > CineHunt > CineHunt - Docker local.
- Prometheus targets: http://127.0.0.1:9090/targets - prometheus and cadvisor should be UP.
- cAdvisor: http://127.0.0.1:8085 ; raw metrics: http://127.0.0.1:8085/metrics .
- In Prometheus query `count by (container_label_com_docker_compose_project, container_label_com_docker_compose_service) (container_memory_working_set_bytes{job="cadvisor",image!=""})`. Confirm actual service/project labels before using the dashboard. Default project filter is cinehunt-prod; change the dashboard textbox if your app uses another project.
- Wait at least two minutes for rate charts. Generate ordinary read-only activity in the app and check that Backend, Web, AI and SQL Server have real series. UP without these series is not acceptance.

If metrics are missing, inspect locally:

```powershell
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml logs --tail=100 cadvisor prometheus grafana
docker version
```

Check Docker Desktop backend, cgroup/mount errors and label availability. Do not change database settings or invent dashboard values to work around missing metrics. Review logs for sensitive data before sharing. If Docker Desktop cannot expose these metrics, document the limitation and adapt the exporter configuration after checking the actual runtime.

## Stop without deleting data

```powershell
docker compose --env-file monitoring/.env -f docker-compose.monitoring.yml stop
```

Do not use down -v. Do not change or delete application volumes.

## Evidence

Save local monitoring container status, Prometheus targets, dashboard with real CPU/RAM/network data and time range, and cAdvisor observations (MD images 30-34 with local captions). No fake host/restart/business metrics. Hide secrets and personal data. Configuration committed is not proof that runtime monitoring passed.
