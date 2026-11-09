# AWS deployment implementation plan

Target environment:
- Selected Region: `ap-southeast-2` (Sydney)
- Developer/project profile: `ollamabinsaden`
- Deployment runbook: [DEPLOYMENT.md](DEPLOYMENT.md)

## Packaged Deployment Artifacts

- [DEPLOYMENT.md](DEPLOYMENT.md): End-to-end operational guide, security group configuration, and verification steps.
- [install-on-ec2.sh](../../install-on-ec2.sh): Automated installation and bootstrap script on the EC2 target instance.
- [deploy-to-ec2.sh](deploy-to-ec2.sh): Linode-to-EC2 bundle deployment trigger script.
- [mount-ebs.sh](mount-ebs.sh): Script to safely format and mount the persistent EBS volume at `/var/lib/gallery` for model weights, analysis store, and SQLite search index.
- [gallery-ai.service](gallery-ai.service): Systemd unit for the private Python AI Gateway (`services/gateway.py`) on `127.0.0.1:8000`.
- [gallery-web.service](gallery-web.service): Systemd unit for the Node.js API server (`dist/index.mjs`) on `127.0.0.1:3000`.
- [ollama.service](ollama.service): Systemd unit for the private Ollama daemon bound strictly to `127.0.0.1:11434`.

See the root [README.md](../../README.md) for product-specific scope and contracts. Historical Azure addresses, paths, and host assumptions are not the current target.
