import {
  getAdminSupabase,
  getSupabaseUser,
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

    const { error } =
      await supabase
        .from("github_connections")
        .delete()
        .eq(
          "user_id",
          user.id
        );

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      message:
        "GitHub disconnected.",
    });
  } catch (error) {
    console.error(
      "GitHub disconnect error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to disconnect GitHub.",
    });
  }
}