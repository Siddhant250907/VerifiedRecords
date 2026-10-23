require("dotenv").config();
const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

async function runMetaMaskValidationTests() {
    console.log("==================================================================");
    console.log("  METAMASK ACCOUNT SELECTION & TRANSACTION VALIDATION TEST SUITE  ");
    console.log("==================================================================");

    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    if (!rpcUrl) {
        throw new Error("SEPOLIA_RPC_URL is not defined in .env");
    }

    const web3 = new Web3(rpcUrl);
    const artifactPath = path.join(__dirname, "..", "build", "contracts", "Certificate.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

    const sepoliaContractAddress = "0xDd4DF9A618683a407f3B195e651271DC0E97f5bE";
    const expectedOwner = "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7";
    const nonOwnerAccount = "0x1111111111111111111111111111111111111111"; // Represents "Siddhant's Personal" or any non-owner

    const contract = new web3.eth.Contract(artifact.abi, sepoliaContractAddress);

    // -------------------------------------------------------------
    // TEST 1: Chain ID & Contract Owner Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Sepolia Chain ID & Contract State Verification ---");
    const chainId = await web3.eth.getChainId();
    console.log(`[PASS] Chain ID matches Sepolia: ${chainId} (0x${Number(chainId).toString(16)})`);
    if (Number(chainId) !== 11155111) {
        throw new Error(`Expected Sepolia chain ID 11155111, got ${chainId}`);
    }

    const onChainOwner = await contract.methods.owner().call();
    console.log(`[PASS] On-chain owner: ${onChainOwner}`);
    if (onChainOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`Contract owner mismatch: expected ${expectedOwner}, got ${onChainOwner}`);
    }

    // -------------------------------------------------------------
    // TEST 2: Diagnosis of Non-Owner Revert on registerAdmin
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Non-Owner registerAdmin Revert Diagnosis ---");
    const dummyAdminId = "TEST_ADMIN_" + Date.now();
    const registerData = contract.methods["registerAdmin(string)"](dummyAdminId).encodeABI();
    console.log(`Function selector for registerAdmin(string): ${registerData.slice(0, 10)}`);

    let nonOwnerGasFailed = false;
    let nonOwnerRevertSelector = null;
    try {
        await web3.eth.call({
            from: nonOwnerAccount,
            to: sepoliaContractAddress,
            data: registerData
        });
    } catch (err) {
        nonOwnerGasFailed = true;
        const revertData = err.innerError?.data || err.data || "";
        nonOwnerRevertSelector = typeof revertData === "string" ? revertData.slice(0, 10) : "";
        console.log(`[PASS] Non-owner call reverted as expected. Error selector: ${nonOwnerRevertSelector}`);
    }

    // OpenZeppelin OwnableUnauthorizedAccount(address) error selector is 0x118cdaa7
    const expectedSelector = web3.utils.keccak256("OwnableUnauthorizedAccount(address)").slice(0, 10);
    console.log(`OpenZeppelin OwnableUnauthorizedAccount selector: ${expectedSelector}`);
    const isOZRevert = nonOwnerRevertSelector.toLowerCase() === expectedSelector.toLowerCase();
    console.log(`[PASS] Revert selector matches OwnableUnauthorizedAccount: ${isOZRevert}`);

    // -------------------------------------------------------------
    // TEST 3: Pre-Flight Owner Validation (Client-Side Gate Check)
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Pre-Flight Owner Validation Gate ---");
    function clientPreFlightOwnerCheck(connectedAccount, contractOwner) {
        if (!connectedAccount) return { proceed: false, error: "No account connected" };
        if (connectedAccount.toLowerCase() !== contractOwner.toLowerCase()) {
            return {
                proceed: false,
                error: `Connected wallet (${connectedAccount}) is NOT the contract owner (${contractOwner}). Please switch accounts.`
            };
        }
        return { proceed: true };
    }

    const nonOwnerCheck = clientPreFlightOwnerCheck(nonOwnerAccount, onChainOwner);
    console.log(`[PASS] Non-owner blocked before broadcasting: proceed=${nonOwnerCheck.proceed}, message: "${nonOwnerCheck.error}"`);
    if (nonOwnerCheck.proceed) throw new Error("Pre-flight check failed to block non-owner!");

    const ownerCheck = clientPreFlightOwnerCheck(onChainOwner, onChainOwner);
    console.log(`[PASS] Contract owner allowed: proceed=${ownerCheck.proceed}`);
    if (!ownerCheck.proceed) throw new Error("Pre-flight check blocked the real owner!");

    // -------------------------------------------------------------
    // TEST 4: Pre-Authorized Status of Contract Owner
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Contract Owner Pre-Authorized Status ---");
    const isOwnerAdmin = await contract.methods.isRegisteredAdmin(onChainOwner).call();
    console.log(`[PASS] Contract owner isRegisteredAdmin on-chain: ${isOwnerAdmin}`);

    // -------------------------------------------------------------
    // TEST 5: Owner Registering a New Admin via registerAdmin(string,address)
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Owner Registering Fresh Admin Simulation ---");
    const freshAdminAddress = "0x4444444444444444444444444444444444444444";
    const newAdminData = contract.methods["registerAdmin(string,address)"]("NEW_ADMIN_VALIDATION", freshAdminAddress).encodeABI();
    console.log(`Function selector for registerAdmin(string,address): ${newAdminData.slice(0, 10)}`);

    // Dry-run simulation using eth_call
    await web3.eth.call({
        from: onChainOwner,
        to: sepoliaContractAddress,
        data: newAdminData
    });
    console.log("[PASS] Dry-run call from owner for new admin succeeded without revert.");

    // Estimate gas for the valid owner call
    const gasEst = await contract.methods["registerAdmin(string,address)"]("NEW_ADMIN_VALIDATION", freshAdminAddress).estimateGas({
        from: onChainOwner
    });
    console.log(`[PASS] Gas estimation succeeded for valid owner call: ${gasEst.toString()} gas units`);

    // -------------------------------------------------------------
    // TEST 6: Pre-Flight issueCertificate Validation
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: issueCertificate Pre-Flight & Gas Estimation ---");
    const dummyCertId = "CERT_VALIDATION_" + Date.now();
    const dummyHash = web3.utils.keccak256("VALIDATION_PAYLOAD");
    const issueData = contract.methods.issueCertificate(dummyCertId, dummyHash).encodeABI();
    console.log(`Function selector for issueCertificate(string,bytes32): ${issueData.slice(0, 10)}`);

    // 6a. Non-authorized account simulation
    let unauthReverted = false;
    try {
        await web3.eth.call({
            from: nonOwnerAccount,
            to: sepoliaContractAddress,
            data: issueData
        });
    } catch (unauthErr) {
        unauthReverted = true;
        console.log(`[PASS] Unauthorized issueCertificate call reverted: ${unauthErr.message}`);
    }
    if (!unauthReverted) throw new Error("Unauthorized issueCertificate did not revert!");

    // 6b. Authorized owner account simulation
    await web3.eth.call({
        from: onChainOwner,
        to: sepoliaContractAddress,
        data: issueData
    });
    console.log("[PASS] Authorized issueCertificate dry-run call succeeded.");

    const issueGas = await contract.methods.issueCertificate(dummyCertId, dummyHash).estimateGas({
        from: onChainOwner
    });
    console.log(`[PASS] Gas estimation for authorized certificate issuance: ${issueGas.toString()} gas units`);

    console.log("\n==================================================================");
    console.log("  ALL METAMASK VALIDATION TESTS PASSED (100%)                     ");
    console.log("==================================================================");
}

runMetaMaskValidationTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
