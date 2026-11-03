import { runWorker } from "./worker";
import cron from "node-cron";

let refreshInProgress = false;

/** Runs discovery and metric persistence without overlapping polling cycles. */
export async function refreshAllData(): Promise<void> {
    if (refreshInProgress) {
        console.warn("Ciclo anterior ainda em andamento; ignorando este disparo.");
        return;
    }

    refreshInProgress = true;
    try {
        await runWorker();
    } finally {
        refreshInProgress = false;
    }
}

// Optional one-minute scheduler for callers that do not use the server interval.
export function start() {
    return cron.schedule("*/1 * * * *", () => {
        void refreshAllData();
    });
}
