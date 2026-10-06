<!-- @file docs/README.md -->
<!-- @brief Documentation reading paths and release scope. -->

# Documentation

The platform separates **authoring files**, **runtime data**, and **presentation**.
These guides describe that separation rather than treating the project as a
static-site generator.

## Choose a path

| Goal | Read |
|---|---|
| Deliver a Node release | [Node deployment and CI/CD](BETA_DEPLOYMENT.md), [0.7.0 preparation](RELEASE_0.7.0.md) |
| Run the project | [Development](DEVELOPMENT.md), [Troubleshooting](TROUBLESHOOTING.md) |
| Write and publish | [Authoring](AUTHORING.md), [Admin & themes](ADMIN_AND_THEMES.md) |
| Build an API client | [API](API.md), [Threat model](THREAT_MODEL.md) |
| Change implementation | [Architecture](ARCHITECTURE.md), [Testing](TESTING.md), [Contributing](../CONTRIBUTING.md) |
| Deploy or recover data | [Operations](OPERATIONS.md), [Security policy](../SECURITY.md) |
| Check the release review | [Review and validation](REVIEW.md) |

## Version and scope

Documentation targets **0.7.0**, with linked-post previews, fuzzy editor completion,
multi-tag archive filters, safe media maintenance and stable release gates.
The unified Node runtime and Vercel/private-R2 target retain their documented
operational differences. Version bumps do not publish packages, tags,
releases, or a hosted service automatically.

Revision tables are groundwork, not a revision product. Public moderated comments
and anonymous likes are available. No email subscriptions, newsletter jobs, multi-user collaboration, or automatic
revision history is promised by this documentation. Schema presence alone is
not evidence of a working user-facing feature. [TODO.md](../TODO.md) owns the
roadmap; source and committed migrations own exact implementation details.

Examples use reserved domains and placeholder values. Never paste production
passwords, cookies, private drafts, connection strings, or backups into issues.
