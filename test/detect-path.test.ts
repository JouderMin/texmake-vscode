import test from "node:test";
import assert from "node:assert/strict";
import { isInside, findContainingFolder } from "../src/detect";

test("isInside 接受子路径", () => {
  assert.equal(isInside("/w/paper/main.tex", "/w/paper"), true);
});
test("isInside 拒绝同前缀的兄弟目录", () => {
  assert.equal(isInside("/w/paper2/main.tex", "/w/paper"), false);
});
test("isInside 接受带尾随分隔符的父目录", () => {
  assert.equal(isInside("/w/paper/main.tex", "/w/paper/"), true);
});
test("isInside 区分子目录本身与文件", () => {
  assert.equal(isInside("/w/paper", "/w/paper"), true);
});
test("isInside 区分大小写", () => {
  assert.equal(isInside("/W/Paper/main.tex", "/w/paper"), false);
});
test("findContainingFolder 取最长匹配", () => {
  assert.equal(findContainingFolder("/w/paper/main.tex", ["/w", "/w/paper"]), "/w/paper");
});
test("findContainingFolder 找不到时返回 undefined", () => {
  assert.equal(findContainingFolder("/other/main.tex", ["/w"]), undefined);
});
