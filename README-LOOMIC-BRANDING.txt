LOOMIC BRANDING PATCH FOR SOCIALFLOW FINAL12
==============================================

PURPOSE
-------
This patch changes the user-facing product/brand name from SocialFlow to Loomic only.
It does NOT rename internal code identifiers, database tables, Prisma models, package names,
launcher filenames, environment variables, tokens, uploads, scheduler logic, publishing logic,
or analytics behavior.

FILES CHANGED
-------------
24 source files.

HOW TO APPLY
------------
1. Stop SocialFlow/Loomic if it is running.
2. Back up D:\Insta\Final12.
3. Extract this ZIP directly into D:\Insta\Final12.
4. Choose "Replace the files in the destination" when Windows asks.
5. No Prisma command is required.
6. No Supabase migration is required.
7. Do not change your .env, database URLs, TOKEN_ENCRYPTION_KEY, Instagram tokens, or Supabase data.
8. Start the app the same way you do now. In PowerShell, the existing launcher remains:

   .\RUN-SOCIALFLOW.bat

   The launcher filename stays unchanged intentionally to avoid changing working deployment logic.

WHAT CHANGES VISIBLY
--------------------
- Main logo/name: Loomic
- Browser/page metadata: Loomic
- Login/register/recovery text: Loomic
- Landing-page branding: Loomic
- Accounts/Settings/Composer user-facing help text: Loomic
- SocialFlow Intelligence -> Loomic Intelligence
- SocialFlow AI -> Loomic AI
- Insights Report branding -> Loomic
- Email subjects/body branding -> Loomic
- User-facing API/error messages -> Loomic

WHAT IS INTENTIONALLY NOT RENAMED
---------------------------------
- useSocialFlow and other internal TypeScript identifiers
- package name "socialflow"
- RUN-SOCIALFLOW.bat / START-SOCIALFLOW*.bat
- internal storage keys/cookies or environment variable names
- Prisma/Supabase table/model names
- connected Instagram account data and tokens

This is a branding-only patch.
