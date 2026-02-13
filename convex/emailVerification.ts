import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";

// ─── Internal helpers (called from actions) ─────────────────────────

export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const markEmailVerified = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      emailVerified: true,
      verificationToken: undefined,
    });
  },
});

export const regenerateToken = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await ctx.db.patch(userId, { verificationToken: token });
  },
});

export const getUserByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    // Scan users for matching token (small table, fine for now)
    const users = await ctx.db.query("users").collect();
    return users.find((u) => u.verificationToken === token) ?? null;
  },
});

// ─── Actions (side effects — sending emails) ────────────────────────

export const sendVerificationEmail = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(
      internal.emailVerification.getUserByIdInternal,
      {
        userId,
      },
    );

    if (!user) throw new Error("User not found.");
    if (user.emailVerified) return { success: true, alreadyVerified: true };
    if (!user.verificationToken) throw new Error("No verification token.");

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured.");

    const convexUrl = process.env.CONVEX_SITE_URL;
    if (!convexUrl) throw new Error("CONVEX_SITE_URL not configured.");

    const verifyUrl = `${convexUrl}/verify-email?token=${user.verificationToken}`;

    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "GhostWriter <onboarding@resend.dev>",
      to: user.email,
      subject: "Verify your GhostWriter account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0;">Verify your email</h1>
            <p style="font-size: 14px; color: #666; margin-top: 8px;">Click the button below to verify your GhostWriter account.</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; font-size: 14px; font-weight: 500; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Verify account
            </a>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't create a GhostWriter account, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return { success: true, alreadyVerified: false };
  },
});

export const resendVerificationEmail = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(
      internal.emailVerification.getUserByIdInternal,
      {
        userId,
      },
    );

    if (!user) throw new Error("User not found.");
    if (user.emailVerified) return { success: true, alreadyVerified: true };

    // Generate a fresh token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newToken = Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await ctx.runMutation(internal.emailVerification.regenerateToken, {
      userId,
      token: newToken,
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured.");

    const convexUrl = process.env.CONVEX_SITE_URL;
    if (!convexUrl) throw new Error("CONVEX_SITE_URL not configured.");

    const verifyUrl = `${convexUrl}/verify-email?token=${newToken}`;

    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "GhostWriter <onboarding@resend.dev>",
      to: user.email,
      subject: "Verify your GhostWriter account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0;">Verify your email</h1>
            <p style="font-size: 14px; color: #666; margin-top: 8px;">Click the button below to verify your GhostWriter account.</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; font-size: 14px; font-weight: 500; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Verify account
            </a>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't create a GhostWriter account, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return { success: true, alreadyVerified: false };
  },
});
