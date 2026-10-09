# AWS deployment implementation plan

No application infrastructure was provisioned by the repository migration or this checkpoint. The user reports an existing AWS Ubuntu backend host; this workspace has not inspected or deployed to it. Selected Region: `ap-southeast-2`; developer profile: `ollamabinsaden`.

1. Verify project paid/free plan, supported services, spend limit, and workload sizing.
2. Describe infrastructure as code; select an EC2/Linux baseline where persistent local workers, SQLite, model caches, or tmux require it.
3. Assign a least-privilege service role; use OIDC for CI rather than stored developer login credentials.
4. Separate service/configuration/storage ownership; bind private workers and Ollama privately and expose only authenticated intended application APIs.
5. Configure durable EBS/state backups, optional S3 transfers, logs/metrics, health checks, restarts, and recovery procedures.
6. Deploy reviewed artifacts and verify product-specific real-data/live-agent acceptance before marking a release complete.

See the root README for product-specific scope, proposed resources, and acceptance milestones. Historical Azure addresses, paths, and host assumptions are not the current target.

## Connect the existing Ubuntu backend

Inspect and reuse the existing host before proposing infrastructure changes. Required inputs
are its reachable API origin, API description/routes, session/authentication mechanism,
service versions, durable storage paths, and access through an authorized executor. No
endpoint, host access, or credentials are configured in this workspace. Do not put them in Git.

- Existing Gallery Node routes are `/api/health`, `/api/trpc`, and the Google Drive routes;
  the catalogue CLI is not an HTTP server. Confirm whether the host runs this Node API,
  exposes another API requiring a server-side adapter, or still needs these routes implemented.
- Configure the client's `EXPO_PUBLIC_API_BASE_URL` to the reachable API origin when the
  compatible routes exist. Expo public variables are bundled at build/start time; rebuild or
  restart the client after changing them. On devices, localhost addresses the device itself.
- Inject server secrets outside Git. Keep the existing JWT_SECRET stable where saved Drive
  tokens depend on it. MySQL remains the current Drive credential store; SQLite catalogue
  metadata and owned blobs are a separate Gallery state boundary.
- Set exact allowed Gallery web origins in `GALLERY_WEB_RETURN_ORIGINS`; use the approved
  HTTPS API callback `/api/google-drive/callback` and the Gallery web `/oauth/drive` return.
  Confirm reverse-proxy URL handling, browser CORS, consent, and device deep-link returns.
- Run catalogue import under a trusted service/operator identity against authorized source
  mounts and durable storage. A client must never select arbitrary owner IDs or host paths.
  Back up catalogue.sqlite and blobs together; preserve source occurrence history and annotations.
- Keep Python workers and Ollama private. Gallery's authenticated backend mediates client
  access; do not expose raw Ollama port 11434 or put model/service credentials in Expo variables.
- Verify unauthorized access rejection, owner isolation, pagination, media bytes, degraded
  browsing, restart persistence, and model provenance using real host data. Local fixture
  tests and a successful build cannot establish those deployed behaviors.

Connecting or deploying to the VM is a subsequent task requiring its actual access and
configuration. This checkpoint authorizes no new resources or deployment.
