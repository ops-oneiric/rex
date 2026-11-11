export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/db/migrate");
    runMigrations();
    const { startBackupScheduler } = await import("./lib/backups/service");
    startBackupScheduler();
  }
}
