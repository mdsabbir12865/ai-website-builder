import {
  getSupabaseUser,
  getAdminSupabase,
  decryptToken,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

    const { name, description, private: isPrivate } =
      req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        error: "Repository name is required.",
      });
    }

    const repoName = name.trim();

    if (!repoName) {
      return res.status(400).json({
        success: false,
        error: "Repository name cannot be empty.",
      });
    }

    if (!/^[A-Za-z0-9._-]+$/.test(repoName)) {
      return res.status(400).json({
        success: false,
        error:
          "Repository name can only contain letters, numbers, dots, hyphens and underscores.",
      });
    }

    const supabase = getAdminSupabase();

    const { data: connection, error: dbError } =
      await supabase
        .from("github_connections")
        .select("access_token")
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
      "https://api.github.com/user/repos",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept:
            "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version":
            "2022-11-28",
        },
        body: JSON.stringify({
          name: repoName,
          description:
            typeof description === "string"
              ? description.trim()
              : "",
          private:
            Boolean(isPrivate),
          auto_init: true,
        }),
      }
    );

    const githubData =
      await githubResponse.json();

    if (!githubResponse.ok) {
      console.error(
        "GitHub create repository failed:",
        githubData
      );

      return res.status(
        githubResponse.status
      ).json({
        success: false,
        error:
          githubData?.message ||
          "Unable to create repository.",
      });
    }

    return res.status(201).json({
      success: true,
      repository: {
        id: githubData.id,
        name: githubData.name,
        full_name:
          githubData.full_name,
        private:
          githubData.private,
        default_branch:
          githubData.default_branch,
        html_url:
          githubData.html_url,
        description:
          githubData.description || "",
      },
    });
  } catch (error) {
    console.error(
      "Create repository error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to create repository.",
    });
  }
}