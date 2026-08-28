import {
  GITHUB_CLIENT_ID,
  GITHUB_REDIRECT_URI,
  createOAuthState,
  getSupabaseUser,
  setCookie,
} from "./_utils.js";

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    if (!GITHUB_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        error:
          "GITHUB_CLIENT_ID is not configured.",
      });
    }

    const user =
      await getSupabaseUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error:
          "You must be logged in.",
      });
    }

    const state =
      createOAuthState(user.id);

    setCookie(
      res,
      "github_oauth_state",
      state,
      {
        maxAge: 600,
      }
    );

    const params =
      new URLSearchParams({
        client_id:
          GITHUB_CLIENT_ID,
        redirect_uri:
          GITHUB_REDIRECT_URI,
        scope:
          "repo user:email",
        state,
      });

    const authorizationUrl =
      `https://github.com/login/oauth/authorize?${params.toString()}`;

    return res.status(200).json({
      success: true,
      authorizationUrl,
    });
  } catch (error) {
    console.error(
      "GitHub connect error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to start GitHub connection.",
    });
  }
}