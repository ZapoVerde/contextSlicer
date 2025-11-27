/**
 * @file packages/core/src/logic/adapters/zipFileSource.ts
 * @stamp {"ts":"2025-11-24T11:30:00Z"}
 * @architectural-role Data Adapter
 *
 * @description
 * A concrete implementation of the `FileSource` interface that reads from an
 * in-memory `JSZip` object. It bridges the browser's File API with the
 * application's abstract data requirements.
 *
 * @core-principles
 * 1. IS the adapter for "Web Mode" or "Manual Upload Mode".
 * 2. ENFORCES the configured sanitation rules (denylists, extensions) during ingestion.
 * 3. DECOUPLES the raw zip structure from the application's file index.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Maintains internal zip state.
 *     state_ownership: none
 *     external_io: none # Reads from memory (File object).
 */

import JSZip from 'jszip';
import ignore from 'ignore';
import yaml from 'js-yaml';
import type { FileSource, FileMetadata } from '../../types/fileSource';
import type { SlicerConfig } from '../../state/slicer-state';
import { ACCEPTED_FILE_EXTENSIONS, EXPLICIT_DENY_PATTERNS } from '../../config/sanitation.config';

export class ZipFileSource implements FileSource {
  private zip: JSZip | null = null;
  private file: File;
  private config: SlicerConfig | null = null;

  constructor(file: File) {
    this.file = file;
  }

  async saveConfig(config: SlicerConfig): Promise<void> {
    console.warn('[ZipFileSource] Save not supported for Zip files. Config is ephemeral.');
    // We do nothing here. The optimistic update in the store will allow the
    // user to play with settings for the current session, but it won't save to the zip.
    return Promise.resolve();
  }

  /**
   * Initialize the zip and extract the config if present.
   * This must be called before getFileList.
   */
  private async init() {
    if (this.zip) return;
    this.zip = await JSZip.loadAsync(this.file);
    
    // Try to load config from the zip root or common locations
    const configPath = this.findConfigPath();
    if (configPath) {
      const configText = await this.zip.file(configPath)?.async('text');
      if (configText) {
        try {
          this.config = yaml.load(configText) as SlicerConfig;
        } catch (e) {
          console.warn('Failed to parse config from zip', e);
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
    // Return found config or a minimal default if missing
    return this.config || {
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
    const ig = ignore().add(config.sanitation.denyPatterns);
    const acceptedExts = new Set(config.sanitation.acceptedExtensions);
    
    const results: FileMetadata[] = [];

    // Detect base folder (e.g., if zip is wrapped in "my-repo-main/")
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
      const relativePath = fullPath.substring(commonBase.length); // Strip base folder

      if (ig.ignores(relativePath)) continue;

      // Basic extension check
      const ext = relativePath.split('.').pop()?.toLowerCase();
      if (ext && !acceptedExts.has(ext)) {
         // Allow dotfiles like .gitignore if explicitly accepted, otherwise skip
         if (!acceptedExts.has(relativePath.split('/').pop()?.toLowerCase() || '')) continue;
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
    // We need to re-find the full path including the common base
    // This is a simplification; a robust version would map relative->absolute in getFileList
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
    // Naive check: if common base exists, prepend it
    const filePaths = Object.keys(this.zip.files);
    // Try exact match
    if (this.zip.file(relativePath)) return relativePath;
    // Try finding it via suffix (risky but handles the base folder issue)
    return filePaths.find(p => p.endsWith(relativePath));
  }
}