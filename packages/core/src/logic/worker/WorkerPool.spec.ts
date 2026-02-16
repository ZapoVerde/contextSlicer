/**
 * @file packages/core/src/logic/worker/WorkerPool.spec.ts
 * @stamp {"ts":"2026-02-16T12:05:00Z"}
 * @test-target packages/core/src/logic/worker/WorkerPool.ts
 * @description
 * Unit tests for the WorkerPool orchestrator. Verifies concurrency management,
 * priority queuing, and task-to-worker correlation.
 *
 * @criticality 5. I/O & Concurrency Management.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { WorkerPool } from './WorkerPool.js';
import type { WorkerTask, WorkerResult } from './types.js';

const VALID_TEST_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Mock Worker implementation to simulate thread behavior in Node.js environment.
 */
class MockWorker {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public postMessage: Mock;
  public terminate: Mock;

  constructor() {
    this.postMessage = vi.fn((task: WorkerTask) => {
      // Simulate asynchronous worker response
      setTimeout(() => {
        if (this.onmessage) {
          const result: WorkerResult = {
            taskId: task.taskId,
            payload: {
              filePath: task.payload.path,
              symbols: [],
              hasReexports: false,
              hasLogicActivity: true,
              isBarrel: false,
            },
          };
          this.onmessage({ data: result } as MessageEvent);
        }
      }, 10);
    });
    this.terminate = vi.fn();
  }
}

describe('WorkerPool', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 });
    // Stable UUID for testing correlation - must match UUID template literal type
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(VALID_TEST_UUID as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should initialize with hardwareConcurrency - 1 workers by default', async () => {
    const pool = new WorkerPool();
    await pool.init();
    
    // 4 cores - 1 = 3 workers
    // @ts-expect-error - Accessing private for verification
    expect(pool.workers.length).toBe(3);
  });

  it('should dispatch tasks and resolve results', async () => {
    const pool = new WorkerPool(1);
    await pool.init();

    const result = await pool.execute('ANALYZE_FILE', { 
      path: 'src/test.ts', 
      content: 'export const a = 1;' 
    });

    expect(result.taskId).toBe(VALID_TEST_UUID);
    expect(result.payload?.filePath).toBe('src/test.ts');
  });

  it('should respect task priorities in the queue', async () => {
    // Force 1 worker to ensure a queue forms
    const pool = new WorkerPool(1);
    await pool.init();

    // Fill the worker immediately
    const p1 = pool.execute('ANALYZE_FILE', { path: 'busy.ts', content: '' });

    // Queue three more with different priorities
    const results: string[] = [];
    const p2 = pool.execute('ANALYZE_FILE', { path: 'low.ts', content: '' }, 'low')
      .then(() => results.push('low'));
    const p3 = pool.execute('ANALYZE_FILE', { path: 'high.ts', content: '' }, 'high')
      .then(() => results.push('high'));
    const p4 = pool.execute('ANALYZE_FILE', { path: 'normal.ts', content: '' }, 'normal')
      .then(() => results.push('normal'));

    await Promise.all([p1, p2, p3, p4]);

    // High priority should have finished before normal and low
    expect(results[0]).toBe('high');
    expect(results[1]).toBe('normal');
    expect(results[2]).toBe('low');
  });

  it('should handle worker execution errors gracefully', async () => {
    const pool = new WorkerPool(1);
    await pool.init();

    // Mock worker to return an error for this specific task
    // @ts-expect-error - Accessing private to manipulate mock behavior
    const worker = pool.workers[0] as unknown as MockWorker;
    worker.postMessage = vi.fn((task: WorkerTask) => {
      setTimeout(() => {
        worker.onmessage!({ 
          data: { taskId: task.taskId, error: 'Syntax Error' } 
        } as MessageEvent);
      }, 0);
    });

    await expect(pool.execute('ANALYZE_FILE', { path: 'fail.ts', content: '' }))
      .rejects.toThrow('Syntax Error');
  });

  it('should terminate all workers on pool termination', async () => {
    const pool = new WorkerPool(2);
    await pool.init();
    
    // @ts-expect-error - Accessing private
    const workers = [...pool.workers] as unknown as MockWorker[];
    
    pool.terminate();

    expect(workers[0].terminate).toHaveBeenCalled();
    expect(workers[1].terminate).toHaveBeenCalled();
    // @ts-expect-error - Accessing private
    expect(pool.workers.length).toBe(0);
  });
});