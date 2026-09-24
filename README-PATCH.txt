Loomic - Mobile QR Finish in Instagram Patch

This patch assumes the previous Finish in Instagram/handoff patch is already applied.

Changes:
- Finish in Instagram no longer opens the raw Supabase media URL immediately.
- Desktop opens a Loomic modal with QR code, Link/@Mention details, and media access.
- QR opens /instagram-handoff on the phone.
- Mobile handoff page previews media, lets the user copy Link/@Mention, and offers Open Instagram.
- Normal automatic Story publishing remains unchanged.
- No Prisma migration.

Important Instagram limitation:
The final native Link/@Mention sticker must still be added inside Instagram. A web app cannot inject those native Story stickers automatically.

Apply:
1. Copy the CONTENTS of this patch into D:\Loomic_for_Sejal and replace matching files.
2. Run: npm.cmd install
3. Run: npx.cmd prisma generate
4. Run: npm.cmd run build
5. If successful: npm.cmd run dev
6. Test on desktop AND scan the QR using a phone that can reach the Loomic URL.
7. Do not commit/push until testing succeeds.

Note for localhost:
A QR generated while Loomic is at http://localhost:3000 points to localhost, which means the PHONE itself. It will not reach your PC. For phone testing, open Loomic through your public/Vercel URL or a reachable LAN/public development URL.
