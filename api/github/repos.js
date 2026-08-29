import {
  getSupabaseUser,
  getAdminSupabase,
  decryptToken,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const user = await getSupabaseUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in.",
      });
    }

    const supabase = getAdminSupabase();

    const { data: connection, error: dbError } =
      await supabase
        .from("github_connections")
        .select("access_token, github_login")
        .eq("user_id", user.id)
        .maybeSingle();

    if (dbError) {
      throw dbError;
    }

    if (!connection?.access_token) {
      return res.status(400).json({
        success: false,
        error: "GitHub is not connected.",
      });
    }

    const accessToken = decryptToken(
      connection.access_token
    );

    const githubResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept:
            "application/vnd.github+json",
          "X-GitHub-Api-Version":
            "2022-11-28",
        },
      }
    );

    const githubData =
      await githubResponse.json();

    if (!githubResponse.ok) {
      console.error(
        "GitHub repositories request failed:",
        githubData
      );

      return res.status(
        githubResponse.status
      ).json({
        success: false,
        error:
          githubData?.message ||
          "Unable to fetch GitHub repositories.",
      });
    }

    const repositories = githubData.map(
      (repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        default_branch:
          repo.default_branch,
        html_url: repo.html_url,
        description:
          repo.description || "",
        owner: repo.owner?.login || "",
        updated_at:
          repo.updated_at || null,
      })
    );

    return res.status(200).json({
      success: true,
      github_login:
        connection.github_login,
      repositories,
    });
  } catch (error) {
    console.error(
      "GitHub repositories error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to load GitHub repositories.",
    });
  }
}