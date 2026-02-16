/**
 * @file packages/core/src/logic/symbolGraph/logUtils.ts
 * @stamp {"ts":"2026-02-16T12:45:00Z"}
 * @architectural-role Utility
 * @description
 * Provides a buffered logging mechanism that aggregates multiple log events into 
 * a single console transaction. This prevents the browser's console rendering 
 * engine from blocking the JavaScript execution thread during high-frequency 
 * operations like graph traversal.
 *
 * @core-principles
 * 1. IS a performance optimization for diagnostic output.
 * 2. ENFORCES the "Batching" pattern for I/O-adjacent operations.
 * 3. MUST minimize overhead during the message collection phase.
 *
 * @api-declaration
 *   export class LogBuffer {
 *     constructor(context: string);
 *     public push(msg: string): void;
 *     public flush(): void;
 *   }
 *
 * @contract
 *   assertions:
 *     purity: mutates # Maintains an internal buffer state.
 *     external_io: none # Interacts with the browser console only upon flush.
 */

/**
 * @id packages/core/src/logic/symbolGraph/logUtils.ts#LogBuffer
 * @description
 * Collects log messages in an internal array and outputs them as a single 
 * collapsed group to the console when requested.
 */
export class LogBuffer {
    private buffer: string[] = [];
    private readonly startTime: number;
  
    /**
     * Initializes a new buffer with a specific context label and timestamp.
     * @param context - The architectural context (e.g., 'Tracer', 'GraphBuilder').
     */
    constructor(private readonly context: string) {
      this.startTime = performance.now();
    }
  
    /**
     * Adds a message to the internal buffer. 
     * This is a low-cost O(1) operation.
     * 
     * @param msg - The diagnostic message to store.
     */
    public push(msg: string): void {
      this.buffer.push(msg);
    }
  
    /**
     * Consolidates the buffer and outputs it to the browser console.
     * Automatically calculates the total duration since initialization.
     */
    public flush(): void {
      const duration = (performance.now() - this.startTime).toFixed(2);
      
      if (this.buffer.length === 0) {
        return;
      }
  
      // Use console.groupCollapsed to keep the root log level clean 
      // while preserving all debug details.
      console.groupCollapsed(
        `[${this.context}] Processed ${this.buffer.length} events in ${duration}ms`
      );
      
      // Perform a single join and log to minimize thread contention with the UI.
      console.log(this.buffer.join('\n'));
      
      console.groupEnd();
      
      // Clear the buffer to allow for reuse if necessary.
      this.buffer = [];
    }
  }