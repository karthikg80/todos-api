import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const vendors = [
  {
    from: path.join(rootDir, "node_modules", "chrono-node", "dist", "esm"),
    to: path.join(rootDir, "public", "vendor", "chrono-node"),
  },
];

function copyDirFiltered(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) {
    throw new Error(`Vendor source not found: ${fromDir}`);
  }
  fs.rmSync(toDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.cpSync(fromDir, toDir, {
    recursive: true,
    filter: (src) => {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) return true;
      return src.endsWith(".js");
    },
  });
}

for (const vendor of vendors) {
  copyDirFiltered(vendor.from, vendor.to);
  const relativeTarget = path.relative(rootDir, vendor.to);
  console.log(`Synced vendor: ${relativeTarget}`);
}
