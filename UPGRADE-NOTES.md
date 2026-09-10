# SocialFlow — Buffer-style production upgrade notes

This package is an upgraded version of the supplied SocialFlow project. The goal was to turn the original browser/demo-oriented implementation into a deployable social publishing workspace with honest capability boundaries.

## Major changes

- Replaced browser-dependent scheduled publishing with authenticated server scheduler jobs.
- Added server-side publish-now and persisted per-target publish results/errors.
- Added real multi-workspace selection and workspace authorization checks.
- Added team invitations, roles, approvals and member-management safeguards.
- Added password reset, session revocation/rotation, auth rate limits and Secure/HttpOnly refresh cookies.
- Added AES-GCM encryption for stored provider OAuth tokens.
- Added live OAuth/publishing adapters for Instagram, Facebook Pages, Threads, LinkedIn members, X and Pinterest, within each provider format supported by this build.
- Added per-account copy overrides in the composer so one master post can be tailored for individual channels.
- Replaced temporary browser media URLs with authenticated persistent uploads; JPG/PNG/WebP are normalized to JPEG and MP4 is retained for video.
- Rewired composer/AI Studio controls to server AI endpoints instead of browser-only simulated output.
- Removed demo/fabricated marketing counts, testimonials, subscription success and fake paid-plan defaults.
- Added PostgreSQL production schema, Docker Compose, Caddy HTTPS, scheduler container, health checks and persistent database/upload volumes.
- Added provider, production deployment and live feature-status documentation.

## Important live-launch requirements

Social network developer apps and credentials are not bundled in this ZIP. Each provider must be configured in its own developer console, required permissions/app review must be granted where applicable, and live publishing must be acceptance-tested with your real accounts before customer onboarding.

Billing/payment processing is intentionally not faked. Add a real payment provider before enabling subscriptions. Cross-network analytics beyond Instagram, X media, LinkedIn organization/video/document publishing, Facebook video/multi-image publishing, richer Pinterest board selection, inbox/DM workflows, distributed queues and object storage remain extension work if you need full parity with every Buffer product area.

## Verification performed in this workspace

Static TypeScript/TSX syntax parsing, internal import resolution, Prisma schema structure, Docker Compose YAML parsing, scheduler shell syntax and package JSON validation were run against the upgraded source. A full Next.js production build could not be executed in this sandbox because project dependencies are not installed and the sandbox npm registry configuration/network is unavailable; Docker is also not installed here. Run the documented Docker build and live acceptance checklist on the target server before launch.
