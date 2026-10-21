#!/usr/bin/env node
// Usage: node src/cli.mjs <github_user> <output.svg[?titles=false&email=false&visitor_log=false&part=radio|status]> [more outputs...]
// Reads GITHUB_TOKEN and these from the environment:
//   OPEN_COMMS_EMAIL (empty or false for a receive-only radio), OPEN_COMMS_STATUS, OPEN_COMMS_GITHUB_STATUS (true/false),
//   OPEN_COMMS_FREQUENCY, OPEN_COMMS_VISITOR_PAGE_ID, OPEN_COMMS_VISITOR_LOG (true/false), OPEN_COMMS_TITLES (true/false).
// Set OPEN_COMMS_PROFILE to a saved profile JSON to render offline; set OPEN_COMMS_SAVE to write one.
import fs from "node:fs";
import path from "node:path";
import { getProfile, getVisitors, formatFrequency } from "./profile.mjs";
import { buildSvg } from "./render.mjs";

const [user, ...rest] = process.argv.slice(2);
const outputs = rest.flatMap((a) => a.split("\n")).map((a) => a.trim()).filter(Boolean);
if (!user || !outputs.length) {
  console.error("Usage: node src/cli.mjs <github_user> <output.svg[?titles=false&email=false&visitor_log=false&part=radio|status]> [more outputs...]");
  process.exit(1);
}

const env = (k) => (process.env[k] || "").trim();
const off = (v) => /^(false|no|off|0)$/i.test(v);
const on = (v) => /^(true|yes|on|1)$/i.test(v);
const email = off(env("OPEN_COMMS_EMAIL")) ? "" : env("OPEN_COMMS_EMAIL");
const opts = {
  email: email || null,
  status: env("OPEN_COMMS_STATUS") || "SYSTEMS NOMINAL · READY FOR NEXT MISSION",
  githubStatus: on(env("OPEN_COMMS_GITHUB_STATUS")),
  frequency: env("OPEN_COMMS_FREQUENCY") || "122.800",
};

let profile;
if (process.env.OPEN_COMMS_PROFILE) {
  // A saved profile keeps its login, name and synced status; the email and frequency still come from this run.
  const saved = JSON.parse(fs.readFileSync(process.env.OPEN_COMMS_PROFILE, "utf8"));
  const status = opts.githubStatus && saved.statusSource === "github" ? {} : { status: opts.status, statusSource: "input", busy: false };
  profile = { ...saved, email: opts.email, ...status, frequency: formatFrequency(opts.frequency), generatedAt: new Date().toISOString() };
} else {
  profile = await getProfile(user.trim(), process.env.GITHUB_TOKEN, opts);
}
// A visitor page id adds the visitor log; a saved profile keeps the count it was saved with.
const pageId = env("OPEN_COMMS_VISITOR_PAGE_ID");
if (pageId && !(process.env.OPEN_COMMS_PROFILE && "visitors" in profile)) profile.visitors = await getVisitors(pageId);
if (!pageId) delete profile.visitors;
if (process.env.OPEN_COMMS_SAVE) fs.writeFileSync(process.env.OPEN_COMMS_SAVE, JSON.stringify(profile, null, 2) + "\n");
console.log(`${profile.login}: ${profile.email || "receive only"} on ${profile.frequency}, "${profile.status}"` +
  `${profile.statusSource === "github" ? ` (GitHub status${profile.busy ? ", busy" : ""})` : ""}` +
  `${"visitors" in profile ? `, visitor log ${profile.visitors ?? "unavailable"}` : ""}`);

for (const out of outputs) {
  const [file, query = ""] = out.split("?");
  const q = new URLSearchParams(query);
  const flag = (key, envKey) => !off((q.get(key) || env(envKey) || "true").trim());
  const titles = flag("titles", "OPEN_COMMS_TITLES"), withEmail = !off((q.get("email") || "true").trim()), visitorLog = flag("visitor_log", "OPEN_COMMS_VISITOR_LOG");
  const part = (q.get("part") || "all").trim().toLowerCase();
  if (!["all", "radio", "status"].includes(part)) {
    console.error(`Error: ${file}: part must be radio or status, not "${part}"`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, buildSvg(profile, { titles, email: withEmail, visitorLog, part }));
  const notes = [part !== "all" && `${part} only`, !titles && "no titles", !(withEmail && profile.email) && "receive only", !(visitorLog && "visitors" in profile) && "no visitor log"].filter(Boolean);
  console.log(`wrote ${file}${notes.length ? ` (${notes.join(", ")})` : ""}`);
}
