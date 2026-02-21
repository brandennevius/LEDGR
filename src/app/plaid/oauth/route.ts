const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.search;
  const deepLink = `financialcoaching://plaid/oauth${query}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Return to LEDGR</title>
    <meta http-equiv="refresh" content="0; url=${escapeHtml(deepLink)}" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #0b0f1e; color: #f8fafc; display:flex; min-height:100vh; align-items:center; justify-content:center; }
      main { max-width: 520px; padding: 24px; text-align: center; }
      a { color: #38bdf8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Returning to LEDGR…</h1>
      <p>If the app does not open automatically, <a href="${escapeHtml(deepLink)}">tap here</a>.</p>
    </main>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
