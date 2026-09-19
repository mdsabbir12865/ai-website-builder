import {
  VERCEL_INTEGRATION_CLIENT_ID,
  VERCEL_INTEGRATION_CLIENT_SECRET,
  VERCEL_INTEGRATION_REDIRECT_URI,
  clearCookie,
  encryptToken,
  getAdminSupabase,
  isSafeVercelNextUrl,
  parseCookies,
  readVercelResponse,
  resolveReturnTo,
  validateOAuthRequest,
  vercelApi,
} from "./_utils.js";

function redirect(res, path, key, value) {
  const separator = path.includes("?") ? "&" : "?";
  return res.redirect(
    `${path}${separator}${key}=${encodeURIComponent(value)}`
  );
}

function redirectError(res, returnTo, message) {
  clearCookie(res, "vercel_oauth_state");
  return redirect(res, resolveReturnTo(returnTo), "vercel_error", message);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const {
    code,
    state,
    error,
    error_description: description,
    configurationId,
    teamId,
    next,
  } = req.query;

  const fallback = "/dashboard";

  if (error) {
    return redirect(
      res,
      fallback,
      "vercel_error",
      typeof description === "string" ? description : String(error)
    );
  }

  if (
    !code ||
    typeof code !== "string" ||
    !state ||
    typeof state !== "string"
  ) {
    return redirectError(
      res,
      fallback,
      "Missing Vercel authorization details. Please try connecting again."
    );
  }

  const validation = validateOAuthRequest(state, req);
  if (!validation.valid || !validation.payload) {
    const message =
      validation.code === "OAUTH_STATE_COOKIE_MISMATCH"
        ? "Vercel connection could not be verified in this browser. Please try Connect Vercel again."
        : "Invalid or expired OAuth state. Please try Connect Vercel again.";

    console.error("Vercel OAuth state rejected", {
      code: validation.code,
      cookiePresent: Boolean(parseCookies(req).vercel_oauth_state),
    });

    return redirectError(res, fallback, message);
  }

  const { payload } = validation;
  const returnTo = resolveReturnTo(payload.returnTo, fallback);

  try {
    if (!VERCEL_INTEGRATION_CLIENT_ID || !VERCEL_INTEGRATION_CLIENT_SECRET) {
      throw new Error("Vercel integration is not configured.");
    }

    const tokenResponse = await fetch(
      "https://api.vercel.com/v2/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: VERCEL_INTEGRATION_CLIENT_ID,
          client_secret: VERCEL_INTEGRATION_CLIENT_SECRET,
          code,
          redirect_uri: VERCEL_INTEGRATION_REDIRECT_URI,
        }).toString(),
      }
    );

    const tokenData = await readVercelResponse(tokenResponse);

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return redirectError(
        res,
        returnTo,
        "Vercel authorization failed. Please try again."
      );
    }

    const accessToken = tokenData.access_token;
    const resolvedTeamId =
      (typeof teamId === "string" && teamId) ||
      tokenData.team_id ||
      null;
    const configuration =
      (typeof configurationId === "string" && configurationId) ||
      tokenData.installation_id ||
      null;

    let vercelUserId = tokenData.user_id || null;
    let vercelUsername = null;
    let vercelAvatar = null;

    try {
      const { response: userResponse, body: userBody } = await vercelApi(
        accessToken,
        "/v2/user",
        { teamId: resolvedTeamId || undefined }
      );
      if (userResponse.ok && userBody?.user) {
        vercelUserId = userBody.user.id || vercelUserId;
        vercelUsername =
          userBody.user.username || userBody.user.name || null;
        vercelAvatar = userBody.user.avatar || null;
      }
    } catch {
      // Identity enrichment is optional; connection still succeeds.
    }

    clearCookie(res, "vercel_oauth_state");

    const { error: dbError } = await getAdminSupabase()
      .from("vercel_connections")
      .upsert(
        {
          user_id: payload.userId,
          access_token: encryptToken(accessToken),
          configuration_id: configuration,
          vercel_user_id: vercelUserId,
          vercel_username: vercelUsername,
          vercel_avatar_url: vercelAvatar,
          team_id: resolvedTeamId,
          scopes: Array.isArray(tokenData.scopes)
            ? tokenData.scopes.join(",")
            : typeof tokenData.scope === "string"
              ? tokenData.scope
              : null,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) throw dbError;

    // Prefer returning the user to Builder (GitHub-style). If Vercel provided
    // a completion URL and no Builder return path, finish on Vercel.
    if (
      !isSafeBuilderReturnToLike(returnTo) &&
      typeof next === "string" &&
      isSafeVercelNextUrl(next)
    ) {
      return res.redirect(next);
    }

    return redirect(res, returnTo, "vercel_connected", "1");
  } catch (error) {
    console.error("Vercel callback failed", error?.message);
    return redirectError(
      res,
      returnTo,
      "Vercel connection failed. Please try again."
    );
  }
}

function isSafeBuilderReturnToLike(value) {
  return typeof value === "string" && value.startsWith("/builder/");
}
