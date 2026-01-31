# 🧠 Folder → Markdown (LLM-Ready Project Context Tool)

Convert an entire project folder into structured Markdown that is easy for Large Language Models (LLMs) to understand.

This tool is part of **Poor-Man’s Toolkits** — an open-source collection of small, practical utilities.

---

## 🚀 What This Tool Does

This app scans a folder and generates a single Markdown file that includes:

- 📁 The project’s **file and folder hierarchy**
- 📄 The **contents of relevant files**
- 🚫 Automatic filtering of unnecessary files using smart ignore rules

The result is a clean **project context document** that can be used directly with AI tools.

---

## 💡 Why This Is Useful

When working with AI on real codebases, raw folders contain too much noise:
- `node_modules`
- build folders
- binaries
- images
- system files

This tool removes that noise and produces a structured Markdown file that gives an LLM:

✔ Project structure  
✔ Important source files  
✔ Readable code blocks  
✔ Less irrelevant data  

Perfect for:
- Explaining a codebase to an AI
- Getting refactoring help
- Asking architecture questions
- Debugging with LLMs

---

## ✨ Features

- 📂 Select any project root folder
- 🧠 Smart default ignore rules (similar to `.gitignore`)
- ⚙️ Custom ignore patterns (wildcards supported: `*`)
- 🗂 Includes full folder/file hierarchy
- 🧾 Embeds file contents in Markdown code blocks
- 🚫 Skips binary files automatically
- 💾 Download result as a `.md` file
- 📋 One-click copy to clipboard
- 🔒 Runs fully in the browser (no uploads)

---

## 🛠 Default Ignored Items

The tool automatically filters common non-useful content such as:

