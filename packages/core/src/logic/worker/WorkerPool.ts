/**
 * @file packages/core/src/logic/worker/WorkerPool.ts
 * @stamp {"ts":"2026-02-16T11:05:00Z"}
 * @architectural-role Orchestrator / Concurrency Manager
 * @description
 * Manages a persistent pool of Web Workers for background code analysis. 
 * Implements a priority queue to ensure user-initiated actions (like generating 
 * a pack) preempt background indexing tasks.
 *
 * @core-principles
 * 1. OWNS the concurrency limit strategy (hardwareConcurrency - 1).
 * 2. ENFORCES task prioritization (High > Normal > Low).
 * 3. MUST handle worker termination and correlation errors gracefully.
 *
 * @api-declaration
 *   export type TaskPriority = 'high' | 'normal' | 'low';
 *   export class WorkerPool { ... }
 *
 * @contract
 *   assertions:
 *     purity: mutates # Manages internal worker state and queues.
 *     state_ownership: [workers, taskQueue, idleWorkers]
 *     external_io: worker_messaging
 */

import type { WorkerTask, WorkerResult, TaskType } from './types.js';

export type TaskPriority = 'high' | 'normal' | 'low';

interface PendingTask {
  task: WorkerTask;
  priority: TaskPriority;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
}

const PRIORITY_MAP: Record<TaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export class WorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: PendingTask[] = [];
  private activeTasks = new Map<string, PendingTask>();
  private maxWorkers: number;
  private isInitialized = false;

  constructor(maxWorkers?: number) {
    // Leave one core for the UI thread if possible
    this.maxWorkers = maxWorkers ?? Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
  }

  /**
   * Initializes the pool by spawning workers and loading the analysis script.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    const workerPromises = Array.from({ length: this.maxWorkers }).map(() => this.createWorker());
    await Promise.all(workerPromises);

    this.isInitialized = true;
    console.log(`[WorkerPool] Initialized with ${this.workers.length} workers.`);
  }

  /**
   * Dispatches a task to the pool.
   * @param type The type of analysis to perform.
   * @param payload The file data.
   * @param priority Priority level (Higher priority tasks jump the queue).
   */
  public execute(
    type: TaskType,
    payload: WorkerTask['payload'],
    priority: TaskPriority = 'normal'
  ): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID();
      const task: WorkerTask = { taskId, type, payload };

      const pending: PendingTask = { task, priority, resolve, reject };

      this.taskQueue.push(pending);
      this.sortQueue();
      this.processQueue();
    });
  }

  private async createWorker(): Promise<void> {
    // Note: URL path is relative to this source file; Vite handles the resolution.
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const result = event.data;
      const pending = this.activeTasks.get(result.taskId);

      if (pending) {
        this.activeTasks.delete(result.taskId);
        if (result.error) {
          pending.reject(new Error(result.error));
        } else {
          pending.resolve(result);
        }
      }

      this.idleWorkers.push(worker);
      this.processQueue();
    };

    worker.onerror = (err) => {
      console.error('[WorkerPool] Worker Thread Error:', err);
    };

    this.workers.push(worker);
    this.idleWorkers.push(worker);
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }

    const worker = this.idleWorkers.shift()!;
    const pending = this.taskQueue.shift()!;

    this.activeTasks.set(pending.task.taskId, pending);
    worker.postMessage(pending.task);
  }

  private sortQueue(): void {
    this.taskQueue.sort((a, b) => PRIORITY_MAP[a.priority] - PRIORITY_MAP[b.priority]);
  }

  /**
   * Gracefully terminates all workers in the pool.
   */
  public terminate(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.isInitialized = false;
  }
}