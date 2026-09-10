# Scheduled publishing fix

Scheduled posts are now processed automatically by the SocialFlow server when
started with `RUN-SOCIALFLOW.bat`, `START-SOCIALFLOW-PUBLIC.bat`, or
`START-SOCIALFLOW.bat`.

## What changed

- The local/easy launcher enables an embedded server-side scheduler.
- It checks for due posts every 5 seconds.
- A browser tab does not need to remain open.
- Overdue posts are checked about 1.5 seconds after server startup.
- The production Docker scheduler now checks every 10 seconds instead of every
  60 seconds.

## Requirement

The SocialFlow server itself must be running. For Instagram posts that contain
media while using the local test setup, use `RUN-SOCIALFLOW.bat` so the public
media tunnel remains available when Instagram fetches the image/video.

## Existing scheduled posts

Any post still marked `Scheduled` whose scheduled time has already passed will
be picked up automatically after you start the fixed version. Watch the server
terminal for a line beginning with `[SocialFlow Scheduler]`.

## Temporary tunnel restarts

Scheduled posts that use files from SocialFlow's `/uploads/` folder are now
rebased to the CURRENT `NEXT_PUBLIC_APP_URL` at publish time. This means a post
scheduled before a Cloudflare Quick Tunnel restart will not keep trying to use
the dead old `trycloudflare.com` hostname.
