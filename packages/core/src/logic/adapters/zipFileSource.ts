/**
 * @file packages/core/src/logic/adapters/zipFileSource.ts
 * @stamp {"ts":"2025-11-28T13:00:00Z"}
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
 * 3. SUPPORTS configuration overrides via ephemeral in-memory state.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Maintains internal state (zip object and volatile config).
 *     state_ownership: [zip, config, volatileConfig]
 *     external_io: none # Reads from memory.
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
  // The config found INSIDE the zip file (static)
  private zipConfig: SlicerConfig | null = null;
  // The config modified by the user in the UI (volatile)
  private volatileConfig: SlicerConfig | null = null;

  constructor(file: File) {
    this.file = file;
  }

  /**
   * Updates the in-memory configuration.
   * This triggers a "re-filter" of the existing zip content in the next getFileList call.
   */
  async saveConfig(config: SlicerConfig): Promise<void> {
    console.log('[ZipFileSource] Updating volatile configuration.');
    this.volatileConfig = config;
    return Promise.resolve();
  }

  /**
   * Initialize the zip and extract the config if present.
   */
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

  /**
   * Returns the active configuration.
   * Priority: Volatile (User Edits) > Zip (File) > Defaults.
   */
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
    
    // Initialize ignore engine with the ACTIVE config
    const ig = ignore().add(config.sanitation.denyPatterns);
    
    // Handle Extension Whitelist
    // If acceptedExtensions is null/empty in config (rare), fall back to defaults or allow all?
    // We stick to the config. If the user clears it, we might show nothing, which is correct behavior.
    const acceptedExts = new Set(config.sanitation.acceptedExtensions);
    const hasExtensionFilter = acceptedExts.size > 0;
    
    const results: FileMetadata[] = [];

    // Detect base folder
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

      // 1. Pattern Check
      if (ig.ignores(relativePath)) continue;

      // 2. Extension Check
      if (hasExtensionFilter) {
        const ext = relativePath.split('.').pop()?.toLowerCase();
        // Check if extension is allowed. 
        // Also allow dotfiles (like .gitignore) if they are explicitly in the list or if the list is permissive.
        // Logic: If it has an extension, check it. If no extension (Makefile), keep it? 
        // For safety in web mode, we usually strictly filter by extension.
        if (ext && !acceptedExts.has(ext)) {
           // Edge case: Allow specific dotfiles if explicitly whitelisted (e.g. 'gitignore')
           // otherwise skip.
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
}