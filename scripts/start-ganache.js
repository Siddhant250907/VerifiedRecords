/**
 * Background Ganache runner for VerifiedRecords local development.
 * Connects to the user's existing Ganache workspace chaindata if available,
 * or starts a local node on port 7545 with chainId 1337 and networkId 5777.
 */
const ganache = require("ganache");
const fs = require("fs");
const path = require("path");
const { Web3 } = require("web3");

async function checkPortRunning(port = 7545) {
    try {
        const web3 = new Web3(`http://127.0.0.1:${port}`);
        await web3.eth.getBlockNumber();
        return true;
    } catch (e) {
        return false;
    }
}

async function start() {
    const isRunning = await checkPortRunning(7545);
    if (isRunning) {
        console.log("[Ganache Runner] Ganache is already running on http://127.0.0.1:7545");
        return;
    }

    const settingsPath = "C:\\Users\\asati\\AppData\\Roaming\\Ganache\\ui\\workspaces\\Siddhant_s-Personal-Account-0\\Settings";
    let ganacheOpts = {
        server: { port: 7545, host: "127.0.0.1" },
        chain: { networkId: 5777, chainId: 1337 }
    };

    if (fs.existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
            if (settings.server) {
                ganacheOpts.wallet = {
                    mnemonic: settings.server.mnemonic,
                    defaultBalance: 100,
                    totalAccounts: 10
                };
                ganacheOpts.database = {
                    dbPath: settings.server.db_path
                };
            }
        } catch (e) {
            console.warn("[Ganache Runner] Could not read workspace settings, using default wallet:", e.message);
        }
    }

    const server = ganache.server(ganacheOpts);
    server.listen(7545, (err) => {
        if (err) {
            console.error("[Ganache Runner] Failed to start Ganache server:", err.message);
            process.exit(1);
        }
        console.log("[Ganache Runner] Ganache local node running on http://127.0.0.1:7545 (Chain ID: 1337, Network ID: 5777)");
    });

    process.on("SIGINT", () => {
        console.log("[Ganache Runner] Stopping Ganache server...");
        server.close(() => process.exit(0));
    });
    process.on("SIGTERM", () => {
        server.close(() => process.exit(0));
    });
}

start();
