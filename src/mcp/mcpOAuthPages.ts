function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHiddenFields(fields: Record<string, string | undefined>) {
  return Object.entries(fields)
    .filter(([, value]) => typeof value === "string")
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(
          value || "",
        )}">`,
    )
    .join("");
}

function renderPageShell(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: linear-gradient(180deg, #f7f8fc 0%, #eef1f7 100%);
        color: #111827;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      main {
        width: min(100%, 560px);
        background: white;
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
        padding: 28px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.65rem;
      }
      p,
      li,
      label {
        line-height: 1.5;
      }
      .error {
        margin: 16px 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
      }
      .card {
        margin: 18px 0;
        padding: 16px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
      }
      form {
        display: grid;
        gap: 12px;
      }
      label {
        display: grid;
        gap: 6px;
        font-weight: 600;
      }
      input {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 12px;
        font: inherit;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .primary {
        background: #111827;
        color: white;
      }
      .secondary {
        background: #e5e7eb;
        color: #111827;
      }
      code {
        background: #f3f4f6;
        border-radius: 6px;
        padding: 2px 6px;
      }
      ul {
        padding-left: 18px;
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

export function renderOAuthErrorPage(input: {
  title: string;
  message: string;
  hint?: string;
}) {
  return renderPageShell(
    input.title,
    `<h1>${escapeHtml(input.title)}</h1>
     <div class="error">${escapeHtml(input.message)}</div>
     ${
       input.hint
         ? `<p>${escapeHtml(input.hint)}</p>`
         : "<p>Return to the assistant and start the connection flow again.</p>"
     }`,
  );
}

export function renderOAuthLoginPage(input: {
  error?: string;
  formAction: string;
  hiddenFields: Record<string, string | undefined>;
  clientName?: string;
}) {
  const clientCopy = input.clientName
    ? `Sign in to connect <strong>${escapeHtml(input.clientName)}</strong> to your Todos account.`
    : "Sign in to connect your assistant to your Todos account.";
  return renderPageShell(
    "Connect Assistant",
    `<h1>Connect Assistant</h1>
     <p>${clientCopy}</p>
     ${input.error ? `<div class="error">${escapeHtml(input.error)}</div>` : ""}
     <form method="post" action="${escapeHtml(input.formAction)}">
       ${renderHiddenFields(input.hiddenFields)}
       <label>
         Email
         <input type="email" name="email" autocomplete="email" required>
       </label>
       <label>
         Password
         <input type="password" name="password" autocomplete="current-password" required>
       </label>
       <div class="actions">
         <button class="primary" type="submit">Sign In</button>
       </div>
     </form>`,
  );
}

export function renderOAuthRedirectPage(input: { redirectUri: string }) {
  const safe = escapeHtml(input.redirectUri);
  return renderPageShell(
    "Redirecting…",
    `<h1>Authorization complete</h1>
     <p>Redirecting you back to the assistant…</p>
     <p><a class="primary" href="${safe}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:white;text-decoration:none;font-weight:600;">Return to assistant</a></p>
     <meta http-equiv="refresh" content="0; url=${safe}">
     <script>
       try { window.location.replace(${JSON.stringify(input.redirectUri)}); } catch(_){}
     </script>`,
  );
}

export function renderOAuthConsentPage(input: {
  clientName?: string;
  userEmail: string;
  scopes: string[];
  formAction: string;
  hiddenFields: Record<string, string | undefined>;
}) {
  return renderPageShell(
    "Authorize Assistant",
    `<h1>Authorize Assistant</h1>
     <p>${
       input.clientName
         ? `<strong>${escapeHtml(input.clientName)}</strong> wants access to your Todos account.`
         : "An assistant client wants access to your Todos account."
     }</p>
     <div class="card">
       <p><strong>Signed in as:</strong> ${escapeHtml(input.userEmail)}</p>
       <p><strong>Requested scopes:</strong></p>
       <ul>${input.scopes
         .map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`)
         .join("")}</ul>
     </div>
     <form method="post" action="${escapeHtml(input.formAction)}">
       ${renderHiddenFields(input.hiddenFields)}
       <div class="actions">
         <button class="primary" type="submit" name="decision" value="approve">Allow Access</button>
         <button class="secondary" type="submit" name="decision" value="deny">Deny</button>
       </div>
     </form>`,
  );
}
