import {
  getAdminSupabase,
  getSupabaseUser,
} from "./_utils.js";

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const user =
      await getSupabaseUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated.",
      });
    }

    const supabase =
      getAdminSupabase();

    const {
      data,
      error,
    } = await supabase
      .from("github_connections")
      .select(
        "github_id, github_login, github_avatar_url, scope, updated_at"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      connected: Boolean(data),
      connection: data
        ? {
            id: data.github_id,
            login:
              data.github_login,
            avatar:
              data.github_avatar_url,
            scope:
              data.scope,
            updatedAt:
              data.updated_at,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "GitHub status error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to check GitHub connection.",
    });
  }
}