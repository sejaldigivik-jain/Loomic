export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!res.ok) {
    console.error("[email] transactional send failed", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}
