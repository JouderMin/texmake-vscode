import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { Runner } from "../src/runner";

const dir = mkdtempSync(path.join(tmpdir(), "texmake-runner-"));

function writeScript(name: string, body: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, body, "utf8");
  chmodSync(file, 0o755);
  return file;
}

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("透传输出与退出码", async () => {
  const ok = writeScript("ok.sh", "#!/bin/sh\necho hello\nexit 3\n");
  const chunks: string[] = [];
  const outcome = await new Runner().run({
    executable: ok,
    args: [],
    cwd: dir,
    onData: (chunk) => chunks.push(chunk),
  });
  assert.equal(outcome.code, 3);
  assert.equal(outcome.cancelled, false);
  assert.match(chunks.join(""), /hello/);
});

test("找不到可执行文件时报 spawnError", async () => {
  const outcome = await new Runner().run({
    executable: path.join(dir, "missing"),
    args: [],
    cwd: dir,
    onData: () => {},
  });
  assert.equal(outcome.code, null);
  assert.ok(outcome.spawnError);
});

test("取消后 2 s 内结束且不残留", async () => {
  const slow = writeScript("slow.sh", "#!/bin/sh\necho start\nsleep 10\necho done\n");
  const runner = new Runner();
  let started = false;
  const pending = runner.run({
    executable: slow,
    args: [],
    cwd: dir,
    onData: (chunk) => {
      if (chunk.includes("start")) started = true;
    },
  });
  while (!started) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runner.running, true);
  const startedAt = Date.now();
  runner.cancel();
  const outcome = await pending;
  assert.equal(outcome.cancelled, true);
  assert.ok(Date.now() - startedAt < 2000);
  assert.equal(runner.running, false);
});

test("构建中再次 run 时先结束旧进程", async () => {
  const slow = writeScript("slow2.sh", "#!/bin/sh\nsleep 10\n");
  const fast = writeScript("fast.sh", "#!/bin/sh\nexit 0\n");
  const runner = new Runner();
  const first = runner.run({ executable: slow, args: [], cwd: dir, onData: () => {} });
  const second = runner.run({ executable: fast, args: [], cwd: dir, onData: () => {} });
  assert.equal((await first).cancelled, true);
  assert.equal((await second).code, 0);
});
