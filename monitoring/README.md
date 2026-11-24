# CineHunt local monitoring

Standalone Prometheus + Grafana + cAdvisor. Does not change application Compose, application code, database, migrations, CI or deploy workflows. Start the application separately first. cAdvisor observes accessible Docker containers, including other projects: do not publish screenshots with sensitive container names.

## Requirements and limitations

Linux containers are required. Native Linux Docker is the baseline. On Windows/macOS Docker Desktop, cAdvisor runs inside the Linux VM; bind mounts, Docker storage layout, cgroups and security settings may prevent container discovery or some metrics. Metrics are NOT Windows/macOS physical-host metrics. Do not claim successful monitoring until real application container series appear. Node Exporter, business metrics, application health probes, restart counters and alerts are not included.

cAdvisor uses privileged mode and sensitive host mounts. Read-only mounts do NOT make privileged access safe. Run only on a trusted local development machine; review before use. No cAdvisor port is published. Prometheus and Grafana bind only to IPv4 loopback. Images are fixed baseline versions, not a claim of current security; review advisories and compatibility before upgrading or exposing anything.

## Start from repository root

Set a unique Grafana password in the current shell, without committing it. Example PowerShell prompt (the environment value remains readable to local privileged processes):

```powershell
$credential = Get-Credential -UserName admin -Message 'Choose local Grafana admin password'
$env:GRAFANA_ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
docker compose -f docker-compose.monitoring.yml config --quiet
docker compose -f docker-compose.monitoring.yml up -d
docker compose -f docker-compose.monitoring.yml ps
```

Bash alternative:

```bash
read -rsp 'Grafana admin password: ' GRAFANA_ADMIN_PASSWORD; echo
export GRAFANA_ADMIN_PASSWORD
docker compose -f docker-compose.monitoring.yml config --quiet
docker compose -f docker-compose.monitoring.yml up -d
```

Do not share rendered Compose configuration or docker inspect output: these can expose the password. Set the environment variable again in a new shell before Compose commands. Grafana uses this password for INITIAL database setup only; change an existing account password inside Grafana.

## Verify

- Open http://127.0.0.1:9090/targets and verify prometheus and cadvisor are UP.
- Open http://127.0.0.1:3001 and sign in as admin with your chosen password.
- Open Dashboards > CineHunt > CineHunt - Local Docker Containers.
- Wait 2-3 minutes for rate calculations, exercise the application, and verify backend/web/AI/SQL container series where those containers actually run on this Docker engine.
- CPU is percent of one CPU core and can exceed 100%; memory is working set; network is bytes/second. The UP panel checks scrape availability, NOT application health.
- If SQL Server runs outside Docker, cAdvisor does not monitor it as a container. No shared application network is required: Prometheus only contacts cAdvisor on the monitoring network.

Troubleshooting:

```sh
docker compose -f docker-compose.monitoring.yml logs --tail=100 prometheus cadvisor grafana
```

If cAdvisor is UP but panels are empty, query container_memory_working_set_bytes in Prometheus. Check whether name/image labels exist and whether application containers are visible. Do not weaken Docker security settings blindly to make charts appear. Record Docker Desktop limitations if metrics remain unavailable.

Stop without deleting data:

```sh
docker compose -f docker-compose.monitoring.yml down
```

Do not add -v unless intentionally deleting monitoring history and Grafana settings. Capture Targets UP, a dashboard with real data and time range, and monitoring container status. This configuration has not been runtime-tested on your machine.
