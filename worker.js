
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

let inquirer; // Initialized later if needed

const BASE_URL = "https://api.ecox.network/api/v1";

// Firebase Admin init
const admin = require('firebase-admin');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Missing serviceAccountKey.json. Place Firebase service account JSON in the working folder.');
    process.exit(1);
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- Default Configuration (kept for fallback) ---
let config = {
    bearerToken: "",
    targetUsernames: ["maidala"],
    followBatchSize: 5,
    unfollowBatchSize: 10,
    batchDelay: 30,
    followDelay: 5,
    unfollowDelay: 2,
    pageLimit: 5,
    unfollowWhitelist: ["maidala", "ecox"],
    claimHourUTC: 1,
    claimMinuteUTC: 0,
    cycleDelayMinutes: 60,
    enableDiscovery: true,
    discoveryRate: 0.1,
    maxDiscoveryQueue: 100,
    accounts: []
};

let claimTimers = {};
let isProcessPaused = false;
const accountRuntimes = {}; // per-account runtime state

// --- Helper Functions ---
const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

// 🔥 MODIFIED: Made function body empty to prevent Firebase logging
async function logToFirebase(type, message, accountName = 'system') {
    // console.log(`[FIREBASE LOG SKIP] Type: ${type}, Message: ${message}, Account: ${accountName}`);
    return;
}

function log(type, message, accountName) {
    const ts = new Date().toLocaleTimeString();
    let color = '\x1b[0m';
    if (type === 'success') color = '\x1b[32m';
    if (type === 'error') color = '\x1b[31m';
    if (type === 'warn') color = '\x1b[33m';
    if (type === 'info') color = '\x1b[34m';
    if (type === 'title') color = '\x1b[35m';
    console.log(`${ts} - ${color}[${type.toUpperCase()}] ${message}\x1b[0m`);
    // 🔥 MODIFIED: Removed call to logToFirebase. The remaining line ensures
    // the console log is executed, but the Firebase logging is skipped above.
    logToFirebase(type, message, accountName || 'system').catch(() => {}); 
}

// --- Firestore-based config & accounts ---
async function loadConfigFromFirestore() {
    try {
        const configDoc = await db.collection('config').doc('global').get();
        if (configDoc.exists) {
            const remote = configDoc.data();
            config = { ...config, ...remote };
            // ensure arrays are correct type
            if (!Array.isArray(config.targetUsernames))
                config.targetUsernames = [String(config.targetUsernames || '').trim()].filter(Boolean);
            if (!Array.isArray(config.unfollowWhitelist))
                config.unfollowWhitelist = Array.isArray(config.unfollowWhitelist) ? config.unfollowWhitelist : String(config.unfollowWhitelist || "").split(',').map(s => s.trim()).filter(Boolean);
            log('info', 'Configuration loaded from Firestore');
        } else {
            log('warn', 'No global config found in Firestore; using defaults.');
        }

        const snapshot = await db.collection('accounts').get();
        config.accounts = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));
        log('info', `Loaded ${config.accounts.length} accounts from Firestore`);
    } catch (err) {
        log('error', `Failed to load config/accounts from Firestore: ${err.message}`);
    }
}

async function saveConfigToFirestore() {
    try {
        // We avoid writing heavy runtime fields to Firestore; only save global config (non-accounts)
        const toSave = { ...config };
        delete toSave.accounts; // accounts are stored separately
        await db.collection('config').doc('global').set(toSave, {
            merge: true
        });
        log('success', 'Global config saved to Firestore');
    } catch (err) {
        log('error', `Failed to save global config to Firestore: ${err.message}`);
    }
}

async function saveAccountToFirestore(account) {
    try {
        const acctCopy = { ...account };
        delete acctCopy.id;
        await db.collection('accounts').doc(account.id || undefined).set(acctCopy, {
            merge: true
        });
        log('success', `Account ${account.name} saved to Firestore`, account.name);
    } catch (err) {
        log('error', `Failed to save account to Firestore: ${err.message}`, account.name);
    }
}

// --- Authenticated fetch wrappers (same as original but with token param) ---
async function fetchWithAuth(url, options = {}) {
    const {
        bearerToken
    } = config;
    if (!bearerToken) {
        throw new Error('Bearer token is not set. Please use the "Edit" menu to add your token or add account tokens to Firestore.');
    }
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
    };
    return fetch(url, { ...options,
        headers
    });
}

async function fetchWithAuthFor(account, url, options = {}) {
    const token = (account && account.bearerToken) ? account.bearerToken : config.bearerToken;
    if (!token) {
        throw new Error(`Bearer token is not set for account "${account && account.name ? account.name : 'unknown'}".`);
    }
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    return fetch(url, { ...options,
        headers
    });
}

// --- API functions (unchanged behavior) ---

// **NEW:** Placeholder function to get the current account's info (followers_count)
async function fetchAccountInfoFor(account) {
    try {
        const response = await fetchWithAuthFor(account, `${BASE_URL}/user/list-follow?offset=1&limit=1&type=follower`);
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: errorText || 'No details'
            };
        }
        const responseData = await response.json().catch(() => ({}));
        
        // The total count is a top-level property in the response.
        const totalFollowers = responseData.total;

        if (totalFollowers === undefined) {
             return {
                success: false,
                error: `API Error: 'total' field missing from response.`,
                details: JSON.stringify(responseData)
            };
        }

        return {
            success: true,
            // Return a structure consistent with what checkFollowBacksAndUnfollowIfComplete expects
            data: { 
                followers_count: totalFollowers 
            }
        };
    } catch (error) {
        return {
            success: false,
            error: "Network or fetch error.",
            details: error.message
        };
    }
}

async function fetchUserListFor(account, {
    username,
    offset,
    limit,
    type
}) {
    const params = new URLSearchParams({
        offset: offset.toString(),
        limit: limit.toString(),
        type: type,
    });
    if (username) params.set("username", username);

    try {
        const response = await fetchWithAuthFor(account, `${BASE_URL}/user/list-follow?${params}`);
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: responseData.message || 'No details'
            };
        }
        return {
            success: true,
            data: responseData.data || [],
            total: responseData.total || 0
        };
    } catch (error) {
        return {
            success: false,
            error: "Network or fetch error.",
            details: error.message
        };
    }
}

async function followUserFor(account, uid) {
    try {
        const response = await fetchWithAuthFor(account, `${BASE_URL}/user/follow`, {
            method: "POST",
            body: JSON.stringify({
                uid
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: errorData.message || 'No details'
            };
        }
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: "Network or fetch error.",
            details: error.message
        };
    }
}

async function unfollowUserFor(account, uid) {
    try {
        const response = await fetchWithAuthFor(account, `${BASE_URL}/user/unfollow`, {
            method: "POST",
            body: JSON.stringify({
                uid
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: errorData.message || 'No details'
            };
        }
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: "Network or fetch error.",
            details: error.message
        };
    }
}

async function claimGreenFor(account) {
    try {
        const response = await fetchWithAuthFor(account, `${BASE_URL}/green/claim`, {
            method: "POST",
            body: JSON.stringify({}),
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: responseData.message || 'No details'
            };
        }
        return {
            success: true,
            message: responseData.message || "Claim successful."
        };
    } catch (error) {
        return {
            success: false,
            error: "Network or fetch error.",
            details: error.message
        };
    }
}

// --- Claim processes (account-scoped) ---
async function runClaimProcessFor(account) {
    try {
        log('title', `Claiming Green Point for account: ${account.name}`, account.name);
        const claimResponse = await claimGreenFor(account);
        if (claimResponse.success) {
            log('success', `[${account.name}] 🎉 Claim successful! Message: ${claimResponse.message}`, account.name);
        } else {
            const details = typeof claimResponse.details === 'string' ? claimResponse.details.toLowerCase() : '';
            if (details.includes('already') || details.includes('claimed')) {
                log('warn', `[${account.name}] 🛑 Claim already processed. Message: ${claimResponse.details}`, account.name);
            } else {
                log('error', `[${account.name}] ❌ Claim failed: ${claimResponse.error} - ${claimResponse.details}`, account.name);
            }
        }
    } catch (error) {
        log('error', `[${account.name}] An error occurred during the claim process: ${error.message}`, account.name);
    }
}

function scheduleNextClaimCheckForAccount(account) {
    const timerKey = account.id || account.name;
    if (claimTimers[timerKey]) clearTimeout(claimTimers[timerKey]);

    const now = new Date();
    const nextClaimTime = new Date();
    const h = (account.claimHourUTC !== undefined) ? account.claimHourUTC : config.claimHourUTC;
    const m = (account.claimMinuteUTC !== undefined) ? account.claimMinuteUTC : config.claimMinuteUTC;

    nextClaimTime.setUTCHours(h, m, 5, 0);
    if (now > nextClaimTime) nextClaimTime.setUTCDate(nextClaimTime.getUTCDate() + 1);
    const delay = nextClaimTime.getTime() - now.getTime();
    log('info', `[${account.name}] Next claim scheduled for ${nextClaimTime.toUTCString()}`, account.name);

    claimTimers[timerKey] = setTimeout(async () => {
        if (!accountRuntimes[account.name]) return;
        accountRuntimes[account.name].isPaused = true;
        log('warn', `[${account.name}] Pausing processes to claim...`, account.name);
        await runClaimProcessFor(account);
        accountRuntimes[account.name].isPaused = false;
        log('info', `[${account.name}] Resuming processes...`, account.name);
        scheduleNextClaimCheckForAccount(account);
    }, delay);
}

async function markAccountAsDone(account) {
    if (!account || !account.id) {
        log('error', `[SYSTEM] Invalid account provided to markAsDone.`, 'system');
        return;
    }
    try {
        const accountRef = db.collection('accounts').doc(account.id);
        await accountRef.update({ status: 'done', active: false });
        log('success', `[${account.name}] Marked as 'done' in Firestore.`, account.name);
    } catch (error) {
        log('error', `[${account.name}] Failed to mark account as done in Firestore: ${error.message}`, account.name);
    }
}

// **NEW:** Function to check follow-back status against the goal
async function checkFollowBacksAndUnfollowIfComplete(account, runtime) {
    const accName = account.name;
    const followerTarget = account.followerTarget || 0;
    const targetFollowBacks = followerTarget - (runtime.initialFollowers || 0);

    const infoResponse = await fetchAccountInfoFor(account);

    if (infoResponse.success && infoResponse.data.followers_count !== undefined) {
        const currentFollowers = infoResponse.data.followers_count;
        const netGained = currentFollowers - runtime.initialFollowers;

        runtime.netFollowBacks = netGained; // Update runtime state

        log('info', `[${accName}] Follower Check: Current: ${currentFollowers}, Initial: ${runtime.initialFollowers}, Net Gained: ${netGained}. Goal: ${targetFollowBacks} net follow-backs.`, accName);

        if (netGained >= targetFollowBacks) {
            log('success', `[${accName}] Follow Back Goal Achieved! Initiating selective unfollow.`, accName);
            await runSelectiveUnfollowPass(account, runtime);
            await markAccountAsDone(account); // Mark as done in Firestore
            runtime.running = false; // Stop the follow/discover loop
            return true;
        }
    } else {
        log('error', `[${accName}] Failed to check current follower count: ${infoResponse.details || infoResponse.error}`, accName);
    }
    return false;
}

// **NEW:** Function to unfollow ONLY the accounts recorded in followHistory
async function runSelectiveUnfollowPass(account, runtime) {
    const accName = account.name;
    const {
        unfollowBatchSize,
        batchDelay,
        unfollowDelay
    } = config;

    log('title', `[${accName}] Starting SELECTIVE Unfollow Pass`, accName);

    // Filter for users followed by the script that haven't been unfollowed yet
    const usersToUnfollow = runtime.followHistory.filter(f => !f.unfollowed);
    log('info', `[${accName}] Found ${usersToUnfollow.length} users to unfollow from history.`, accName);

    let batchCount = 0;
    for (const user of usersToUnfollow) {
        if (runtime.isPaused || isProcessPaused) {
            log('warn', `[${accName}] Paused during selective unfollow. Waiting 10s...`, accName);
            await sleep(10);
            continue;
        }

        log('info', `[${accName}] Attempting to unfollow historical user: ${user.username}`, accName);
        const unfollowResponse = await unfollowUserFor(account, user.uid);

        if (unfollowResponse.success) {
            user.unfollowed = true; // Mark as unfollowed in history
            log('success', `[${accName}] Successfully unfollowed ${user.username}.`, accName);
        } else {
            // Log error but continue to next user
            log('error', `[${accName}] Failed to unfollow ${user.username}: ${unfollowResponse.details}`, accName);
        }

        await sleep(unfollowDelay);
        batchCount++;

        if (batchCount >= unfollowBatchSize) {
            log('info', `[${accName}] Selective Unfollow Batch of ${unfollowBatchSize} completed. Waiting ${batchDelay}s...`, accName);
            await sleep(batchDelay);
            batchCount = 0;
        }
    }

    // After the pass, clean up the history to only keep failed unfollows (optional, but good for memory)
    runtime.followHistory = runtime.followHistory.filter(f => !f.unfollowed);
    log('info', `[${accName}] Selective Unfollow Pass finished. Remaining history size: ${runtime.followHistory.length}`, accName);
}

// --- Per-account follow & discover loop (Kept, but heavily modified for goal tracking) ---
async function runFollowAndDiscoverLoopForAccount(account) {
    const accName = account.name;
    const runtime = accountRuntimes[accName];

    const {
        pageLimit,
        followBatchSize,
        batchDelay,
        followDelay,
        enableDiscovery,
        discoveryRate,
        maxDiscoveryQueue
    } = config;

    const followerTarget = account.followerTarget || 0;
    // Use a new flag, set to true in Firestore on the account to enable this mode.
    const enableGoal = account.enableFollowBackGoal === true && followerTarget > 0;

    // Set initial state for the runtime tracking
    let targetFollowBacks = 0;

    if (enableGoal) {
        log('title', `[${accName}] Starting Follow Back Goal Loop`, accName);

        // 1. Initial follower count fetch
        if (!runtime.initialFollowers) {
            log('info', `[${accName}] Fetching initial follower count...`, accName);
            const infoResponse = await fetchAccountInfoFor(account);
            if (infoResponse.success && infoResponse.data.followers_count !== undefined) {
                runtime.initialFollowers = infoResponse.data.followers_count;
                targetFollowBacks = followerTarget - runtime.initialFollowers;
                log('success', `[${accName}] Initial followers: ${runtime.initialFollowers}. Goal: ${targetFollowBacks} net follow-backs.`, accName);
            } else {
                log('error', `[${accName}] Failed to get initial follower count. Disabling goal. Details: ${infoResponse.details || infoResponse.error}`, accName);
                account.enableFollowBackGoal = false;
                // Continue with standard loop if goal tracking fails
            }
        } else {
            targetFollowBacks = followerTarget - runtime.initialFollowers;
            log('title', `[${accName}] Resuming Follow Back Goal Loop. Need ${targetFollowBacks} net follow-backs.`, accName);
        }

        // If the goal is already met before starting/resuming, unfollow and stop.
        if (runtime.initialFollowers > 0 && targetFollowBacks <= 0) {
            log('warn', `[${accName}] Goal already met (${runtime.initialFollowers} >= ${followerTarget}). Initiating selective unfollow and stopping.`, accName);
            await runSelectiveUnfollowPass(account, runtime);
            await markAccountAsDone(account); // Mark as done in Firestore
            runtime.running = false;
        }
    } else {
        log('title', `[${accName}] Starting Continuous Follow & Discover Loop (Standard)`, accName);
    }

    const followBatch = account.followBatchSize || followBatchSize;
    const followDelaySec = account.followDelay || followDelay;

    let mainTargets = (Array.isArray(account.targetUsernames) && account.targetUsernames.length) ? [...account.targetUsernames] : [...config.targetUsernames];

    log('info', `[${accName}] Initial Targets: ${mainTargets.join(', ')}`, accName);
    log('info', `[${accName}] Discovery Mode: ${config.enableDiscovery ? 'ON' : 'OFF'}`, accName);
    log('info', `[${accName}] Batch Size: ${followBatch}, Follow Delay: ${followDelaySec}s`, accName);

    runtime.followCount = runtime.followCount || 0;
    runtime.followHistory = runtime.followHistory || []; // Ensure history is initialized

    while (runtime.running) {
        if (isProcessPaused || runtime.isPaused) {
            log('warn', `[${accName}] Paused. Sleeping 10s...`, accName);
            await sleep(10);
            continue;
        }

        // Check goal before proceeding to new target
        if (enableGoal && runtime.netFollowBacks >= targetFollowBacks) {
            log('success', `[${accName}] Follow Back Goal Achieved! (${runtime.netFollowBacks} >= ${targetFollowBacks})`, accName);
            await runSelectiveUnfollowPass(account, runtime);
            await markAccountAsDone(account); // Mark as done in Firestore
            runtime.running = false; // Stop the loop
            break;
        }

        let currentTarget = mainTargets.shift() || runtime.discoveredTargets.shift();

        if (!currentTarget) {
            if (config.enableDiscovery && runtime.discoveredTargets.length === 0) {
                log('warn', `[${accName}] Target queue empty. Waiting 10 minutes...`, accName);
                await sleep(600);
                mainTargets = [...config.targetUsernames];
                continue;
            } else {
                log('warn', `[${accName}] Target queue empty. Waiting 60s...`, accName);
                await sleep(60);
                continue;
            }
        }

        log('title', `[${accName}] Processing target: ${currentTarget}`, accName);

        try {
            let offset = 1;
            let continueLooping = true;

            const initialResponse = await fetchUserListFor(account, {
                username: currentTarget,
                offset: 1,
                limit: 1,
                type: 'follower'
            });
            if (!initialResponse.success) {
                log('error', `[${accName}] Could not get info for target ${currentTarget}. Skipping. Error: ${initialResponse.details}`, accName);
                continue;
            }
            const totalFollowers = initialResponse.total || 0;
            log('info', `[${accName}] Target user has ${totalFollowers} followers.`, accName);

            while (continueLooping && runtime.running) {
                if (runtime.isPaused || isProcessPaused) {
                    log('warn', `[${accName}] Paused for claim...`, accName);
                    await sleep(10);
                    continue;
                }

                // Check goal before a new API call
                if (enableGoal && runtime.netFollowBacks >= targetFollowBacks) {
                    log('success', `[${accName}] Follow Back Goal Achieved! (${runtime.netFollowBacks} >= ${targetFollowBacks})`, accName);
                    await runSelectiveUnfollowPass(account, runtime);
                    await markAccountAsDone(account); // Mark as done in Firestore
                    runtime.running = false;
                    break;
                }

                const usersResponse = await fetchUserListFor(account, {
                    username: currentTarget,
                    offset: offset,
                    limit: pageLimit,
                    type: 'follower'
                });

                if (!usersResponse.success) {
                    log('error', `[${accName}] Failed to fetch followers: ${usersResponse.details}. Retrying in 60s.`, accName);
                    await sleep(60);
                    continue;
                }

                const followers = usersResponse.data;
                if (!followers || followers.length === 0) {
                    log('info', `[${accName}] Finished with target ${currentTarget}. Moving to next target.`, accName);
                    continueLooping = false;
                    continue;
                }

                let batchCount = 0;
                for (const follower of followers) {
                    if (!runtime.running) break;

                    const uid = follower.user?.uid;
                    const username = follower.user?.username || "N/A";

                    if (!uid || follower.is_following) {
                        if (follower.is_following)
                            log('warn', `[${accName}] [SKIP] Already following ${username}`, accName);
                        continue;
                    }

                    log('info', `[${accName}] Attempting to follow user: ${username}`, accName);
                    const followResponse = await followUserFor(account, uid);

                    if (followResponse.success) {
                        runtime.followCount = (runtime.followCount || 0) + 1;

                        // **NEW:** Track history for selective unfollow
                        runtime.followHistory.push({
                            uid,
                            username,
                            when: Date.now(),
                            unfollowed: false, // Flag to indicate if we've unfollowed them
                        });

                        log('success', `[${accName}] [SUCCESS] Followed ${username} (total follows this run: ${runtime.followCount})`, accName);

                        if (config.enableDiscovery && Math.random() < config.discoveryRate && runtime.discoveredTargets.length < config.maxDiscoveryQueue) {
                            if (!runtime.discoveredTargets.includes(username) && !config.targetUsernames.includes(username)) {
                                runtime.discoveredTargets.push(username);
                                log('info', `[${accName}] [DISCOVERY] Added ${username} to the account queue. Queue size: ${runtime.discoveredTargets.length}`, accName);
                            }
                        }
                    } else {
                        log('error', `[${accName}] [ERROR] Failed to follow ${username}: ${followResponse.details}`, accName);
                    }

                    batchCount++;
                    await sleep(followDelaySec);

                    if (batchCount >= followBatch) {
                        log('info', `[${accName}] Batch of ${followBatch} completed. Waiting ${config.batchDelay} seconds...`, accName);

                        // **NEW:** Check the goal after a batch
                        if (enableGoal) {
                            const goalMet = await checkFollowBacksAndUnfollowIfComplete(account, runtime);
                            if (goalMet) break; // Break out of the inner loop if goal is met
                        }

                        await sleep(config.batchDelay);
                        batchCount = 0;
                    }

                    // **OLD LOGIC REMOVED:** Removed the original desiredFollowers check here.

                    if (!runtime.running) break;
                } // end of for loop
                offset++;
                if (!runtime.running) continueLooping = false;
            } // end of inner while loop
        } catch (error) {
            log('error', `[${accName}] Error processing target ${currentTarget}: ${error.message}`, accName);
            log('info', `[${accName}] Moving to next target in 60 seconds...`, accName);
            await sleep(60);
        }
    }

    log('info', `[${accName}] Follow & Discover loop stopped for account.`, accName);
}

// --- Unfollow loop for account (Original logic, kept for non-goal-driven use) ---
async function runUnfollowLoopForAccount(account) {
    const accName = account.name;
    const runtime = accountRuntimes[accName];
    const {
        unfollowBatchSize,
        batchDelay,
        unfollowDelay,
        pageLimit,
        unfollowWhitelist
    } = config;
    log('title', `[${accName}] Starting Unfollow Process (Standard)`, accName);
    log('info', `[${accName}] Whitelist: ${unfollowWhitelist.join(', ')}`, accName);

    try {
        let offset = 1;
        while (true) {
            const followingResponse = await fetchUserListFor(account, {
                offset: offset,
                limit: pageLimit,
                type: 'following'
            });
            if (!followingResponse.success || followingResponse.data.length === 0) {
                log('info', `[${accName}] Unfollow task complete or failed to fetch users.`, accName);
                break;
            }

            let batchCount = 0;
            for (const user of followingResponse.data) {
                const username = user.user?.username || "N/A";
                if (unfollowWhitelist.includes(username)) {
                    log('warn', `[${accName}] [SKIP] ${username} is on the whitelist.`, accName);
                    continue;
                }
                log('info', `[${accName}] Attempting to unfollow user: ${username}`, accName);
                await unfollowUserFor(account, user.user.uid);
                await sleep(unfollowDelay);
                batchCount++;

                if (batchCount >= unfollowBatchSize) {
                    log('info', `[${accName}] Batch of ${unfollowBatchSize} completed. Waiting ${batchDelay}s...`, accName);
                    await sleep(batchDelay);
                    batchCount = 0;
                }
            }
            offset++;
        }
    } catch (e) {
        log('error', `[${accName}] Unfollow loop failed: ${e.message}`, accName);
    }
    log('info', `[${accName}] Unfollow process finished.`, accName);
}

// --- Account lifecycle helpers (start/stop) ---
function ensureAccountRuntimeExists(account) {
    if (!accountRuntimes[account.name]) {
        accountRuntimes[account.name] = {
            discoveredTargets: account.discoveredTargets || [],
            followCount: 0,
            followHistory: [], // Stores { uid, username, when, unfollowed: boolean }
            initialFollowers: account.initialFollowers || 0, // NEW: Initial follower count
            netFollowBacks: 0, // NEW: Net followers gained from this script's actions
            running: false,
            isPaused: false
        };

        // Warn user if goal is enabled but initial followers not set
        if (account.enableFollowBackGoal && account.followerTarget && !account.initialFollowers) {
            log('warn', `[${account.name}] Follow-Back Goal is enabled but initialFollowers is missing. It will be fetched on start.`, account.name);
        }
    }
}

function startAccountLoop(account) {
    ensureAccountRuntimeExists(account);
    const runtime = accountRuntimes[account.name];
    if (runtime.running) {
        log('info', `Account ${account.name} already running`, account.name);
        return;
    }
    runtime.running = true;
    runtime.isPaused = false;

    // schedule claim for this account
    scheduleNextClaimCheckForAccount(account);

    // Start the loop but don't await (run in background)
    (async () => {
        try {
            await runFollowAndDiscoverLoopForAccount(account);
        } catch (err) {
            log('error', `Background loop for account ${account.name} failed: ${err.message}`, account.name);
            runtime.running = false;
        }
    })();

    log('success', `Started worker loop for account: ${account.name}`, account.name);
}

function stopAccountLoop(account) {
    const runtime = accountRuntimes[account.name];
    if (!runtime || !runtime.running) return;
    runtime.running = false;
    runtime.isPaused = true;
    // clear claim timer
    const key = account.id || account.name;
    if (claimTimers[key]) clearTimeout(claimTimers[key]);
    log('warn', `Stopped worker loop for account: ${account.name}`, account.name);
}

// --- Firestore real-time listener for accounts collection ---
function attachAccountsListener() {
    try {
        const accountsRef = db.collection('accounts');
        accountsRef.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const doc = change.doc;
                const id = doc.id;
                const data = {
                    id,
                    ...doc.data()
                };

                if (change.type === 'added') {
                    log('info', `Firestore: account added -> ${data.name}`, data.name);
                    // add to config.accounts
                    const idx = config.accounts.findIndex(a => a.id === id);
                    if (idx === -1) {
                        config.accounts.push(data);
                    } else {
                        config.accounts[idx] = data;
                    }
                    if (data.active !== false)
                        startAccountLoop(data);
                } else if (change.type === 'modified') {
                    log('info', `Firestore: account modified -> ${data.name}`, data.name);
                    const idx = config.accounts.findIndex(a => a.id === id);
                    if (idx === -1) config.accounts.push(data);
                    else config.accounts[idx] = data;
                    // if modified active
                    if (data.active === false)
                        stopAccountLoop(data);
                    else startAccountLoop(data);
                } else if (change.type === 'removed') {
                    log('info', `Firestore: account removed -> ${data.name}`, data.name);
                    config.accounts = config.accounts.filter(a => a.id !== id);
                    stopAccountLoop(data);
                }
            });
        }, err => {
            log('error', `Accounts listener error: ${err.message}`);
            // If onSnapshot fails, we could
            // fallback to polling - omitted here for brevity.
        });
        log('info', 'Attached Firestore listener to accounts collection.');
    } catch (err) {
        log('error', `Failed to attach accounts listener: ${err.message}`);
    }
}

// --- Interactive Settings Edit (uses Firestore save) ---
async function editSettings() {
    // Dynamically load inquirer when needed (assuming it's installed)
    if (!inquirer) {
        try {
            inquirer = require('inquirer');
        } catch (e) {
            log('error', 'The "inquirer" package is required for interactive menus. Please install it (npm install inquirer).', 'system');
            return;
        }
    }

    console.clear();
    log('title', '=== Edit Configuration (v2) ===');

    const mainChoices = [
        {
            name: 'Edit common settings (delays, batch sizes, discovery)',
            value: 'common'
        },
        {
            name: 'Back',
            value: 'back'
        }
    ];

    const {
        selection
    } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: 'What would you like to edit?',
            choices: mainChoices
        }
    ]);

    if (selection === 'common') {
        const questions = [
            {
                type: 'input',
                name: 'targetUsernames',
                message: 'Initial Target Usernames (comma-separated):',
                default: Array.isArray(config.targetUsernames) ? config.targetUsernames.join(',') : ""
            },
            {
                type: 'confirm',
                name: 'enableDiscovery',
                message: 'Enable Automatic Target Discovery?',
                default: config.enableDiscovery
            },
            {
                type: 'number',
                name: 'discoveryRate',
                message: 'Discovery Rate (0.0 to 1.0):',
                default: config.discoveryRate,
                when: answers => answers.enableDiscovery
            },
            {
                type: 'number',
                name: 'maxDiscoveryQueue',
                message: 'Max Discovered Targets:',
                default: config.maxDiscoveryQueue,
                when: answers => answers.enableDiscovery
            },
            {
                type: 'number',
                name: 'claimHourUTC',
                message: 'Hour for daily claim (UTC, 0-23):',
                default: config.claimHourUTC
            },
            {
                type: 'number',
                name: 'claimMinuteUTC',
                message: 'Minute for daily claim (UTC, 0-59):',
                default: config.claimMinuteUTC
            },
            {
                type: 'number',
                name: 'followDelay',
                message: 'Delay between follows (s):',
                default: config.followDelay
            },
            {
                type: 'number',
                name: 'followBatchSize',
                message: 'Follows per batch:',
                default: config.followBatchSize
            },
            {
                type: 'number',
                name: 'batchDelay',
                message: 'Delay between batches (s):',
                default: config.batchDelay
            },
            {
                type: 'input',
                name: 'unfollowWhitelist',
                message: 'Unfollow Whitelist (comma-separated):',
                default: config.unfollowWhitelist.join(',')
            },
        ];

        const answers = await inquirer.prompt(questions);
        config = {
            ...config,
            ...answers,
            targetUsernames: answers.targetUsernames.split(',').map(u => u.trim()).filter(Boolean),
            unfollowWhitelist: answers.unfollowWhitelist.split(',').map(u => u.trim()).filter(Boolean),
        };
        await saveConfigToFirestore();
        log('success', 'Common settings updated.');
        await sleep(1);
        return mainMenu();
    } else {
        return mainMenu();
    }
}

// --- Main Execution & Menus ---
async function startMultiAccountCycle() {
    if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
        log('warn', 'No accounts configured. Please add at least one account in Firestore (collection: accounts).');
        await sleep(2);
        return mainMenu();
    }

    log('title', 'Starting Multi-Account Continuous Follow & Discover Cycle');

    const activeAccounts = config.accounts.filter(a => a.active !== false);

    for (const account of activeAccounts) {
        startAccountLoop(account);
    }
    // The loop continues in the background, this function just starts them.
    log('success', `All ${activeAccounts.length} active accounts are running in the background. Press 'm' to return to the main menu.`);

    // An optional delay before checking for menu input, or setting up a listener.
    // Assuming the user is running this in a terminal that allows input while background tasks run.
    await sleep(2);
    // This is where a more complex CLI would typically start listening for a single keypress ('m') to return to a menu.
}

async function mainMenu() {
    // Dynamically load inquirer when needed
    if (!inquirer) {
        try {
            inquirer = require('inquirer');
        } catch (e) {
            log('error', 'The "inquirer" package is required for interactive menus. Please install it (npm install inquirer).', 'system');
            return;
        }
    }

    console.clear();
    log('title', '=== ECOX Follower Bot (v2) ===');
    log('info', `Total Accounts Loaded: ${config.accounts.length}`);
    log('info', `Active Workers: ${config.accounts.filter(a => accountRuntimes[a.name] && accountRuntimes[a.name].running).length}`);
    log('info', `Global Discovery: ${config.enableDiscovery ? 'ON' : 'OFF'}`);

    const choices = [
        { name: 'Start/Resume All Active Account Loops', value: 'start' },
        { name: 'Stop All Account Loops', value: 'stop' },
        { name: 'Run Standard Unfollow Pass (All Accounts)', value: 'unfollow' },
        { name: 'Edit Global Settings (Firestore)', value: 'edit' },
        { name: 'Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Select an action:',
            choices: choices
        }
    ]);

    switch (action) {
        case 'start':
            await startMultiAccountCycle();
            break;
        case 'stop':
            config.accounts.forEach(stopAccountLoop);
            await sleep(1);
            return mainMenu();
        case 'unfollow':
            log('warn', 'Standard unfollow can be destructive. Consider the goal-based selective unfollow instead.', 'system');
            const { confirmUnfollow } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirmUnfollow',
                message: 'Are you sure you want to run the Standard Unfollow Pass on ALL accounts?',
                default: false
            }]);
            if (confirmUnfollow) {
                for (const account of config.accounts.filter(a => a.active !== false)) {
                    await runUnfollowLoopForAccount(account);
                }
            }
            await sleep(3);
            return mainMenu();
        case 'edit':
            await editSettings();
            break;
        case 'exit':
            log('title', 'Exiting program. Background loops may stop depending on your environment.', 'system');
            config.accounts.forEach(stopAccountLoop);
            process.exit(0);
        default:
            return mainMenu();
    }
}

// --- Initialization ---
async function init() {
    log('title', 'Starting ECOX Bot Initializer...');
    await loadConfigFromFirestore();

    // Start listeners and main menu
    attachAccountsListener();
    await mainMenu();
}

init().catch(err => {
    log('error', `Fatal Initialization Error: ${err.message}`);
    process.exit(1);
});

    