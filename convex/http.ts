import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/verify-email",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(errorPage("Invalid verification link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const user = await ctx.runQuery(internal.emailVerification.getUserByToken, {
      token,
    });

    if (!user) {
      return new Response(
        errorPage(
          "This verification link is invalid or has already been used.",
        ),
        { status: 400, headers: { "Content-Type": "text/html" } },
      );
    }

    if (user.emailVerified) {
      return new Response(successPage("Your email is already verified!"), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    await ctx.runMutation(internal.emailVerification.markEmailVerified, {
      userId: user._id,
    });

    return new Response(
      successPage(
        "Your email has been verified! You can close this tab and return to GhostWriter.",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }),
});

function successPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Email Verified — GhostWriter</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf9f6; color: #1a1a1a; }
    .card { text-align: center; max-width: 420px; padding: 48px 32px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px; }
    p { font-size: 14px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>You're verified!</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verification Error — GhostWriter</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf9f6; color: #1a1a1a; }
    .card { text-align: center; max-width: 420px; padding: 48px 32px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px; }
    p { font-size: 14px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Something went wrong</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export default http;
