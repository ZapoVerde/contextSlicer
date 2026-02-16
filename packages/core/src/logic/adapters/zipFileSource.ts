/**
 * @file packages/core/src/logic/adapters/zipFileSource.ts
 * @stamp {"ts":"2026-02-16T11:10:00Z"}
 * @architectural-role Data Adapter
 *
 * @description
 * A concrete implementation of the `FileSource` interface for in-memory JSZip objects.
 * It supports "Volatile Configuration," allowing the user to change sanitation rules
 * dynamically in the browser session without modifying the original Zip file.
 *
 * @core-principles
 * 1. IS the adapter for "Web Mode" or "Manual Upload Mode".
 * 2. ENFORCES sanitation rules (denylists, extensions) dynamically.
 * 3. COMPATIBILITY: Implements the push notification interface as a no-op for static data.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Maintains internal state (zip object and volatile config).
 *     state_ownership: [zip, zipConfig, volatileConfig]
 *     external_io: none # Reads from memory.
 */

import JSZip from 'jszip';
import ignore from 'ignore';
import yaml from 'js-yaml';
import type { FileSource, FileMetadata, FileEvent } from '../../types/fileSource.js';
import type { SlicerConfig } from '../../state/slicer-state.js';
import { ACCEPTED_FILE_EXTENSIONS, EXPLICIT_DENY_PATTERNS } from '../../config/sanitation.config.js';

/**
 * @id packages/core/src/logic/adapters/zipFileSource.ts#ZipFileSource
 * @description
 * Adapter for handling static ZIP archives as project sources.
 */
export class ZipFileSource implements FileSource {
  private zip: JSZip | null = null;
  private file: File;
  private zipConfig: SlicerConfig | null = null;
  private volatileConfig: SlicerConfig | null = null;

  constructor(file: File) {
    this.file = file;
  }

  /**
   * Updates the in-memory configuration for the current session.
   */
  async saveConfig(config: SlicerConfig): Promise<void> {
    this.volatileConfig = config;
    return Promise.resolve();
  }

  private async init() {
    if (this.zip) return;
    this.zip = await JSZip.loadAsync(this.file);
    
    const configPath = this.findConfigPath();
    if (configPath) {
      const configText = await this.zip.file(configPath)?.async('text');
      if (configText) {
        try {
          this.zipConfig = yaml.load(configText) as SlicerConfig;
        } catch (e) {
          console.warn('[ZipFileSource] Failed to parse config from zip', e);
        }
      }
    }
  }

  private findConfigPath(): string | undefined {
    if (!this.zip) return undefined;
    const candidates = ['slicer-config.yaml', 'public/slicer-config.yaml', '.slicer/config.yaml'];
    return candidates.find(path => this.zip!.file(path));
  }

  async getConfig(): Promise<SlicerConfig> {
    await this.init();

    if (this.volatileConfig) {
      return this.volatileConfig;
    }

    return this.zipConfig || {
      version: 1,
      project: { targetProjectRoot: '.' },
      sanitation: { 
        maxUploadSizeMb: 200, 
        acceptedExtensions: ACCEPTED_FILE_EXTENSIONS, 
        denyPatterns: EXPLICIT_DENY_PATTERNS 
      },
      presets: [],
      sanitationOverrides: { mandatoryInclusions: [] },
      output: { beginMarker: '@@FILE: ', endMarker: '@@END_FILE@@' },
      liveDevelopment: { watchDebounceMs: 5000, staleRefetchDelayMs: 5000 }
    };
  }

  async getFileList(): Promise<FileMetadata[]> {
    await this.init();
    if (!this.zip) throw new Error('Zip failed to initialize');

    const config = await this.getConfig();
    const ig = (ignore as any)().add(config.sanitation.denyPatterns);
    const acceptedExts = new Set(config.sanitation.acceptedExtensions);
    const hasExtensionFilter = acceptedExts.size > 0;
    
    const results: FileMetadata[] = [];

    const filePaths = Object.keys(this.zip.files).filter(p => !this.zip!.files[p].dir);
    let commonBase = '';
    if (filePaths.length > 0) {
      const first = filePaths[0].split('/')[0] + '/';
      if (filePaths.every(p => p.startsWith(first))) {
        commonBase = first;
      }
    }

    for (const fullPath of filePaths) {
      const entry = this.zip.files[fullPath];
      const relativePath = fullPath.substring(commonBase.length); 

      if (ig.ignores(relativePath)) continue;

      if (hasExtensionFilter) {
        const ext = relativePath.split('.').pop()?.toLowerCase();
        if (ext && !acceptedExts.has(ext)) {
           if (!acceptedExts.has(relativePath.split('/').pop()?.toLowerCase() || '')) continue;
        }
      }

      results.push({
        path: relativePath,
        size: (entry as any)._data?.uncompressedSize || 0
      });
    }

    return results;
  }

  async getFileContent(path: string): Promise<string> {
    await this.init();
    const fullPath = this.findFullPath(path);
    if (!fullPath) throw new Error(`File not found: ${path}`);
    return this.zip!.file(fullPath)!.async('text');
  }

  async getFileBuffer(path: string): Promise<Uint8Array> {
    await this.init();
    const fullPath = this.findFullPath(path);
    if (!fullPath) throw new Error(`File not found: ${path}`);
    return this.zip!.file(fullPath)!.async('uint8array');
  }

  private findFullPath(relativePath: string): string | undefined {
    if (!this.zip) return undefined;
    const filePaths = Object.keys(this.zip.files);
    if (this.zip.file(relativePath)) return relativePath;
    return filePaths.find(p => p.endsWith(relativePath));
  }

  /**
   * No-op implementation for static Zip sources.
   */
  onWatcherEvent(_callback: (event: FileEvent) => void): void {
    // Zip files are immutable snapshots; no events are ever emitted.
  }
}