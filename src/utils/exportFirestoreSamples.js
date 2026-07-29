// Kept as a compatibility wrapper for older imports.
import { createSystemBackup, downloadBackupFile } from "../services/systemBackupService";

export const exportFirestoreSamples = async () => {
  const backup = await createSystemBackup();
  downloadBackupFile(backup);
  return backup;
};
