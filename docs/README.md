<!-- @file docs/README.md -->
<!-- @brief Documentation reading paths and release scope. -->

# Documentation

**Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine**

BenchCore publishes linked engineering notes through a public reading site and
an administrator workbench. Start with the [project README](../README.md).
These guides describe implementation and operator procedures; a documented
procedure is not evidence that it passed on a deployed host.
[Testing](TESTING.md) separates checks; [TODO.md](../TODO.md) owns the roadmap.

## Choose a path

| Goal                                        | Read                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Deliver a Node release                      | [Node deployment and CI/CD](BETA_DEPLOYMENT.md), [0.8.0 preparation](RELEASE_0.8.0.md)     |
| Configure two-factor authentication         | [0.8.0 setup and recovery](RELEASE_0.8.0.md)                                               |
| Run the project                             | [Development](DEVELOPMENT.md), [Troubleshooting](TROUBLESHOOTING.md)                       |
| Configure services                          | [Environment reference](DEVELOPMENT.md#environment), [Vercel and R2](VERCEL_DEPLOYMENT.md) |
| Check runtime differences and staging gates | [Runtime parity and abuse boundary](RUNTIME_PARITY.md)                                     |
| Write and publish                           | [Authoring](AUTHORING.md), [Admin & themes](ADMIN_AND_THEMES.md)                           |
| Manage categories or opt-in email           | [Newsletter and categories](NEWSLETTER.md)                                                 |
| Build an API client                         | [API](API.md), [Threat model](THREAT_MODEL.md)                                             |
| Maintain the OpenAPI contract               | [Contract maintenance](API_CONTRACT.md), [OpenAPI JSON](openapi.json)                      |
| Change implementation                       | [Architecture](ARCHITECTURE.md), [Testing](TESTING.md), [Contributing](../CONTRIBUTING.md) |
| Customize CSS and components                | [CSS customization](CSS_CUSTOMIZATION.md)                                                  |
| Deploy or recover data                      | [Operations](OPERATIONS.md), [Security policy](../SECURITY.md)                             |
| Export or restore a complete private backup | [Backup CLI and recovery drill](BACKUP.md)                                                 |
| Check the release review                    | [Review and validation](REVIEW.md)                                                         |

## Version and scope

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
