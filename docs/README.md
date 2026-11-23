<!-- @file docs/README.md -->
<!-- @brief Documentation reading paths and release scope. -->

# Documentation

[← README](../README.md)

## Documents

| Document | What it covers |
| :--- | :--- |
| [Admin workbench and themes](ADMIN_AND_THEMES.md) | Admin workflows, public media caveats, and presentation conventions. |
| [API reference](API.md) | REST routes, payload examples, security requirements, and error semantics. |
| [Maintain the API contract](API_CONTRACT.md) | OpenAPI ownership, regeneration and compatibility gates. |
| [Architecture](ARCHITECTURE.md) | Layer responsibilities, data flow, persistence, and design decisions. |
| [Authoring and publishing](AUTHORING.md) | Markdown/TOML authoring, import semantics, links, and publishing. |
| [Backup and recovery](BACKUP.md) | Private offline backup format, empty-target recovery and isolated PostgreSQL drill. |
| [BenchCore Node deployment](BETA_DEPLOYMENT.md) | Single-origin Node delivery, installation, account safety and recovery. |
| [Customize the interface](CSS_CUSTOMIZATION.md) | Source-level styling and component customization guide. |
| [Development](DEVELOPMENT.md) | Reproducible local setup, environment configuration, and commands. |
| [Interface language (English and Italian)](I18N.md) | BenchCore renders its interface in English or Italian. |
| [Newsletter and categories](NEWSLETTER.md) | Explicit newsletter consent, deployment and safe manual delivery. |
| [Operations](OPERATIONS.md) | Deployment, migration, backup, recovery, and operational checks. |
| [Preparing 0.7.0](RELEASE_0.7.0.md) | Local 0.7.0 preparation, maintenance safety and separate publication gates. |
| [Preparing 0.8.0](RELEASE_0.8.0.md) | Local 0.8.0 preparation, second-factor recovery and explicit deployment gates. |
| [Preparing 0.9.0](RELEASE_0.9.0.md) | Verified stabilization work and remaining gates before releasing 0.9.0. |
| [Review and validation](REVIEW.md) | Resolved review findings and validation records through the prepared Node beta. |
| [Runtime parity and staging evidence](RUNTIME_PARITY.md) | Explicit deployment differences and the trusted multi-instance abuse-control boundary. |
| [Testing](TESTING.md) | Automated quality gates, regression expectations, and manual smoke tests. |
| [Threat model](THREAT_MODEL.md) | Security assets, trust boundaries, attacker capabilities, and residual risks. |
| [Troubleshooting](TROUBLESHOOTING.md) | Diagnose common local, editorial, security, and deployment failures. |
| [Vercel and private R2](VERCEL_DEPLOYMENT.md) | Full-app Vercel deployment with private R2 storage and disabled scheduled publication. |

## Reading paths

**Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine**

BenchCore publishes linked engineering notes through a public reading site and
an administrator workbench. Start with the [project README](../README.md).
These guides describe implementation and operator procedures; a documented
procedure is not evidence that it passed on a deployed host.
[Testing](TESTING.md) separates checks; [TODO.md](../TODO.md) owns the roadmap.

### Choose a path


### Version and scope

Documentation targets **0.8.0**, with comment anti-spam, administrator TOTP,
global session revocation and security history, alongside knowledge navigation
and safe media maintenance. Public information, a reader guide, privacy and
cookie inventory, localized error recovery and XML discovery complete the
public navigation.
The unified Node runtime and Vercel/private-R2 target retain their documented
operational differences. Version bumps do not publish packages, tags,
releases, or a hosted service automatically.

Revision tables are groundwork, not a revision product. Public moderated comments
and anonymous likes are available. Optional categories and manual double-opt-in
newsletters are implemented; actual SMTP validation and activation remain operator
checks. There is no automatic newsletter job, collaborative editing, or automatic
revision history. All three production entrypoints share newsletter, password
recovery and media dependency wiring. Hosted delivery still needs verification.
Schema presence alone is
not evidence of a working user-facing feature. [TODO.md](../TODO.md) owns the
roadmap; source and committed migrations own exact implementation details.

Examples use reserved domains and placeholder values. Never paste production
passwords, cookies, private drafts, connection strings, or backups into issues.
