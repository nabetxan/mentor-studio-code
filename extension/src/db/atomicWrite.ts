import { randomBytes } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function atomicWriteFile(
  targetPath: string,
  data: Buffer,
): Promise<void> {
  const tempName = `.tmp-${basename(targetPath)}-${randomBytes(6).toString("hex")}`;
  const tempPath = join(dirname(targetPath), tempName);
  try {
    await writeFile(tempPath, data);
    await rename(tempPath, targetPath);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw err;
  }
}
