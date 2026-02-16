/**
 * @file packages/core/src/logic/worker/worker.ts
 * @stamp {"ts":"2026-02-16T20:45:00Z"}
 * @architectural-role Orchestrator / Worker Entry Point
 * @description
 * The primary entry point for the background worker thread. Acts as a stateless 
 * switchboard that routes task requests to specialized logic modules. Manages 
 * error handling and response serialization for the worker pool.
 *
 * @core-principles
 * 1. IS the routing layer for background computation.
 * 2. DELEGATES specialized tasks to single-purpose modules (Analyzer/Assembler).
 * 3. OWNS the lifecycle and communication protocol of the worker thread.
 *
 * @contract
 *   assertions:
 *     purity: side-effects # Interacts with worker message port.
 *     external_io: worker_port
 */

import { getEncoding } from 'js-tiktoken';
import type { WorkerTask, WorkerResult } from './types.js';
import { analyzeFile } from './fileAnalyzer.js';
import { assemblePack } from './packAssembler.js';

/**
 * Singleton instance of the Tiktoken BPE encoder within the worker scope.
 * cl100k_base is used for modern LLM compatibility (GPT-4/Claude 3).
 */
const tokenizer = getEncoding('cl100k_base');

/**
 * Global message listener for the worker thread.
 * Dispatches incoming tasks based on the TaskType.
 */
self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const { taskId, type, payload } = event.data;

  try {
    switch (type) {
      case 'ANALYZE_FILE': {
        if (!payload.path || payload.content === undefined) {
          throw new Error('Payload error: path and content are required for ANALYZE_FILE');
        }
        
        const metadata = analyzeFile(payload.path, payload.content);
        const response: WorkerResult = { taskId, payload: metadata };
        self.postMessage(response);
        break;
      }

      case 'ASSEMBLE_PACK': {
        if (!payload.assembly) {
          throw new Error('Payload error: assembly data is required for ASSEMBLE_PACK');
        }

        const result = await assemblePack(payload.assembly, tokenizer);
        const response: WorkerResult = { taskId, assembly: result };
        self.postMessage(response);
        break;
      }

      case 'INITIALIZE': {
        // Ping-back to confirm thread is responsive and modules loaded.
        self.postMessage({ taskId });
        break;
      }

      default:
        throw new Error(`Worker Error: Unknown task type "${type}"`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown fatal worker error';
    self.postMessage({
      taskId,
      error: errorMessage,
    });
  }
};