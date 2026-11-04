import test from "node:test";
import assert from "node:assert/strict";
import { statusLabel, statusTooltip } from "../src/status";

test("未定位显示破折号", () => {
  assert.equal(statusLabel({ kind: "unlocated", reason: "x" }), "texmake: —");
});
test("根配置错误显示警告", () => {
  assert.equal(statusLabel({ kind: "config-error", root: "/w", reason: "bad" }), "$(warning) texmake: 配置错误");
});
test("成员配置错误显示警告", () => {
  assert.equal(statusLabel({ kind: "member-error", root: "/w", memberDir: "/w/p", reason: "bad" }), "$(warning) texmake: 成员配置错误");
});
test("项目显示名字", () => {
  assert.equal(statusLabel({ kind: "project", root: "/w", name: "thesis" }), "texmake: thesis");
});
test("成员显示名字", () => {
  assert.equal(statusLabel({ kind: "member", root: "/w", name: "paper", memberDir: "/w/p" }), "texmake: paper");
});
test("错误态 tooltip 含原因", () => {
  assert.match(statusTooltip({ kind: "config-error", root: "/w", reason: "缺少 name" }, "texmake build"), /缺少 name/);
});
test("可构建态 tooltip 含根目录与命令", () => {
  const t = statusTooltip({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, "texmake -p paper build");
  assert.match(t, /\/w/);
  assert.match(t, /texmake -p paper build/);
});
