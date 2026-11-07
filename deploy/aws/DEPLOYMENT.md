# Gallery AWS Deployment Guide (`ap-southeast-2`)

This document defines the deployment architecture and operations for **Gallery with Ollama** in Amazon Web Services.

- **AWS Project Profile:** `ollamabinsaden`
- **Selected Region:** `ap-southeast-2` (Sydney)
- **Host Target:** Single EC2 instance (Ubuntu 24.04 LTS or Amazon Linux 2023) with dedicated EBS volume for model weights and catalogue state.

---

## 1. Security & Network Boundary

```
+--------------------------------------------------------------------------+
| AWS EC2 Instance (ap-southeast-2)                                         |
|                                                                          |
|  [Public Internet]                                                       |
|         │                                                                |
|         ▼ Ports 80 / 443                                                 |
|  ┌──────────────┐                                                        |
|  │ Caddy / Nginx│ (SSL termination, rate limiting, static asset cache)  |
|  └──────┬───────┘                                                        |
|         │ proxy http://127.0.0.1:3000                                    |
|         ▼                                                                |
|  ┌─────────────────────────┐                                             |
|  │ Node.js Server (Port 3000)│ (tRPC, Session auth, Drive OAuth)          |
|  └──────────┬──────────────┘                                             |
|             │ localhost HTTP                                             |
|             ▼                                                            |
|  ┌─────────────────────────────┐                                         |
|  │ Python AI Gateway (Port 8000)│ (Analysis, Visual Search, Ingestion)   |
|  └──────────┬──────────────────┘                                         |
|             │ localhost HTTP                                             |
|             ▼                                                            |
|  ┌─────────────────────────────┐                                         |
|  │ Private Ollama (Port 11434)  │ (Bounded reasoning, llama3.2)          |
|  └─────────────────────────────┘                                         |
+--------------------------------------------------------------------------+
```

### Security Group Inbound Rules:
- **Port 443 (HTTPS):** `0.0.0.0/0` (Public web clients)
- **Port 80 (HTTP):** `0.0.0.0/0` (Redirect to HTTPS)
- **Port 22 (SSH):** Restricted to authorized administrative IPs or AWS Systems Manager (SSM) Session Manager.
- **Ports 3000, 8000, 11434:** **NEVER EXPOSED** in the Security Group. Bound strictly to `127.0.0.1`.

---

## 2. Storage & EBS Volume Mount

All mutable and durable application state resides on an attached EBS volume mounted at `/var/lib/gallery`:
- `/var/lib/gallery/analysis`: Immutable AnalysisService results and preferred current pointers.
- `/var/lib/gallery/search.sqlite3`: VisualFeature vector embeddings and SQLite index.
- `/var/lib/gallery/ollama/models`: Ollama model weights (`llama3.2:3b`, `nomic-embed-text:v1.5`).
- `/var/lib/gallery/uploads`: Temporary upload staging.

### EBS Setup Command:
```bash
sudo bash deploy/aws/mount-ebs.sh /dev/nvme1n1
```

---

## 3. Systemd Services Setup

Three systemd services manage the full stack:

1. **`ollama.service`** (Private Ollama Daemon):
   ```bash
   sudo cp deploy/aws/ollama.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now ollama
   ```
   Pull required models:
   ```bash
   ollama pull llama3.2:3b
   ollama pull nomic-embed-text:v1.5
   ```

2. **`gallery-ai.service`** (Python AI Gateway Daemon on `127.0.0.1:8000`):
   ```bash
   sudo cp deploy/aws/gallery-ai.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now gallery-ai
   ```

3. **`gallery-web.service`** (Node.js API & Web Server on `127.0.0.1:3000`):
   Configure `/etc/gallery/gallery-web.env`:
   ```bash
   sudo mkdir -p /etc/gallery
   sudo tee /etc/gallery/gallery-web.env << 'EOF'
   DATABASE_URL="mysql://gallery:<PASSWORD>@127.0.0.1:3306/gallery"
   JWT_SECRET="<SECURE_RANDOM_SECRET>"
   GOOGLE_DRIVE_OAUTH_CLIENT_ID="<GOOGLE_CLIENT_ID>"
   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="<GOOGLE_CLIENT_SECRET>"
   AI_GATEWAY_URL="http://127.0.0.1:8000"
   EXPO_PUBLIC_API_BASE_URL="https://gallery.yourdomain.com"
   EXPO_PUBLIC_GALLERY_RETURN_ORIGIN="https://gallery.yourdomain.com"
   EOF
   sudo chmod 600 /etc/gallery/gallery-web.env

   sudo cp deploy/aws/gallery-web.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now gallery-web
   ```

---

## 4. Ingestion Workflows

### A. Scanning Local Directories
```bash
# Ingest and automatically extract visual features
python3 -m services.ingest scan /path/to/media/folder --source-id local_archive
```

### B. Importing Extract Export Manifests
```bash
# Idempotently import canonical records from Extract
python3 -m services.ingest import-extract /path/to/extract_export --source-id extract_source_1
```

### C. Trigger Ingestion via tRPC
Authenticated API callers can invoke:
- `trpc.catalogue.importFolder.mutate({ path: "/path/to/folder", sourceId: "local_1" })`
- `trpc.catalogue.importExtract.mutate({ path: "/path/to/extract", sourceId: "extract_1" })`

---

## 5. Verification Checklist

1. **Verify AI Gateway Health:**
   ```bash
   curl -s http://127.0.0.1:8000/health | jq .
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "analysis_service": true,
     "search_service": true,
     "ingest_service": true,
     "ollama": {
       "reachable": true,
       "status": "available"
     }
   }
   ```

2. **Verify Node.js tRPC Endpoint:**
   ```bash
   curl -s http://127.0.0.1:3000/api/trpc/ai.health
   ```

3. **Verify Offline Degradation:**
   Stop Ollama:
   ```bash
   sudo systemctl stop ollama
   ```
   Query health:
   - Web application continues browsing and deterministic search normally.
   - Ask AI returns informative notification: *"AI reasoning service is currently unavailable; displaying direct catalogue matches."*
   Restart Ollama:
   ```bash
   sudo systemctl start ollama
   ```
