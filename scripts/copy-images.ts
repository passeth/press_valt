/**
 * Prebuild script: Copy Obsidian images to Next.js public directory.
 *
 * Source:  content/_assets/images/*
 * Target:  public/images/content/*
 *
 * Next.js serves public/ as static files, so images become
 * accessible at /images/content/{filename}.
 */
import fs from "fs";
import path from "path";

const SRC_DIR = path.join(process.cwd(), "content", "_assets", "images");
const DEST_DIR = path.join(process.cwd(), "public", "images", "content");

function copyImages(): void {
  // Ensure source exists
  if (!fs.existsSync(SRC_DIR)) {
    console.log("[copy-images] No source directory found at", SRC_DIR);
    console.log("[copy-images] Skipping image copy.");
    return;
  }

  // Create destination recursively
  fs.mkdirSync(DEST_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR);
  let copied = 0;

  for (const file of files) {
    const srcPath = path.join(SRC_DIR, file);
    const destPath = path.join(DEST_DIR, file);

    // Only copy files (skip subdirectories)
    if (!fs.statSync(srcPath).isFile()) continue;

    // Skip if destination is newer or same
    if (fs.existsSync(destPath)) {
      const srcStat = fs.statSync(srcPath);
      const destStat = fs.statSync(destPath);
      if (destStat.mtimeMs >= srcStat.mtimeMs) continue;
    }

    fs.copyFileSync(srcPath, destPath);
    copied++;
  }

  console.log(
    `[copy-images] ${copied} image(s) copied, ${files.length} total in source.`
  );
}

copyImages();
