# SocialFlow Local Assist Upgrade

This patch makes Local Assist the free default AI mode and improves its caption quality without adding any paid service.

## What changes

- Local Assist is the default AI mode.
- SocialFlow does not call OpenAI unless the workspace explicitly selects **OpenAI API** in Settings.
- Existing saved OpenAI keys are preserved, but they are ignored while Local Assist mode is active.
- Adds a clear **Local Assist / OpenAI API** mode selector under Settings → AI Provider.
- Local Assist captions are now context-aware instead of wrapping the original text in generic filler.
- Removes generic defaults such as:
  - `A practical way to move forward:`
  - `Save this for later.`
- Adds context-aware writing for party/nightlife, food, drinks, offers, events, education, business/tech, beauty, travel and general posts.
- Improves local hashtag suggestions with context-specific tags.
- Local Assist notifications now explain that generation happened locally without an external API call.

## Example

Input:

`Let's start the party.`

Local Assist can now return variations such as:

`Let's start the party. 🎉`

`Good vibes, great energy, and a night made for memories.`

`Who’s joining us?`

Instead of:

`A practical way to move forward:`

`Let's start the party.`

`Save this for later.`

## Install

1. Stop SocialFlow.
2. Extract this ZIP directly into your existing `D:\Insta\Final11` folder.
3. Choose **Replace files in destination**.
4. No Prisma migration is required.
5. Start SocialFlow normally using `RUN-SOCIALFLOW.bat`.
6. Open **Settings → AI Provider**.
7. Keep **Local Assist — Free** selected and click **Save AI settings** if you want to persist that choice explicitly.
8. Test **Composer → Generate caption**.

## Existing data safety

This patch does not include or replace:

- `.env`
- SQLite database files
- connected Instagram accounts
- Instagram tokens
- uploads
- posts
- scheduler data
- team/client assignments

No database reset is required.
