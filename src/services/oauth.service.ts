export class OAuthService {
  constructor(
    private googleClientId: string,
    private googleClientSecret: string,
    private githubClientId: string,
    private githubClientSecret: string,
    private appUrl: string
  ) {}

  // --- GOOGLE ---
  getGoogleAuthUrl(): string {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
      redirect_uri: `${this.appUrl}/auth/google/callback`,
      client_id: this.googleClientId,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  async getGoogleUser(code: string): Promise<{ email: string; name: string } | null> {
    try {
      // 1. Get tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: this.googleClientId,
          client_secret: this.googleClientSecret,
          redirect_uri: `${this.appUrl}/auth/google/callback`,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenRes.ok) {
        console.error("Google token error:", await tokenRes.text());
        return null;
      }
      const tokenData = await tokenRes.json() as any;

      // 2. Fetch user details
      const userRes = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${tokenData.access_token}`
      );
      if (!userRes.ok) {
        console.error("Google user error:", await userRes.text());
        return null;
      }
      const userData = await userRes.json() as any;

      return {
        email: userData.email,
        name: userData.name || userData.given_name || "Google User",
      };
    } catch (e) {
      console.error("OAuth Service Google Error:", e);
      return null;
    }
  }

  // --- GITHUB ---
  getGithubAuthUrl(): string {
    const rootUrl = "https://github.com/login/oauth/authorize";
    const options = {
      client_id: this.githubClientId,
      redirect_uri: `${this.appUrl}/auth/github/callback`,
      scope: "user:email",
    };
    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  async getGithubUser(code: string): Promise<{ email: string; name: string } | null> {
    try {
      // 1. Get tokens
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
          redirect_uri: `${this.appUrl}/auth/github/callback`,
        }),
      });

      if (!tokenRes.ok) {
        console.error("GitHub token error:", await tokenRes.text());
        return null;
      }
      const tokenData = await tokenRes.json() as any;
      if (tokenData.error) {
         console.error("GitHub token data error:", tokenData);
         return null;
      }

      // 2. Fetch user profile
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
          "User-Agent": "SAKU-Worker", // Required by GitHub API
        },
      });
      if (!userRes.ok) return null;
      const userData = await userRes.json() as any;

      // 3. Fetch user email (GitHub hides email sometimes if it's private)
      let email = userData.email;
      if (!email) {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: {
             Authorization: `Bearer ${tokenData.access_token}`,
             Accept: "application/json",
             "User-Agent": "SAKU-Worker",
          },
        });
        if (emailRes.ok) {
           const emails = await emailRes.json() as any[];
           const primary = emails.find(e => e.primary) || emails[0];
           if (primary) email = primary.email;
        }
      }

      if (!email) return null;

      return {
        email: email,
        name: userData.name || userData.login || "GitHub User",
      };
    } catch (e) {
      console.error("OAuth Service GitHub Error:", e);
      return null;
    }
  }
}
