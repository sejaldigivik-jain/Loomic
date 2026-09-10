# SocialFlow Team Analytics Assigned Clients Fix

## Problem fixed
Team-member Analytics showed only `All clients` because the page dropdown was reading the agency-wide `agencyClients` directory. That directory is not the reliable source for a restricted team-member session.

## New behavior
The Analytics Client dropdown now uses the Instagram accounts that are actually visible to the logged-in user.

For a team member:
- `All assigned clients`
- Client/account A
- Client/account B
- etc.

Only assigned/authorized accounts returned by the existing server-side account API can appear.

Selecting one client filters:
- Account Analytics
- Content Analytics
- SocialFlow Intelligence
- Sync Instagram

The existing custom date range and Performance ranking / Latest to oldest options are preserved.

## Install
This is a UI-only patch.

1. Stop SocialFlow.
2. Extract this ZIP directly into your current SocialFlow folder.
3. Choose **Replace files in destination**.
4. Start SocialFlow normally.

No `.next` deletion is required unless the old UI remains cached.
No `npx prisma generate` is required.
No Prisma migration is required.
