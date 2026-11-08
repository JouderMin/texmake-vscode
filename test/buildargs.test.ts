import test from "node:test";
import assert from "node:assert/strict";
import { buildArgs } from "../src/buildargs";

test("项目模式", () => {
  assert.deepEqual(buildArgs({ kind: "project", root: "/w", name: "thesis" }, "build", []), [
    "build",
  ]);
});
test("项目模式追加参数", () => {
  assert.deepEqual(
    buildArgs({ kind: "project", root: "/w", name: "thesis" }, "build", ["-v"]),
    ["build", "-v"],
  );
});
test("项目模式 clean", () => {
  assert.deepEqual(buildArgs({ kind: "project", root: "/w", name: "thesis" }, "clean", []), [
    "clean",
  ]);
});
test("项目模式 clean 追加参数", () => {
  assert.deepEqual(
    buildArgs({ kind: "project", root: "/w", name: "thesis" }, "clean", ["-v", "--force"]),
    ["clean", "-v", "--force"],
  );
});
test("成员模式带 -p", () => {
  assert.deepEqual(
    buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, "build", []),
    ["-p", "paper", "build"],
  );
});
test("成员模式追加参数", () => {
  assert.deepEqual(
    buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, "build", [
      "-v",
    ]),
    ["-p", "paper", "build", "-v"],
  );
});
test("成员模式 clean", () => {
  assert.deepEqual(
    buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, "clean", []),
    ["-p", "paper", "clean"],
  );
});
test("成员模式 clean 追加参数位于操作之后", () => {
  assert.deepEqual(
    buildArgs({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, "clean", [
      "-v",
    ]),
    ["-p", "paper", "clean", "-v"],
  );
});
test("不可构建返回 undefined", () => {
  assert.equal(buildArgs({ kind: "unlocated", reason: "x" }, "build", []), undefined);
  assert.equal(buildArgs({ kind: "config-error", root: "/w", reason: "x" }, "build", []), undefined);
  assert.equal(
    buildArgs({ kind: "member-error", root: "/w", memberDir: "/w/p", reason: "x" }, "build", []),
    undefined,
  );
});
test("错误态 clean 同样返回 undefined", () => {
  assert.equal(buildArgs({ kind: "unlocated", reason: "x" }, "clean", []), undefined);
  assert.equal(buildArgs({ kind: "config-error", root: "/w", reason: "x" }, "clean", []), undefined);
  assert.equal(
    buildArgs({ kind: "member-error", root: "/w", memberDir: "/w/p", reason: "x" }, "clean", []),
    undefined,
  );
});
test("项目模式 build 带配方", () => {
  assert.deepEqual(
    buildArgs({ kind: "project", root: "/w", name: "thesis" }, "build", ["-v"], "draft"),
    ["build", "draft", "-v"],
  );
});
test("成员模式 build 带配方", () => {
  assert.deepEqual(
    buildArgs(
      { kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" },
      "build",
      [],
      "release",
    ),
    ["-p", "paper", "build", "release"],
  );
});
test("clean 忽略配方", () => {
  assert.deepEqual(
    buildArgs({ kind: "project", root: "/w", name: "thesis" }, "clean", ["-v"], "draft"),
    ["clean", "-v"],
  );
  assert.deepEqual(
    buildArgs(
      { kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" },
      "clean",
      [],
      "release",
    ),
    ["-p", "paper", "clean"],
  );
});
