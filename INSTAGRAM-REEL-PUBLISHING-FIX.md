# Instagram Reel publishing fix

This build fixes the Reel failure that could surface as **"Media ID is not available"**.

## What changed

- Treats the ID returned from Instagram `/media` as a processing/container ID, not the final post ID.
- Waits for `status_code=FINISHED` before calling `/media_publish`.
- Video/Reel processing can wait up to 5 minutes instead of silently continuing after ~90 seconds.
- A processing timeout now fails with a useful message instead of publishing an unfinished container.
- Known transient `Media ID is not available / not ready` publish responses are retried a few times.
- Real Meta `error_user_msg`, message, code and subcode are surfaced in Queue instead of being hidden behind a generic error.
- Localhost media URLs are rejected with an instruction to start via `RUN-SOCIALFLOW.bat`, because Meta must download the Reel from a public HTTPS URL.
- Queue keeps the post in the existing `publishing` state while Meta is processing the Reel and uses clearer processing wording.

## Important for local Reel publishing

Always run:

```bat
RUN-SOCIALFLOW.bat
```

Keep the SocialFlow server and Cloudflare tunnel open until the Reel is live. For large videos Meta must download the complete file and then transcode/process it, so publishing can take several minutes.
