import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  getAdminSupabase,
  verifyOAuthState,
  encryptToken,
  clearCookie,
} from "./_utils.js";

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res.status(405).send(
      "Method not allowed."
    );
  }

  const {
    code,
    state,
    error,
    error_description,
  } = req.query;

  if (error) {
    return res.redirect(
  `/dashboard?github_error=${encodeURIComponent(
    error_description ||
      error
  )}`
);
  }

  if (!code || !state) {
    return res.status(400).send(
      "Missing GitHub OAuth code or state."
    );
  }

  try {
    const payload =
      verifyOAuthState(state);

    if (!payload?.userId) {
      return res.status(400).send(
        "Invalid or expired OAuth state."
      );
    }

    const tokenResponse =
      await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            client_id:
              GITHUB_CLIENT_ID,
            client_secret:
              GITHUB_CLIENT_SECRET,
            code,
            redirect_uri:
              GITHUB_REDIRECT_URI,
          }),
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "GitHub token exchange failed:",
        tokenData
      );
return res.redirect(
  `/dashboard?github_error=${encodeURIComponent(
          "GitHub authorization failed."
        )}`
      );
    }

    const accessToken =
      tokenData.access_token;

    const githubResponse =
      await fetch(
        "https://api.github.com/user",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            Accept:
              "application/vnd.github+json",
            "X-GitHub-Api-Version":
              "2022-11-28",
          },
        }
      );

    if (!githubResponse.ok) {
      throw new Error(
        "Unable to verify GitHub account."
      );
    }

    const githubUser =
      await githubResponse.json();

    const supabase =
      getAdminSupabase();

    const encryptedToken =
      encryptToken(accessToken);

    const { error: dbError } =
      await supabase
        .from("github_connections")
        .upsert(
          {
            user_id:
              payload.userId,
            github_id:
              githubUser.id,
            github_login:
              githubUser.login,
            github_avatar_url:
              githubUser.avatar_url ||
              null,
            access_token:
              encryptedToken,
            scope:
              tokenData.scope || "",
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id",
          }
        );

    if (dbError) {
      throw dbError;
    }

    clearCookie(
      res,
      "github_oauth_state"
    );
const returnTo =
  typeof payload.returnTo === "string" &&
  payload.returnTo.startsWith("/builder/")
    ? payload.returnTo
    : "/dashboard";
const returnTo =
  typeof payload.returnTo === "string" &&
  payload.returnTo.startsWith("/builder/")
    ? payload.returnTo
    : "/dashboard";

return res.redirect(
  `${returnTo}${
    returnTo.includes("?")
      ? "&"
      : "?"
  }github_connected=1`
);
  } catch (error) {
    console.error(
      "GitHub callback error:",
      error
    );
const returnTo =
  "/dashboard";

return res.redirect(
  `${returnTo}?github_error=${encodeURIComponent(
    error_description ||
      error
  )}`
);
  }
}