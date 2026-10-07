export const profiles = [
  {
    id: "manual",
    name: "Link",
    hint: "https://your-site.com",
    prefix: "",
    link: true,
  },
  {
    id: "github",
    name: "GitHub",
    hint: "username",
    prefix: "https://github.com/",
  },
  { id: "x", name: "X", hint: "username", prefix: "https://x.com/" },
  {
    id: "discord",
    name: "Discord",
    hint: "https://discord.com/users/…",
    prefix: "",
    link: true,
    help: "Paste your Discord profile link. Usernames are not profile URLs.",
  },
  {
    id: "signal",
    name: "Signal",
    hint: "Paste your Signal share link",
    prefix: "",
    link: true,
    help: "Copy the unique link from Signal → Profile → QR Code or Link. It cannot be built from your username.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    hint: "profile slug",
    prefix: "https://www.linkedin.com/in/",
  },
  {
    id: "instagram",
    name: "Instagram",
    hint: "username",
    prefix: "https://www.instagram.com/",
  },
  {
    id: "monkeytype",
    name: "Monkeytype",
    hint: "username",
    prefix: "https://monkeytype.com/profile/",
  },
];
export function profileURL(id, value) {
  const v = value.trim();
  if (!v) return "";
  if (id === "manual") return v;
  const p = profiles.find((p) => p.id === id);
  if (!p) throw Error("Choose a link type.");
  if (p.link) {
    let u;
    try {
      u = new URL(v);
    } catch {
      throw Error("Paste a complete HTTPS link.");
    }
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Paste a complete HTTPS link.");
    if (
      id === "discord" &&
      !(
        ["discord.com", "discordapp.com"].includes(u.hostname) &&
        /^\/users\/\d+$/.test(u.pathname)
      )
    )
      throw Error("Paste a Discord profile link using its numeric user ID.");
    if (
      id === "signal" &&
      (u.hostname !== "signal.me" ||
        u.pathname !== "/" ||
        u.search !== "" ||
        !/^#eu\/[A-Za-z0-9_-]+$/.test(u.hash))
    )
      throw Error("Paste the share link copied from Signal.");
    return v;
  }
  const handle = v.replace(/^@/, "");
  const pattern =
    id === "github"
      ? /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/
      : id === "x"
        ? /^[a-zA-Z0-9_]{1,15}$/
        : id === "instagram"
          ? /^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/
          : id === "linkedin"
            ? /^[a-zA-Z0-9-]{3,100}$/
            : /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,15}$/;
  if (!pattern.test(handle) || (id === "github" && handle.includes("--")))
    throw Error("Enter only your username or profile slug, not a URL.");
  return p.prefix + encodeURIComponent(handle);
}
