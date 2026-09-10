# SocialFlow Final11 — Connected Accounts as Clients

This patch changes the agency workflow so a connected Instagram/social account is the Client. There is no separate Client-management UI.

## Owner workflow

1. Connect the real Instagram/social accounts normally from **Accounts**.
2. Open **Team**.
3. Click **Create member**.
4. Enter Name, Login Email, Temporary Password and Role.
5. Tick any number of connected accounts/clients.
6. Save. The member can log in immediately with that email/password.
7. Later use the member `...` menu → **Assign clients** to change assignments.

The Owner can see all accounts, posts, Queue, Calendar, Composer, Dashboard and Analytics and can filter the application by **Team Member → Client → Platform**.

## Team member scope

Team members share the same agency workspace/database; they do not get duplicate Instagram connections or a separate database. Their login is server-side restricted to the connected accounts assigned to them. Account, post, publish, Queue/Calendar data and analytics requests use the same account assignment scope.

## Install

1. Stop SocialFlow.
2. Extract this ZIP directly into the main Final11 folder.
3. Choose **Replace files in destination**.
4. Run `APPLY-ACCOUNT-CLIENT-WORKSPACE-PATCH.bat`.
5. After `PATCH APPLIED SUCCESSFULLY`, run `RUN-SOCIALFLOW.bat`.

Do **not** run `prisma migrate reset`.

## Data safety

The migration adds only the `AccountAssignment` relation. The previous `Client` tables/columns are left in the database for migration/backward compatibility but are no longer used by the working agency UI/access logic. The installer removes only obsolete source routes/components for that old separate Client UI. It does not delete database tables or rows.
