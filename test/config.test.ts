import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detect } from "../src/detect";
import { projectConfig } from "../src/config";

/** 建临时工程根目录，写入 texmake.toml 与一个空的 main.tex。 */
function makeRoot(t: TestContext, toml: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "texmake-config-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "texmake.toml"), toml);
  fs.writeFileSync(path.join(root, "main.tex"), "");
  return root;
}

/** 对根目录中的 main.tex 做判定，再读取该工程的配方配置。 */
function configFor(root: string) {
  return projectConfig(detect(path.join(root, "main.tex"), [root]));
}

test("多配方按文件内顺序返回", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\n\n[recipes.release]\n\n[recipes.draft]\n\n[recipes.debug]\n',
  );
  assert.deepEqual(configFor(root), {
    recipes: ["release", "draft", "debug"],
    defaultRecipe: undefined,
  });
});

test("整数样式的配方名仍按文件内顺序返回", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\n\n[recipes.release]\n\n[recipes.2024]\n\n[recipes.draft]\n',
  );
  assert.deepEqual(configFor(root)?.recipes, ["release", "2024", "draft"]);
});

test("[recipes] 内联表也按出现顺序返回", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\n\n[recipes]\n"my recipe" = { main = "a.tex" }\nother = {}\n',
  );
  assert.deepEqual(configFor(root)?.recipes, ["my recipe", "other"]);
});

test("唯一配方是隐式默认", (t) => {
  const root = makeRoot(t, '[project]\nname = "t"\n\n[recipes.release]\n');
  assert.deepEqual(configFor(root), {
    recipes: ["release"],
    defaultRecipe: "release",
  });
});

test("显式 default 优先", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\ndefault = "draft"\n\n[recipes.release]\n\n[recipes.draft]\n',
  );
  assert.equal(configFor(root)?.defaultRecipe, "draft");
});

test("default 指向不存在的配方时不给默认", (t) => {
  const root = makeRoot(
    t,
    '[project]\nname = "t"\ndefault = "ghost"\n\n[recipes.draft]\n',
  );
  assert.deepEqual(configFor(root), {
    recipes: ["draft"],
    defaultRecipe: undefined,
  });
});

test("没有 [recipes] 表时配方为空", (t) => {
  const root = makeRoot(t, '[project]\nname = "t"\n');
  assert.deepEqual(configFor(root), { recipes: [], defaultRecipe: undefined });
});

test("workspace 成员读取成员自己的 texmake.toml", (t) => {
  const root = makeRoot(t, '[workspace]\nmembers = ["paper"]\n\n[recipes.root]\n');
  const paperDir = path.join(root, "paper");
  fs.mkdirSync(paperDir, { recursive: true });
  fs.writeFileSync(
    path.join(paperDir, "texmake.toml"),
    '[project]\nname = "paper"\n\n[recipes.alpha]\n\n[recipes.beta]\n',
  );
  fs.writeFileSync(path.join(paperDir, "main.tex"), "");

  const detected = detect(path.join(paperDir, "main.tex"), [root]);
  assert.equal(detected.kind, "member");
  assert.deepEqual(projectConfig(detected), {
    recipes: ["alpha", "beta"],
    defaultRecipe: undefined,
  });
});

test("不可构建状态返回 undefined", () => {
  assert.equal(projectConfig({ kind: "unlocated", reason: "x" }), undefined);
  assert.equal(projectConfig({ kind: "config-error", root: "/w", reason: "x" }), undefined);
  assert.equal(
    projectConfig({ kind: "member-error", root: "/w", memberDir: "/w/p", reason: "x" }),
    undefined,
  );
});

test("坏 TOML 判为 config-error 并返回 undefined", (t) => {
  const root = makeRoot(t, "[project\nname = ");
  const detected = detect(path.join(root, "main.tex"), [root]);
  assert.equal(detected.kind, "config-error");
  assert.equal(projectConfig(detected), undefined);
});

test("成员缺少 texmake.toml 判为 member-error 并返回 undefined", (t) => {
  const root = makeRoot(t, '[workspace]\nmembers = ["paper"]\n');
  const paperDir = path.join(root, "paper");
  fs.mkdirSync(paperDir, { recursive: true });
  fs.writeFileSync(path.join(paperDir, "main.tex"), "");
  const detected = detect(path.join(paperDir, "main.tex"), [root]);
  assert.equal(detected.kind, "member-error");
  assert.equal(projectConfig(detected), undefined);
});

test("配置文件读取失败返回 undefined 而不抛异常", (t) => {
  const root = makeRoot(t, '[project]\nname = "t"\n\n[recipes.draft]\n');
  const detected = detect(path.join(root, "main.tex"), [root]);
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(projectConfig(detected), undefined);
});

test("[recipes] 不是表时视为配置无效", (t) => {
  const root = makeRoot(t, 'recipes = "nope"\n\n[project]\nname = "t"\n');
  assert.equal(configFor(root), undefined);
});
