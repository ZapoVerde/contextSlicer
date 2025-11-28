
# Context Slicer Cheatsheet

This is a quick, goal-oriented guide to using the Context Slicer.

---

### **"How do I...**

#### **...get EVERYTHING in the repository?**

1.  Use the **Global Dumps** card at the bottom.
2.  Click **Download All as .zip** or **Download All as .txt**.

#### **...get the code for a specific feature?**

1.  Go to **Context Query Tools** -> **Seed: Dependency Trace**.
2.  Type the name of a key file from that feature (e.g., `useAuthStore.ts`).
3.  Set the **Hops** slider to `2` or `3` to find all related files.
4.  Click **Replace Pack**.

#### **...get all files in a specific folder?**

1.  Go to **Context Query Tools** -> **Inclusion Patterns**.
2.  Type a wildcard pattern: `src/features/auth/components/**/*`.
3.  Click **Append to Pack**.

#### **...create a high-level architectural summary for an AI?**

1.  First, select all the relevant files for your project using the methods above.
2.  In the **Targeted Pack Generator**, check the **`[x] Docblocks Only`** box.
3.  Click **Copy to Clipboard**.

#### **...make a file tree diagram for my documentation?**

1.  Select the files you want to include in the diagram.
2.  In the **Targeted Pack Generator**, check the **`[x] Tree Only`** box.
3.  Click **Copy Tree Only**.

#### **...combine multiple selections?**

*   Always use the **Append to Pack** button. Perform your first query, click Append, then perform your second query and click Append again.

#### **...remove test files from my selection?**

1.  Go to **Context Query Tools** -> **Exclusion Patterns**.
2.  Type a pattern to match your test files, e.g., `**/*.test.ts`.
3.  Generate your pack. The exclusion pattern will be applied automatically.

#### **...change the tool's behavior or add a new Preset button?**

1.  Open the single source of truth for all rules: `/packages/context-slicer-app/public/slicer-config.yaml`.
2.  **To add a Preset:** Copy an existing preset block under the `presets:` section and edit its `id`, `name`, `summary`, and `patterns`.
3.  **To change sanitation rules:** Edit the lists under the `sanitation:` section to add a new file type or ignore a new directory.
4.  Restart your development server and refresh the Slicer application to see your changes.