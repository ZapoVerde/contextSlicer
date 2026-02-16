/**
 * @file packages/desktop/client/logic/adapters/apiFileSource.ts
 * @stamp {"ts":"2026-02-16T16:20:00Z"}
 * @architectural-role Data Adapter
 * @description
 * A concrete implementation of FileSource that communicates with the local 
 * Express API and establishes a WebSocket connection for real-time filesystem 
 * events.
 *
 * @core-principles
 * 1. IS the bridge between the Desktop UI and the Local Server.
 * 2. IMPLEMENTS the standard FileSource interface with push support.
 * 3. OWNS the WebSocket connection lifecycle and event bridging.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Network I/O and stateful WebSocket.
 *     external_io: [http, ws]
 */

import type { FileSource, FileMetadata, SlicerConfig, FileEvent } from '@slicer/core';

const API_BASE = '/api';

/**
 * @id packages/desktop/client/logic/adapters/apiFileSource.ts#ApiFileSource
 * @description
 * Handles data retrieval via HTTP and real-time notifications via WebSocket.
 */
export class ApiFileSource implements FileSource {
  private ws: WebSocket | null = null;
  private eventCallback: ((event: FileEvent) => void) | null = null;

  constructor() {
    this.connectWebSocket();
  }

  /**
   * Establishes the WebSocket connection to the server for push notifications.
   * Includes simple retry logic for robustness.
   */
  private connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/`;

    console.log(`[ApiFileSource] Connecting to watcher at: ${wsUrl}`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as FileEvent;
        if (this.eventCallback) {
          this.eventCallback(data);
        }
      } catch (e) {
        console.error('[ApiFileSource] Failed to parse watcher message', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('[ApiFileSource] Watcher connection lost. Retrying in 5s...');
      setTimeout(() => this.connectWebSocket(), 5000);
    };

    this.ws.onerror = (err) => {
      console.error('[ApiFileSource] Watcher WebSocket Error:', err);
    };
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

  async getFileList(): Promise<FileMetadata[]> {
    const res = await fetch(`${API_BASE}/files`);
    if (!res.ok) throw new Error('Failed to fetch file list');
    return res.json() as Promise<FileMetadata[]>;
  }

  async getFileContent(path: string): Promise<string> {
    const res = await fetch(`${API_BASE}/file/${path}`);
    if (!res.ok) throw new Error(`Failed to fetch file: ${path}`);
    return res.text();
  }

  async getFileBuffer(path: string): Promise<Uint8Array> {
    const res = await fetch(`${API_BASE}/file/${path}`);
    if (!res.ok) throw new Error(`Failed to fetch file buffer: ${path}`);
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Registers a subscriber for filesystem events.
   */
  onWatcherEvent(callback: (event: FileEvent) => void): void {
    this.eventCallback = callback;
  }
}