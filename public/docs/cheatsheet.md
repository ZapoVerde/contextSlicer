# Context Slicer Cheatsheet

This is a quick, goal-oriented guide to using the Context Slicer.

---

### **"How do I...**

#### **...get EVERYTHING in the repository?**

1.  Use the **Global Dumps** card at the top.
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

#### **...quickly add all the architecture documents?**

1.  Go to **Context Query Tools** -> **Include Docs Folders**.
2.  Check the boxes for `architecture`, `design`, etc.
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