import test from "node:test";
import assert from "node:assert/strict";
import { buildArgs } from "../src/buildargs";

test("项目模式", () => {
  assert.deepEqual(buildArgs({ kind: "project", root: "/w", name: "thesis" }, []), ["build"]);
});
test("项目模式追加参数", () => {
  assert.deepEqual(buildArgs({ kind: "project", root: "/w", name: "thesis" }, ["-v"]), ["build", "-v"]);
});
test("成员模式带 -p", () => {
  assert.deepEqual(buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, []), ["-p", "paper", "build"]);
});
test("成员模式追加参数", () => {
  assert.deepEqual(buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, ["-v"]), ["-p", "paper", "build", "-v"]);
});
test("不可构建返回 undefined", () => {
  assert.equal(buildArgs({ kind: "unlocated", reason: "x" }, []), undefined);
  assert.equal(buildArgs({ kind: "config-error", root: "/w", reason: "x" }, []), undefined);
  assert.equal(buildArgs({ kind: "member-error", root: "/w", memberDir: "/w/p", reason: "x" }, []), undefined);
});
