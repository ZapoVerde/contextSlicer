/**
 * @file packages/desktop/client/logic/adapters/apiFileSource.ts
 * @stamp {"ts":"2026-02-16T22:30:00Z"}
 * @architectural-role Data Adapter
 * @description
 * A high-performance implementation of FileSource that utilizes the "Bulk Loading"
 * pattern. It pre-hydrates a local memory cache with the entire repository's
 * textual content on startup, eliminating network latency during heavy analysis
 * phases (Graph Building, Pack Assembly).
 *
 * @core-principles
 * 1. ZERO LATENCY: MUST serve file content from memory after the initial bulk load.
 * 2. REAL-TIME SYNC: Updates the local cache immediately upon receiving watcher events.
 * 3. TRANSPARENCY: Implements the standard FileSource interface while hiding the caching layer.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Manages internal memory cache.
 *     external_io: [http, ws]
 */

import type { FileSource, FileMetadata, SlicerConfig, FileEvent } from '@slicer/core';

const API_BASE = '/api';

/**
 * @id packages/desktop/client/logic/adapters/apiFileSource.ts#ApiFileSource
 * @description
 * Concrete adapter for the Desktop environment with integrated bulk-caching.
 */
export class ApiFileSource implements FileSource {
  private ws: WebSocket | null = null;
  private eventCallback: ((event: FileEvent) => void) | null = null;
  
  /** 
   * Internal VFS (Virtual File System) to store pre-hydrated contents.
   * Key: relativePath, Value: textContent
   */
  private contentCache = new Map<string, string>();

  constructor() {
    this.connectWebSocket();
  }

  /**
   * Establishes the WebSocket connection for push notifications.
   * On 'change' or 'add' events, it proactively re-fetches the specific file
   * to keep the local memory cache in sync with the disk.
   */
  private connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/watcher-ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = async (msg) => {
        try {
          const data = JSON.parse(msg.data) as FileEvent;
          
          // CRITICAL: Sync memory cache before notifying UI
          if (data.type === 'unlink') {
            this.contentCache.delete(data.path);
          } else if (data.type === 'change' || data.type === 'add') {
            // Re-hydrate only the specific file that changed
            const freshContent = await this.fetchSingleFile(data.path);
            this.contentCache.set(data.path, freshContent);
          }

          if (this.eventCallback) {
            this.eventCallback(data);
          }
        } catch (e) {
          console.error('[ApiFileSource] Failed to process watcher sync:', e);
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (err) {
      console.error('[ApiFileSource] WebSocket initialization failed:', err);
    }
  }

  /**
   * Internal helper to fetch content for a single file (used for real-time sync).
   */
  private async fetchSingleFile(path: string): Promise<string> {
    const res = await fetch(`${API_BASE}/file/${path}`);
    if (!res.ok) return '';
    return res.text();
  }

  async getConfig(): Promise<SlicerConfig> {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  }

  async saveConfig(config: SlicerConfig): Promise<void> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save config');
  }

  /**
   * Performs the Bulk Hydration. 
   * Fetches every file's content in one request and populates the cache.
   */
  async getFileList(): Promise<FileMetadata[]> {
    console.log('[ApiFileSource] Initializing Bulk Hydration...');
    const res = await fetch(`${API_BASE}/bulk-files`);
    if (!res.ok) throw new Error('Failed to fetch bulk file snapshot');
    
    const bulkData = await res.json() as Record<string, string>;
    const metadata: FileMetadata[] = [];

    // Reset and populate cache
    this.contentCache.clear();
    
    for (const [path, content] of Object.entries(bulkData)) {
      this.contentCache.set(path, content);
      metadata.push({
        path,
        // Approximate size in bytes using UTF-8 length
        size: new TextEncoder().encode(content).length
      });
    }

    console.log(`[ApiFileSource] Hydration complete. Cached ${metadata.length} files.`);
    return metadata;
  }

  /**
   * INSTANT: Serves from local memory cache.
   */
  async getFileContent(path: string): Promise<string> {
    const cached = this.contentCache.get(path);
    if (cached !== undefined) return cached;
    
    // Fallback: fetch single if not in cache (unlikely)
    return this.fetchSingleFile(path);
  }

  /**
   * INSTANT: Converts cached text to bytes.
   */
  async getFileBuffer(path: string): Promise<Uint8Array> {
    const content = await this.getFileContent(path);
    return new TextEncoder().encode(content);
  }

  onWatcherEvent(callback: (event: FileEvent) => void): void {
    this.eventCallback = callback;
  }
}