import { spawn, type ChildProcess } from "node:child_process";

/** 一次构建的最终结果。 */
export interface BuildOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
  cancelled: boolean;
  spawnError?: string;
}

/** 启动一次构建所需的参数。 */
export interface RunOptions {
  executable: string;
  args: readonly string[];
  cwd: string;
  onData: (chunk: string) => void;
  killGraceMs?: number;
}

const DEFAULT_KILL_GRACE_MS = 2000;

interface Execution {
  child?: ChildProcess;
  cancelled: boolean;
  exited: boolean;
  completed: boolean;
  graceMs: number;
  graceTimer?: NodeJS.Timeout;
  groupKill: boolean;
  complete: (outcome: BuildOutcome) => void;
  done: Promise<BuildOutcome>;
}

/**
 * 串行执行 texmake 子进程。
 *
 * 同一时刻只保留一个进程：`run` 期间再次调用会先按取消路径结束旧进程，
 * 旧的 Promise 以 `cancelled: true` 结算。取消先发 SIGTERM，宽限期后
 * 仍未退出则发 SIGKILL，避免残留孙进程。
 */
export class Runner {
  private current: Execution | undefined;

  get running(): boolean {
    return this.current !== undefined;
  }

  run(options: RunOptions): Promise<BuildOutcome> {
    const previous = this.current;
    if (previous) {
      previous.cancelled = true;
      this.terminate(previous);
      this.finish(previous, {
        code: previous.child?.exitCode ?? null,
        signal: previous.child?.signalCode ?? null,
        cancelled: true,
      });
    }

    const execution = this.start(options);
    // spawn 同步抛错时 execution 已结算，不应再占用 current。
    if (!execution.completed) this.current = execution;
    return execution.done;
  }

  cancel(): void {
    const execution = this.current;
    if (!execution) return;
    execution.cancelled = true;
    this.terminate(execution);
  }

  private start(options: RunOptions): Execution {
    let complete!: (outcome: BuildOutcome) => void;
    const done = new Promise<BuildOutcome>((resolve) => {
      complete = resolve;
    });
    const execution: Execution = {
      cancelled: false,
      exited: false,
      completed: false,
      graceMs: options.killGraceMs ?? DEFAULT_KILL_GRACE_MS,
      groupKill: process.platform !== "win32",
      complete,
      done,
    };

    let child: ChildProcess;
    try {
      child = spawn(options.executable, [...options.args], {
        cwd: options.cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        // 独立进程组：取消时向整组发信号，连孙进程一起结束。
        detached: execution.groupKill,
      });
    } catch (error) {
      this.finish(execution, {
        code: null,
        signal: null,
        cancelled: false,
        spawnError: error instanceof Error ? error.message : String(error),
      });
      return execution;
    }
    execution.child = child;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => options.onData(chunk));
    child.stderr?.on("data", (chunk: string) => options.onData(chunk));

    child.on("error", (error: Error) => {
      this.finish(execution, {
        code: null,
        signal: null,
        cancelled: execution.cancelled,
        spawnError: error.message,
      });
    });

    child.on("exit", () => {
      execution.exited = true;
      this.clearGraceTimer(execution);
    });

    // `close` 在 stdio 关闭后触发，确保输出已全部转交 onData 再结算。
    child.on("close", (code, signal) => {
      execution.exited = true;
      this.finish(execution, {
        code,
        signal,
        cancelled: execution.cancelled,
      });
    });

    return execution;
  }

  private terminate(execution: Execution): void {
    if (execution.exited) return;
    this.signal(execution, "SIGTERM");
    if (execution.graceTimer || execution.exited) return;

    const timer = setTimeout(() => {
      execution.graceTimer = undefined;
      if (!execution.exited) this.signal(execution, "SIGKILL");
    }, execution.graceMs);
    timer.unref();
    execution.graceTimer = timer;
  }

  private signal(execution: Execution, signal: NodeJS.Signals): void {
    const child = execution.child;
    const pid = child?.pid;
    if (!child || pid === undefined) return;
    try {
      if (execution.groupKill) {
        process.kill(-pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      try {
        child.kill(signal);
      } catch {
        // 进程已经退出。
      }
    }
  }

  private finish(execution: Execution, outcome: BuildOutcome): void {
    if (execution.completed) return;
    execution.completed = true;
    // 进程仍存活时保留 SIGKILL 升级定时器（替换旧进程后可能仍需升级），
    // 真正退出时由 exit 处理器清掉。
    if (execution.exited) this.clearGraceTimer(execution);
    if (this.current === execution) this.current = undefined;
    execution.complete(outcome);
  }

  private clearGraceTimer(execution: Execution): void {
    if (!execution.graceTimer) return;
    clearTimeout(execution.graceTimer);
    execution.graceTimer = undefined;
  }
}
