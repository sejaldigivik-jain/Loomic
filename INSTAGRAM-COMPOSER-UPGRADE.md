# Instagram Composer Upgrade

This build expands SocialFlow's Instagram composer while keeping the current Instagram API with Instagram Login connection method.

## Working publishing controls

- Auto detect: single image -> Feed, single video -> Reel, 2-10 media -> Carousel
- Feed photo
- Reel
- Story
- Carousel (2-10 images/videos)
- Reel: Share to Feed toggle
- Multiple file selection/upload for carousel creation
- Instagram image aspect-ratio validation before upload (for feed/carousel flows)
- Media-only Instagram posts (caption can be blank)
- Accessibility/alt text saved on the SocialFlow media record
- Multiple Instagram accounts and scheduled publishing continue to work

## Instagram-native controls shown but intentionally disabled

The composer displays these so users can see why they are unavailable instead of getting a fake control:

- Instagram licensed songs/music library
- Location picker
- Tag people
- Invite collaborators
- First/root comment
- Filters, effects and stickers

The current Instagram API with Instagram Login does not expose the native music library and explicitly does not provide tagging access. Meta's current comment-management API documents comment reading/moderation/replies rather than creating a new root first comment.

## Important

Uploaded media still needs a publicly reachable URL at publish time. Continue starting local testing with `RUN-SOCIALFLOW.bat` / the existing public-tunnel launcher so Meta can fetch scheduled media.

For permanent production scheduling, deploy SocialFlow and media storage to stable HTTPS URLs.
