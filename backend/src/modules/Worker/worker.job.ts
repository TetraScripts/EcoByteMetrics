import { runWorker } from "./worker";
import { COLLECTION_INTERVAL_MS, collectMonitoring } from "../Monitoring/collector";
import cron from 'node-cron';

let refreshInProgress = false;

/** Runs discovery and metric persistence without overlapping polling cycles. */
export async function refreshAllData(): Promise<void> {
    if (refreshInProgress) {
        console.warn("Ciclo anterior ainda em andamento; ignorando este disparo.");
        return;
    }
    refreshInProgress = true;
    try {
        runWorker();
        collectMonitoring();
    } finally {
        refreshInProgress = false;
    }
    
}

export function start() {
    return setInterval(() => {
        void refreshAllData().catch(() => console.error("Falha na coleta; os últimos dados gravados foram preservados."));
    }, COLLECTION_INTERVAL_MS);
}
