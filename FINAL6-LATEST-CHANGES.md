# Final6 latest changes

This build keeps the working SocialFlow scheduler/account connection flow and includes the latest Instagram composer updates.

## Included

- Instagram post type controls: Auto, Feed, Reel, Story and Carousel.
- Multiple media upload and Instagram image aspect-ratio validation.
- Reel "Share to feed" setting.
- Instagram finishing tools for music notes, location, tagged people, collaborators, first comment and effects/sticker notes.
- Geoapify-powered live location suggestions.
- Selected location is added to the Instagram caption as a visible `📍 Location` fallback because the Instagram Login publishing API does not expose the native Instagram location-header picker.
- Hashtags already written in the caption are no longer appended a second time.
- Scheduler worker and public-media URL rebasing remain enabled for scheduled posts.
- Hydration warning suppression on the root body remains included.

## Larger Reel/video uploads

- MP4 and MOV uploads are accepted.
- Default Reel/video upload limit is `1024 MB` (1 GB), matching Meta's documented maximum Reel file size.
- Large videos are sent as a raw request body and streamed to disk on the SocialFlow server instead of being copied into an extra application Buffer.
- Image upload limit remains 25 MB by default.

Environment settings:

```env
MAX_UPLOAD_MB=25
MAX_VIDEO_UPLOAD_MB=1024
```

You can lower `MAX_VIDEO_UPLOAD_MB` if the server has storage or proxy limits. Values above 1024 MB are capped at 1024 MB by the application.

## Run

```bat
npm install
RUN-SOCIALFLOW.bat
```

Keep the launcher/server running for local scheduled publishing.

## Instagram Reel processing fix (Aug 24)

- Fixed `Media ID is not available` caused by calling `/media_publish` before a Reel container had finished processing.
- Reel/video containers now remain in Publishing while Meta processes them and wait up to 5 minutes for `FINISHED`.
- Transient media-not-ready publish responses are retried automatically.
- Queue receives the real Meta API error when processing fails.
- Public-media validation warns when an Instagram post still points to localhost.
