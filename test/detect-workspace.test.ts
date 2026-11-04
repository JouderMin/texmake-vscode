import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detect } from "../src/detect";

type MemberSpec = Record<string, string | null>;

/** 建临时工作区：写根 texmake.toml，按 specs 建成员目录并写入各自的 texmake.toml（null 表示不写）。 */
function makeWorkspace(t: TestContext, rootToml: string, members: MemberSpec): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "texmake-ws-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "texmake.toml"), rootToml);
  fs.writeFileSync(path.join(root, "notes.tex"), "notes\n");
  for (const [dir, toml] of Object.entries(members)) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, { recursive: true });
    fs.writeFileSync(path.join(abs, "main.tex"), "\\documentclass{article}\n");
    if (toml !== null) {
      fs.writeFileSync(path.join(abs, "texmake.toml"), toml);
    }
  }
  return root;
}

const twoMembers = '[workspace]\nmembers = ["paper", "slides"]\n';
const projectToml = (name: string) => `[project]\nname = "${name}"\nmain = "main.tex"\n`;

test("定位成员并按成员配置取名", (t) => {
  const root = makeWorkspace(t, twoMembers, { paper: projectToml("paper"), slides: projectToml("slides") });
  const paperMain = path.join(root, "paper", "main.tex");
  assert.deepEqual(detect(paperMain, [root]), {
    kind: "member",
    root,
    name: "paper",
    memberDir: path.join(root, "paper"),
  });
});

test("嵌套成员取最长路径", (t) => {
  const rootToml = '[workspace]\nmembers = ["paper", "paper/ch1"]\n';
  const root = makeWorkspace(t, rootToml, { paper: projectToml("paper") });
  const ch1Dir = path.join(root, "paper", "ch1");
  fs.mkdirSync(ch1Dir, { recursive: true });
  fs.writeFileSync(path.join(ch1Dir, "texmake.toml"), projectToml("ch1"));
  fs.writeFileSync(path.join(ch1Dir, "main.tex"), "\\chapter{one}\n");
  const ch1Main = path.join(ch1Dir, "main.tex");
  assert.equal((detect(ch1Main, [root]) as { name: string }).name, "ch1");
});

test("文件在工作区根但不在成员内时未定位", (t) => {
  const root = makeWorkspace(t, twoMembers, { paper: projectToml("paper"), slides: projectToml("slides") });
  const d = detect(path.join(root, "notes.tex"), [root]);
  assert.equal(d.kind, "unlocated");
  assert.match((d as { reason: string }).reason, /members/);
});

test("成员缺少 texmake.toml 时报成员配置错误", (t) => {
  const root = makeWorkspace(t, twoMembers, { paper: null, slides: projectToml("slides") });
  const paperMain = path.join(root, "paper", "main.tex");
  const d = detect(paperMain, [root]);
  assert.equal(d.kind, "member-error");
  assert.match((d as { reason: string }).reason, /texmake\.toml/);
});

test("成员 [project] 缺 name 时报成员配置错误", (t) => {
  const root = makeWorkspace(t, twoMembers, {
    paper: '[project]\nmain = "main.tex"\n',
    slides: projectToml("slides"),
  });
  const paperMain = path.join(root, "paper", "main.tex");
  const d = detect(paperMain, [root]);
  assert.equal(d.kind, "member-error");
  assert.match((d as { reason: string }).reason, /name/);
});

test("members 不是字符串数组时报配置错误", (t) => {
  const root = makeWorkspace(t, '[workspace]\nmembers = "paper"\n', { paper: projectToml("paper") });
  const paperMain = path.join(root, "paper", "main.tex");
  assert.equal(detect(paperMain, [root]).kind, "config-error");
});

test("成员名互为前缀时按目录边界归属", (t) => {
  const rootToml = '[workspace]\nmembers = ["paper", "paper2"]\n';
  const root = makeWorkspace(t, rootToml, { paper: projectToml("paper"), paper2: projectToml("paper2") });
  const paper2Main = path.join(root, "paper2", "main.tex");
  assert.equal((detect(paper2Main, [root]) as { name: string }).name, "paper2");
});
