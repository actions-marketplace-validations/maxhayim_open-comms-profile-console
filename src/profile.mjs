// Gather what the comms panel needs: the user's login and display name for the header callsign, and their GitHub status.
// A missing token or a failed request falls back to the login, so the panel still renders.

const QUERY = `query($login: String!) {
  user(login: $login) { login name status { message indicatesLimitedAvailability } }
}`;

async function graphql(login, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { "User-Agent": "open-comms-radio", Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length || !data?.user) throw new Error(errors?.[0]?.message || "user not found");
  return data.user;
}

// The REST API has no status, so it's only the fallback when there's no token.
async function rest(login) {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers: { "User-Agent": "open-comms-radio", Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

// githubStatus: true shows the user's GitHub status message instead of `status`, when they have one set.
export async function getProfile(login, token, { email, status, frequency, githubStatus }) {
  let name = login, gh = null;
  try {
    const u = token ? await graphql(login, token) : await rest(login);
    login = u.login || login;
    name = u.name || login;
    gh = u.status || null;
  } catch (e) {
    console.warn(`warning: couldn't read the profile for "${login}" (${e.message}), using the login as the name`);
  }
  const p = { login, name, email, status, statusSource: "input", frequency: formatFrequency(frequency), generatedAt: new Date().toISOString() };
  if (githubStatus) {
    const synced = statusText(gh?.message);
    if (synced) Object.assign(p, { status: synced, statusSource: "github", busy: !!gh.indicatesLimitedAvailability });
    else console.warn(token ? "warning: no GitHub status set, showing the status input" : "warning: reading the GitHub status needs a token, showing the status input");
  }
  return p;
}

// "Systems nominal. Ready for next mission. 🚀" -> "Systems nominal · Ready for next mission"
export function statusText(message) {
  return String(message || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]|:[a-z0-9_+-]+:/gu, "")
    .replace(/\s*[.!?;]+\s+/g, " · ").replace(/[.!?;\s]+$/, "").replace(/\s+/g, " ").trim();
}

// "122.8" -> "122.800"; anything that isn't a number is kept as typed.
export function formatFrequency(f) {
  const n = Number(String(f).trim());
  return Number.isFinite(n) && String(f).trim() !== "" ? n.toFixed(3) : String(f).trim();
}

// Read a visitor-badge.laobi.icu count without adding a visit (query_only), retrying once since the service can be slow.
// Returns null if it can't be read, so the panel shows dashes instead of failing the run.
export async function getVisitors(pageId) {
  const url = `https://visitor-badge.laobi.icu/badge?page_id=${encodeURIComponent(pageId)}&query_only=true`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "open-comms-radio" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const texts = [...(await res.text()).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim());
      const n = Number(texts.at(-1));
      if (!Number.isInteger(n)) throw new Error(`no count in the badge (${texts.at(-1) || "empty"})`);
      return n;
    } catch (e) {
      console.warn(`warning: visitor count for "${pageId}" attempt ${attempt} failed (${e.message})`);
    }
  }
  return null;
}
