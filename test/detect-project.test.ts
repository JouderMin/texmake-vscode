import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detect } from "../src/detect";

/** 建临时工程目录：可选写入 texmake.toml，并放一个 main.tex。 */
function makeRoot(t: TestContext, toml: string | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "texmake-det-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (toml !== null) {
    fs.writeFileSync(path.join(root, "texmake.toml"), toml);
  }
  fs.writeFileSync(path.join(root, "main.tex"), "\\documentclass{article}\n");
  return root;
}

const singleProject = '[project]\nname = "thesis"\nmain = "main.tex"\n';

test("识别单项目", (t) => {
  const root = makeRoot(t, singleProject);
  const main = path.join(root, "main.tex");
  assert.deepEqual(detect(main, [root]), { kind: "project", root, name: "thesis" });
});

test("没有 texmake.toml 时未定位", (t) => {
  const root = makeRoot(t, null);
  const main = path.join(root, "main.tex");
  assert.equal(detect(main, [root]).kind, "unlocated");
});

test("文件不在工作区文件夹内时未定位", (t) => {
  const root = makeRoot(t, singleProject);
  const other = makeRoot(t, singleProject);
  const main = path.join(root, "main.tex");
  assert.equal(detect(main, [other]).kind, "unlocated");
});

test("[project] 缺 name 时报配置错误", (t) => {
  const root = makeRoot(t, '[project]\nmain = "main.tex"\n');
  const main = path.join(root, "main.tex");
  const d = detect(main, [root]);
  assert.equal(d.kind, "config-error");
  assert.match((d as { reason: string }).reason, /name/);
});

test("同时有 [project] 与 [workspace] 时报配置错误", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "thesis"\nmain = "main.tex"\n\n[workspace]\nmembers = ["a"]\n',
  );
  const main = path.join(root, "main.tex");
  const d = detect(main, [root]);
  assert.equal(d.kind, "config-error");
  assert.match((d as { reason: string }).reason, /\[project\]/);
  assert.match((d as { reason: string }).reason, /\[workspace\]/);
});

test("两个表都没有时报配置错误", (t) => {
  const root = makeRoot(t, 'title = "x"\n');
  const main = path.join(root, "main.tex");
  const d = detect(main, [root]);
  assert.equal(d.kind, "config-error");
  assert.match((d as { reason: string }).reason, /project|workspace/);
});

test("TOML 语法错误时报配置错误且不抛异常", (t) => {
  const root = makeRoot(t, '[project\nname = "thesis"\n');
  const main = path.join(root, "main.tex");
  const d = detect(main, [root]);
  assert.equal(d.kind, "config-error");
  assert.equal(typeof (d as { reason: string }).reason, "string");
  assert.ok((d as { reason: string }).reason.length > 0);
});
