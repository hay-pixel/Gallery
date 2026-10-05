# AWS deployment implementation plan

No application infrastructure has been provisioned. Selected Region: `ap-southeast-2`; developer profile: `ollamabinsaden`.

1. Verify project paid/free plan, supported services, spend limit, and workload sizing.
2. Describe infrastructure as code; select an EC2/Linux baseline where persistent local workers, SQLite, model caches, or tmux require it.
3. Assign a least-privilege service role; use OIDC for CI rather than stored developer login credentials.
4. Separate service/configuration/storage ownership; bind private workers and Ollama privately and expose only authenticated intended application APIs.
5. Configure durable EBS/state backups, optional S3 transfers, logs/metrics, health checks, restarts, and recovery procedures.
6. Deploy reviewed artifacts and verify product-specific real-data/live-agent acceptance before marking a release complete.

See the root README for product-specific scope, proposed resources, and acceptance milestones. Historical Azure addresses, paths, and host assumptions are not the current target.
