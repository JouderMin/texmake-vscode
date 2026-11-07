import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detect } from "../src/detect";
import { resolvePdfPath } from "../src/pdf";

/** 建临时目录，写入 texmake.toml、空的 main.tex 与 paper.tex。 */
function makeRoot(t: TestContext, toml: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "texmake-pdf-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "texmake.toml"), toml);
  fs.writeFileSync(path.join(root, "main.tex"), "");
  fs.writeFileSync(path.join(root, "paper.tex"), "");
  return root;
}

test("项目默认 output", (t) => {
  const root = makeRoot(t, '[project]\nname = "t"\nmain = "main.tex"\n');
  const main = path.join(root, "main.tex");
  assert.equal(resolvePdfPath(detect(main, [root])), path.join(root, "build", "main.pdf"));
});

test("配方覆盖 output", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\nmain = "main.tex"\ndefault = "draft"\n\n[recipes.draft]\noutput = "build/draft"\n',
  );
  const main = path.join(root, "main.tex");
  assert.equal(resolvePdfPath(detect(main, [root])), path.join(root, "build", "draft", "main.pdf"));
});

test("配方覆盖 main", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\nmain = "main.tex"\ndefault = "draft"\n\n[recipes.draft]\nmain = "paper.tex"\n',
  );
  const main = path.join(root, "main.tex");
  assert.equal(resolvePdfPath(detect(main, [root])), path.join(root, "build", "paper.pdf"));
});

test("唯一配方即是默认", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\nmain = "main.tex"\n\n[recipes.release]\n',
  );
  const main = path.join(root, "main.tex");
  assert.equal(resolvePdfPath(detect(main, [root])), path.join(root, "build", "main.pdf"));
});

test("成员工程路径落在成员目录", (t) => {
  const root = makeRoot(t, '[workspace]\nmembers = ["paper"]\n');
  const paperDir = path.join(root, "paper");
  fs.mkdirSync(paperDir, { recursive: true });
  fs.writeFileSync(
    path.join(paperDir, "texmake.toml"),
    '[project]\nname = "paper"\nmain = "main.tex"\noutput = "out"\n',
  );
  fs.writeFileSync(path.join(paperDir, "main.tex"), "");
  const paperMain = path.join(paperDir, "main.tex");
  assert.equal(resolvePdfPath(detect(paperMain, [root])), path.join(root, "paper", "out", "main.pdf"));
});

test("缺 main 返回 undefined", (t) => {
  const root = makeRoot(t, '[project]\nname = "t"\n');
  const main = path.join(root, "main.tex");
  assert.equal(resolvePdfPath(detect(main, [root])), undefined);
});

test("不可构建状态返回 undefined", () => {
  assert.equal(resolvePdfPath({ kind: "unlocated", reason: "x" }), undefined);
});
