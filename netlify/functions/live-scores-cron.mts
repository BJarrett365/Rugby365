/**
 * Netlify Scheduled Function — hits the Next.js live-scores cron so scores,
 * match events, and post-match rating triggers keep moving without page traffic.
 *
 * Schedule: every 2 minutes.
 * Requires CRON_SECRET in Netlify env when the API route enforces it.
 *
 * @typedef {{ schedule?: string }} NetlifyScheduledConfig
 * @type {{ schedule: string }}
 */
export const config = {
  schedule: "*/2 * * * *",
};

/**
 * @param {Request} _req
 * @param {unknown} _context
 */
export default async (_req, _context) => {
  const siteUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://planetrugbydata.netlify.app";
  const secret = process.env.CRON_SECRET?.trim();
  /** @type {Record<string, string>} */
  const headers = { Accept: "application/json" };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["x-cron-secret"] = secret;
  }

  const res = await fetch(new URL("/api/cron/live-scores", siteUrl), {
    method: "POST",
    headers,
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[live-scores-cron] ${res.status} ${body.slice(0, 500)}`);
    return new Response(body, { status: res.status });
  }
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
