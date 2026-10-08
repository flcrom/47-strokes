import { test } from "node:test";
import assert from "node:assert/strict";
import { profileURL } from "./src/profiles.mjs";
test("optional fixed-prefix profile routes", () => {
  assert.equal(profileURL("manual", ""), "");
  assert.equal(profileURL("github", ""), "");
  assert.equal(profileURL("x", "@flcrom"), "https://x.com/flcrom");
  assert.equal(
    profileURL("linkedin", "47th"),
    "https://www.linkedin.com/in/47th",
  );
  assert.equal(
    profileURL("monkeytype", "a.b"),
    "https://monkeytype.com/profile/a.b",
  );
});
test("profile boundary and injected path rejection", () => {
  for (const s of [
    "a--b",
    "-a",
    "a-",
    "a".repeat(40),
    "a/b",
    "a?b",
    "a%2Fb",
    "a@b",
  ])
    assert.throws(() => profileURL("github", s));
  assert.throws(() => profileURL("x", "a".repeat(16)));
  assert.throws(() => profileURL("monkeytype", ".abc"));
  assert.throws(() => profileURL("monkeytype", "a".repeat(17)));
});
test("new approved profiles use valid input shapes", () => {
  assert.equal(
    profileURL("instagram", "flcrom"),
    "https://www.instagram.com/flcrom",
  );
  assert.equal(
    profileURL("signal", "https://signal.me/#eu/example"),
    "https://signal.me/#eu/example",
  );
  assert.equal(
    profileURL("discord", "https://discord.com/users/123456789012345678"),
    "https://discord.com/users/123456789012345678",
  );
  for (const x of ["flcrom", "https://example.com/a", "http://signal.me/#eu/a"])
    assert.throws(() => profileURL("signal", x));
  assert.throws(() => profileURL("discord", "https://discord.com/users/name"));
  assert.throws(() => profileURL("instagram", "a/b"));
});

test("Signal rejects malformed share routes", () => {
  for (const v of [
    "https://signal.me/",
    "https://signal.me/foo#eu/token",
    "https://signal.me/?x=1#eu/token",
    "https://signal.me/#eu/",
  ])
    assert.throws(() => profileURL("signal", v));
});

test("Reddit, Telegram and YouTube inputs", () => {
  assert.equal(profileURL("reddit", "flcrom"), "https://www.reddit.com/user/flcrom");
  assert.equal(profileURL("telegram", "@flcrom"), "https://t.me/flcrom");
  assert.equal(profileURL("youtube", "@flcrom"), "https://www.youtube.com/@flcrom");
  assert.equal(profileURL("youtube", "flcrom"), "https://www.youtube.com/@flcrom");
  for (const [u, o] of [
    ["https://www.youtube.com/@flcrom/", "https://www.youtube.com/@flcrom"],
    ["https://youtube.com/c/flcrom", "https://www.youtube.com/c/flcrom"],
    ["https://www.youtube.com/user/flcrom", "https://www.youtube.com/user/flcrom"],
    ["https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv", "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"],
  ]) assert.equal(profileURL("youtube", u), o);
  for (const x of ["a", "http://youtube.com/@a1b", "https://evil.com/@flcrom", "https://www.youtube.com/watch?v=x", "https://www.youtube.com/channel/abc"])
    assert.throws(() => profileURL("youtube", x));
  assert.throws(() => profileURL("reddit", "ab"));
  assert.throws(() => profileURL("telegram", "abc"));
  assert.throws(() => profileURL("telegram", "a/b123"));
});
