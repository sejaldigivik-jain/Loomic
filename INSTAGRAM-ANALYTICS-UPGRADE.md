# SocialFlow — Real Instagram Analytics + Intelligence Upgrade

This patch adds the three requested analytics levels for connected Instagram **Professional (Business or Creator)** accounts.

## 1. Account Analytics

- Current follower total
- Follower growth tracking
- Reach
- Views
- Profile activity / profile views
- Accounts engaged
- Total interactions
- Engagement rate
- Content published in the selected period
- 7 / 30 / 90 day filters
- Previous-period comparisons
- Account-level daily performance chart
- Multi-client/account scoping through the existing SocialFlow header filters

## 2. Content Analytics

SocialFlow now syncs recent media owned by the connected Instagram professional account — not only posts that were originally published from SocialFlow.

For Reels / Posts / Carousels it stores and ranks available Instagram metrics such as:

- Reach
- Views
- Likes
- Comments
- Shares
- Saves
- Total interactions
- Engagement rate
- Reel watch-time metrics when Meta returns them
- Performance ranking
- Direct permalink to the Instagram content

## 3. SocialFlow Intelligence

This layer is calculated locally from the real Instagram metrics. It does not require OpenAI or any paid AI API.

- Best day to post
- Best time window to post
- Best content format
- Top-performing caption/content theme
- Weak-performing theme
- Follower growth trend
- Local content recommendations
- Format performance chart

The existing Team Member → Client/account → Platform filters remain respected server-side.

## Data source

The source is Meta's Instagram Insights API. The OAuth scope now requests:

`instagram_business_manage_insights`

in addition to the existing Instagram basic and publishing permissions.

## Existing connected Instagram accounts

A token that was granted before this patch does not automatically receive a newly requested permission. If Analytics reports that Insights permission is missing:

1. Open **Accounts**.
2. Use the existing account-connection password/unlock flow.
3. Reconnect the same Instagram professional account once.
4. Approve the new Insights permission in Instagram.
5. Return to **Analytics** and click **Sync Instagram**.

The OAuth callback uses an upsert for the same workspace + Instagram handle, so reconnecting the same account updates its token rather than intentionally creating a second client record.

## Install

1. Stop SocialFlow.
2. Extract this ZIP directly over your existing `D:\Insta\Final11` project.
3. Choose **Replace files in destination**.
4. Run `APPLY-INSTAGRAM-ANALYTICS-UPGRADE.bat`.
5. Start SocialFlow normally.
6. Open **Analytics**.
7. Use the header filters, for example:
   - Client: Knock Out
   - Platform: Instagram
   - Range: Last 30 days
8. Click **Sync Instagram**.

## Important safety notes

- Do **not** run `prisma migrate reset`.
- This migration creates two new analytics tables only.
- It does not delete or overwrite existing posts, connected accounts, access tokens, uploads, team assignments, account-connection lock data, or Local Assist settings.
- No `.env`, SQLite database, upload files, access tokens or secrets are included in this patch.

## Meta limitations to expect

- Instagram Insights are for Professional Business/Creator accounts.
- Some account insight metrics can be unavailable for accounts with fewer than 100 followers.
- A metric can be temporarily empty when Meta has not produced that insight yet.
- Account-level user insight history available through the API is time-limited, so SocialFlow also keeps its own daily snapshots from the point you start syncing.
- If SocialFlow is eventually offered to Instagram professional accounts that you do not own/manage, the Meta app will need the appropriate Advanced Access/App Review for Insights.

## Background sync

The existing `/api/v1/jobs/sync-analytics` job now uses the upgraded analytics service, so scheduled background sync can continue using your existing `CRON_SECRET` setup.
