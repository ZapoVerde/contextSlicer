/**
 * @file packages/desktop/client/logic/adapters/apiFileSource.ts
 * @stamp 2025-11-24T16:40:00Z
 * @architectural-role Data Adapter
 * @description
 * A concrete implementation of FileSource that talks to the local Express API.
 *
 * @core-principles
 * 1. IS the bridge between the Desktop UI and the Local Server.
 * 2. IMPLEMENTS the standard FileSource interface.
 * 3. HANDLES network errors and formatting.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Network I/O.
 *     external_io: http # Fetches from relative /api.
 */

import type { FileSource, FileMetadata, SlicerConfig } from '@slicer/core';

const API_BASE = '/api';

export class ApiFileSource implements FileSource {
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
    const files = await res.json();
    return files as FileMetadata[];
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
}