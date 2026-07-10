import {
  getWikimediaEnterpriseConfig,
  updateWikimediaEnterpriseTokens,
} from "./integration-settings-service";

const AUTH_BASE = "https://auth.enterprise.wikimedia.com/v1";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type RefreshResponse = {
  access_token: string;
  expires_in: number;
};

function tokenStillValid(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return expiry - Date.now() > 60_000;
}

async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wikimedia Enterprise login failed (${res.status}): ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<LoginResponse>;
}

async function refreshAccessToken(username: string, refreshToken: string): Promise<RefreshResponse> {
  const res = await fetch(`${AUTH_BASE}/token-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wikimedia Enterprise token refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<RefreshResponse>;
}

export async function getWikimediaEnterpriseAccessToken(): Promise<string | undefined> {
  const config = await getWikimediaEnterpriseConfig();
  if (!config.username || !config.password) return undefined;

  if (config.accessToken && tokenStillValid(config.accessTokenExpiresAt)) {
    return config.accessToken;
  }

  if (config.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(config.username, config.refreshToken);
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await updateWikimediaEnterpriseTokens({
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: expiresAt,
      });
      return refreshed.access_token;
    } catch {
      // fall through to full login
    }
  }

  const session = await login(config.username, config.password);
  const expiresAt = new Date(Date.now() + session.expires_in * 1000).toISOString();
  await updateWikimediaEnterpriseTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    accessTokenExpiresAt: expiresAt,
  });
  return session.access_token;
}

export async function testWikimediaEnterpriseConnection(): Promise<{
  ok: boolean;
  message: string;
  expiresIn?: number;
}> {
  const config = await getWikimediaEnterpriseConfig();
  if (!config.username || !config.password) {
    return { ok: false, message: "Add your Wikimedia Enterprise username and password first." };
  }

  const session = await login(config.username, config.password);
  const expiresAt = new Date(Date.now() + session.expires_in * 1000).toISOString();
  await updateWikimediaEnterpriseTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    accessTokenExpiresAt: expiresAt,
  });

  const projectsRes = await fetch("https://api.enterprise.wikimedia.com/v2/projects", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!projectsRes.ok) {
    return {
      ok: false,
      message: `Login succeeded but API probe failed (${projectsRes.status}).`,
    };
  }

  return {
    ok: true,
    message: "Connected. Read-only Wikipedia archive queries are ready.",
    expiresIn: session.expires_in,
  };
}
