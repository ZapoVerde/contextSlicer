/**
 * @file src/features/sourceDump/logic/fileTreeUtils.ts
 * @architectural-role Logic Utility / Text Formatter
 *
 * @description This module provides a standalone utility function for generating a
 * Markdown-formatted, ASCII-style file tree from a list of file paths.
 *
 * @responsibilities
 * 1.  **Tree Generation:** It takes a flat array of file paths and internally
 *     constructs a hierarchical tree data structure representing the directory
 *     and file relationships.
 * 2.  **Text Formatting:** It recursively traverses the internal tree structure to
 *     build a string representation, using box-drawing characters (└──, ├──, │)
 *     to create a visually clear and aesthetically pleasing tree.
 * 3.  **Markdown Wrapping:** The final output is wrapped in a ```text code block,
 *     ensuring it is rendered correctly when pasted into Markdown-aware
 *     applications or language model prompts.
 *
 * @purpose This utility is used by the `TargetedPackPanel` to create the optional
 * file tree preamble, which adds valuable context to the exported source pack.
 */

interface FsNode {
  [key: string]: FsNode | null;
}

/**
 * Generates a Markdown-formatted ASCII file tree from a list of file paths.
 * @param paths - An array of fully qualified file paths.
 * @returns A string representing the file tree, wrapped in a ```text code block.
 */
export function generateFileTree(paths: string[]): string {
  const root: FsNode = {};

  // Build the hierarchical tree structure from the flat list of paths.
  for (const path of paths) {
    const parts = path.split('/');
    let currentNode = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (currentNode[part] === undefined) {
        // If it's the last part, it's a file (null), otherwise a directory ({}).
        currentNode[part] = i === parts.length - 1 ? null : {};
      }
      // Move down the tree if it's a directory.
      if (currentNode[part] !== null) {
        currentNode = currentNode[part] as FsNode;
      }
    }
  }

  // Recursively build the string representation of the tree.
  const buildTreeString = (node: FsNode, prefix = ''): string => {
    let result = '';
    const entries = Object.keys(node).sort();
    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${entry}\n`;

      const childNode = node[entry];
      if (childNode) {
        // It's a directory, so recurse.
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        result += buildTreeString(childNode, childPrefix);
      }
    });
    return result;
  };

  const tree = buildTreeString(root);
  return `\`\`\`text\n${tree.trimEnd()}\n\`\`\``;
}