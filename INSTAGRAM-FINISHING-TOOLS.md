# Instagram finishing tools

The Composer now includes editable fields for:

- Songs / Instagram music reference (song title + artist)
- Location
- Tag people
- Invite collaborators
- First comment copy
- Filters, effects and stickers notes

These values are saved inside the post's `instagramOptions.nativeFinish` metadata, so they survive draft saves, scheduling, and later edits. The Composer also provides **Copy finishing checklist** and **Open Instagram** actions.

## Important API limitation

The project currently uses **Instagram API with Instagram Login**. Meta's current publishing flow can publish feed media, reels, stories and carousels, but it does not expose Instagram's licensed music catalogue, native location picker, tagging/collaborator workflow, creation of a new root first comment, or native filters/effects/stickers. SocialFlow therefore stores these controls as finishing instructions rather than silently pretending they will be applied by the API.

The API-supported fields (post type, Reel share-to-feed, media, caption, scheduling, multi-account publishing) continue to publish normally.
