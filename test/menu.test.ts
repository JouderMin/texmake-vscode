import test from "node:test";
import assert from "node:assert/strict";
import { menuItems } from "../src/menu";

test("构建中只显示取消构建", () => {
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, true), [
    { id: "cancel", label: "取消构建", description: "停止当前 texmake 进程", icon: "debug-stop" },
  ]);
});

test("构建中即使处于错误态也只显示取消构建", () => {
  assert.deepEqual(menuItems({ kind: "config-error", root: "/w", reason: "坏配置" }, true), [
    { id: "cancel", label: "取消构建", description: "停止当前 texmake 进程", icon: "debug-stop" },
  ]);
});

test("项目模式提供编译与清理", () => {
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, false), [
    { id: "build", label: "编译", description: "构建 thesis", icon: "play" },
    { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
  ]);
});

test("成员模式提供编译与清理并带成员名", () => {
  assert.deepEqual(
    menuItems({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, false),
    [
      { id: "build", label: "编译", description: "构建 paper", icon: "play" },
      { id: "clean", label: "清理", description: "清理 paper 的辅助文件", icon: "trash" },
    ],
  );
});

test("配置错误只提供查看原因", () => {
  assert.deepEqual(menuItems({ kind: "config-error", root: "/w", reason: "缺少 [project]" }, false), [
    { id: "reason", label: "查看原因", description: "缺少 [project]", icon: "info" },
  ]);
});

test("成员配置错误只提供查看原因", () => {
  assert.deepEqual(
    menuItems(
      { kind: "member-error", root: "/w", memberDir: "/w/p", reason: "成员缺少 texmake.toml" },
      false,
    ),
    [{ id: "reason", label: "查看原因", description: "成员缺少 texmake.toml", icon: "info" }],
  );
});

test("未定位只提供查看原因", () => {
  assert.deepEqual(menuItems({ kind: "unlocated", reason: "未找到 texmake.toml" }, false), [
    { id: "reason", label: "查看原因", description: "未找到 texmake.toml", icon: "info" },
  ]);
});

test("构建中即使有配方配置也只显示取消构建", () => {
  const config = { recipes: ["release", "draft"], defaultRecipe: "release" };
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, true, config), [
    { id: "cancel", label: "取消构建", description: "停止当前 texmake 进程", icon: "debug-stop" },
  ]);
});

test("有默认配方时先给裸编译，其余配方逐个命名", () => {
  const config = { recipes: ["release", "draft", "fast"], defaultRecipe: "release" };
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, false, config), [
    { id: "build", label: "编译", description: "默认配方：release", icon: "play" },
    {
      id: "build",
      label: "编译（draft）",
      description: "用配方 draft 构建 thesis",
      icon: "play",
      recipe: "draft",
    },
    {
      id: "build",
      label: "编译（fast）",
      description: "用配方 fast 构建 thesis",
      icon: "play",
      recipe: "fast",
    },
    { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
  ]);
});

test("默认配方不在首位时按文件顺序列出其余配方，命名项不重复默认配方", () => {
  const config = { recipes: ["draft", "release"], defaultRecipe: "release" };
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, false, config), [
    { id: "build", label: "编译", description: "默认配方：release", icon: "play" },
    {
      id: "build",
      label: "编译（draft）",
      description: "用配方 draft 构建 thesis",
      icon: "play",
      recipe: "draft",
    },
    { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
  ]);
});

test("唯一配方且未标默认时只给裸编译", () => {
  assert.deepEqual(
    menuItems({ kind: "project", root: "/w", name: "thesis" }, false, { recipes: ["only"] }),
    [
      { id: "build", label: "编译", description: "构建 thesis", icon: "play" },
      { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
    ],
  );
});

test("多配方且无默认时不提供裸编译，只给命名项", () => {
  const config = { recipes: ["draft", "camera-ready"] };
  assert.deepEqual(menuItems({ kind: "project", root: "/w", name: "thesis" }, false, config), [
    {
      id: "build",
      label: "编译（draft）",
      description: "用配方 draft 构建 thesis",
      icon: "play",
      recipe: "draft",
    },
    {
      id: "build",
      label: "编译（camera-ready）",
      description: "用配方 camera-ready 构建 thesis",
      icon: "play",
      recipe: "camera-ready",
    },
    { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
  ]);
});

test("无配方配置时保持单项编译", () => {
  assert.deepEqual(
    menuItems({ kind: "project", root: "/w", name: "thesis" }, false, { recipes: [] }),
    [
      { id: "build", label: "编译", description: "构建 thesis", icon: "play" },
      { id: "clean", label: "清理", description: "清理 thesis 的辅助文件", icon: "trash" },
    ],
  );
});

test("成员模式按成员自己的配方生成编译项", () => {
  const config = { recipes: ["release", "draft"], defaultRecipe: "release" };
  assert.deepEqual(
    menuItems({ kind: "member", root: "/w", name: "paper", memberDir: "/w/paper" }, false, config),
    [
      { id: "build", label: "编译", description: "默认配方：release", icon: "play" },
      {
        id: "build",
        label: "编译（draft）",
        description: "用配方 draft 构建 paper",
        icon: "play",
        recipe: "draft",
      },
      { id: "clean", label: "清理", description: "清理 paper 的辅助文件", icon: "trash" },
    ],
  );
});
