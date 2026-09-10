# SocialFlow Localhost / Windows Launcher Fix — August 13, 2026

## Start on Windows

**First extract the complete ZIP. Do not run the `.bat` file while browsing inside the ZIP archive.**

1. Right-click the downloaded ZIP and choose **Extract All...**.
2. Open the extracted `socialflow` project folder.
3. Double-click **START-SOCIALFLOW.bat**.
4. Keep the Command Prompt window open while SocialFlow is running.
5. The launcher will automatically open `http://localhost:3000` after the server starts.

The new launcher intentionally stays open if an error occurs, so you can read the exact problem instead of seeing a window flash and disappear.

## What the launcher checks

- The project has actually been extracted and `package.json` / `src` are present.
- Node.js and npm are available.
- Node.js is new enough for Next.js 16.
- Dependencies are installed; it runs `npm install` on the first launch if necessary.
- Prisma Client is generated.
- The local SQLite schema is synchronized.
- Next.js starts on port 3000.
- Your default browser is opened automatically.

## If the normal launcher still does not work

Double-click **START-SOCIALFLOW-DEBUG.bat**. It prints the project path, Node.js path/version, npm path/version, and then runs the normal launcher without automatically disappearing.

## Repair an existing local copy

Run **FIX-LOCAL-ERRORS.bat**. It now also stays open when repair/start fails and opens the browser after a successful repair.

## Previously fixed application errors

- Removed the duplicated landing-page `#platforms` React key.
- Corrected the local SQLite path.
- Added automatic `.env`, Prisma generation, and database synchronization.
- Improved development API errors for database-not-ready failures.

## Node 24 / `spawnSync npx.cmd EINVAL`

If setup previously stopped at `Prisma generate could not start: spawnSync npx.cmd EINVAL`, use this package. The setup script no longer launches `npx.cmd` from Node; it resolves Prisma's JavaScript CLI and runs it with `process.execPath`, which is compatible with current Windows Node releases.

If you need to recover an already-extracted older folder immediately, run these commands from Command Prompt in the project folder:

```bat
node_modules\.bin\prisma.cmd generate
node_modules\.bin\prisma.cmd db push --skip-generate
node_modules\.bin\next.cmd dev -p 3000
```

Keep that terminal open while using SocialFlow.
