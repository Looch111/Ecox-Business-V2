
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
    targetType: 'follower', // 'follower', 'following', or 'both'
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

async function updateAccountInFirestore(accountId, data) {
    if (!accountId) return;
    try {
        await db.collection('accounts').doc(accountId).update(data);
    } catch (error) {
        log('error', `Failed to update account ${accountId} in Firestore: ${error.message}`);
    }
}


// --- Authenticated fetch wrappers (same as original but with token param) ---
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
        await updateAccountInFirestore(account.id, { status: 'done', active: false });
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
        await updateAccountInFirestore(account.id, { netFollowBacks: netGained }); // Update Firestore

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
    const enableGoal = account.enableFollowBackGoal === true && followerTarget > 0;

    let targetFollowBacks = 0;

    if (enableGoal) {
        log('title', `[${accName}] Starting Follow Back Goal Loop`, accName);
        if (!runtime.initialFollowers) {
            log('info', `[${accName}] Fetching initial follower count...`, accName);
            const infoResponse = await fetchAccountInfoFor(account);
            if (infoResponse.success && infoResponse.data.followers_count !== undefined) {
                runtime.initialFollowers = infoResponse.data.followers_count;
                 await updateAccountInFirestore(account.id, { initialFollowers: runtime.initialFollowers });
            } else {
                log('error', `[${accName}] Failed to get initial follower count. Disabling goal. Details: ${infoResponse.details || infoResponse.error}`, accName);
                account.enableFollowBackGoal = false;
            }
        }
        targetFollowBacks = followerTarget - runtime.initialFollowers;
        log('success', `[${accName}] Initial followers: ${runtime.initialFollowers}. Goal: ${targetFollowBacks} net follow-backs.`, accName);

        if (runtime.initialFollowers > 0 && targetFollowBacks <= 0) {
            log('warn', `[${accName}] Goal already met (${runtime.initialFollowers} >= ${followerTarget}). Initiating selective unfollow and stopping.`, accName);
            await runSelectiveUnfollowPass(account, runtime);
            await markAccountAsDone(account);
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
    runtime.followHistory = runtime.followHistory || [];
    runtime.processedUIDs = runtime.processedUIDs || new Set();

    while (runtime.running) {
        if (isProcessPaused || runtime.isPaused) {
            log('warn', `[${accName}] Paused. Sleeping 10s...`, accName);
            await sleep(10);
            continue;
        }

        if (enableGoal && (runtime.netFollowBacks >= targetFollowBacks)) {
            log('success', `[${accName}] Follow Back Goal Achieved! (${runtime.netFollowBacks} >= ${targetFollowBacks})`, accName);
            await runSelectiveUnfollowPass(account, runtime);
            await markAccountAsDone(account);
            runtime.running = false;
            break;
        }

        let currentTarget = mainTargets.shift() || runtime.discoveredTargets.shift();
        if (!currentTarget) {
            log('warn', `[${accName}] Target queue empty. Waiting for new discovery or config update...`, accName);
            await sleep(600);
            mainTargets = (Array.isArray(account.targetUsernames) && account.targetUsernames.length) ? [...account.targetUsernames] : [...config.targetUsernames];
            continue;
        }

        log('title', `[${accName}] Processing target: ${currentTarget}`, accName);
        
        let typeToFetch = 'follower';
        if (config.targetType === 'following') {
            typeToFetch = 'following';
        } else if (config.targetType === 'both') {
            typeToFetch = Math.random() > 0.5 ? 'follower' : 'following';
        }
        log('info', `[${accName}] Targeting '${typeToFetch}' list for ${currentTarget}`, accName);

        try {
            let offset = 1;
            let continueLooping = true;
            
            while (continueLooping && runtime.running) {
                if (runtime.isPaused || isProcessPaused) {
                    log('warn', `[${accName}] Paused during loop...`, accName);
                    await sleep(10);
                    continue;
                }

                if (enableGoal && (runtime.netFollowBacks >= targetFollowBacks)) {
                   break;
                }

                const usersResponse = await fetchUserListFor(account, {
                    username: currentTarget,
                    offset: offset,
                    limit: pageLimit,
                    type: typeToFetch
                });

                if (!usersResponse.success) {
                    log('error', `[${accName}] Failed to fetch users for ${currentTarget}: ${usersResponse.details}. Retrying in 60s.`, accName);
                    await sleep(60);
                    continue;
                }

                const users = usersResponse.data;
                if (!users || users.length === 0) {
                    log('info', `[${accName}] Finished with target ${currentTarget}. Moving to next.`, accName);
                    continueLooping = false;
                    continue;
                }

                let batchCount = 0;
                for (const user of users) {
                    if (!runtime.running) break;

                    const uid = user.user?.uid;
                    const username = user.user?.username || "N/A";
                    const isFollowing = user.is_following;

                    if (!uid || isFollowing || runtime.processedUIDs.has(uid)) {
                        if (isFollowing) log('warn', `[${accName}] [SKIP] Already following ${username}`, accName);
                        if (runtime.processedUIDs.has(uid)) log('warn', `[${accName}] [SKIP] Already processed ${username} in this session`, accName);
                        continue;
                    }
                    
                    runtime.processedUIDs.add(uid);
                    log('info', `[${accName}] Attempting to follow user: ${username}`, accName);
                    const followResponse = await followUserFor(account, uid);

                    if (followResponse.success) {
                        runtime.followCount++;
                        runtime.followHistory.push({ uid, username, when: Date.now(), unfollowed: false });
                        log('success', `[${accName}] [SUCCESS] Followed ${username} (total follows this run: ${runtime.followCount})`, accName);

                        if (enableDiscovery && Math.random() < discoveryRate && runtime.discoveredTargets.length < maxDiscoveryQueue) {
                            if (!runtime.discoveredTargets.includes(username) && !mainTargets.includes(username)) {
                                runtime.discoveredTargets.push(username);
                                log('info', `[${accName}] [DISCOVERY] Added ${username} to queue. Queue size: ${runtime.discoveredTargets.length}`, accName);
                            }
                        }
                    } else {
                        log('error', `[${accName}] [ERROR] Failed to follow ${username}: ${followResponse.details}`, accName);
                    }

                    batchCount++;
                    await sleep(followDelaySec);

                    if (batchCount >= followBatch) {
                        log('info', `[${accName}] Batch of ${followBatch} completed. Waiting ${batchDelay} seconds...`, accName);
                        if (enableGoal) {
                            const goalMet = await checkFollowBacksAndUnfollowIfComplete(account, runtime);
                            if (goalMet) break;
                        }
                        await sleep(batchDelay);
                        batchCount = 0;
                    }
                }
                if (enableGoal && (runtime.netFollowBacks >= targetFollowBacks)) break;
                offset++;
            }
        } catch (error) {
            log('error', `[${accName}] Error processing target ${currentTarget}: ${error.message}`, accName);
            await sleep(60);
        }
    }
    log('info', `[${accName}] Follow & Discover loop stopped for account.`, accName);
}

// --- Unfollow loop for account (Original logic, kept for non-goal-driven use) ---
async function runUnfollowLoopForAccount(account) {
    const accName = account.name;
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
            followHistory: [],
            initialFollowers: account.initialFollowers || 0,
            netFollowBacks: account.netFollowBacks || 0,
            processedUIDs: new Set(),
            running: false,
            isPaused: false
        };
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
    scheduleNextClaimCheckForAccount(account);
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
    const key = account.id || account.name;
    if (claimTimers[key]) clearTimeout(claimTimers[key]);
    log('warn', `Stopped worker loop for account: ${account.name}`, account.name);
}

// --- Firestore real-time listeners ---
function attachConfigListener() {
    try {
        db.collection('config').doc('global').onSnapshot(doc => {
            if (doc.exists) {
                const remote = doc.data();
                config = { ...config, ...remote };
                log('success', 'Global config updated live from Firestore.');
            }
        }, err => {
            log('error', `Config listener error: ${err.message}`);
        });
        log('info', 'Attached Firestore listener to global config.');
    } catch (err) {
        log('error', `Failed to attach config listener: ${err.message}`);
    }
}

function attachAccountsListener() {
    try {
        const accountsRef = db.collection('accounts');
        accountsRef.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const doc = change.doc;
                const id = doc.id;
                const data = { id, ...doc.data() };
                const idx = config.accounts.findIndex(a => a.id === id);

                if (change.type === 'added') {
                    log('info', `Firestore: account added -> ${data.name}`, data.name);
                    if (idx === -1) config.accounts.push(data);
                    else config.accounts[idx] = data;
                    if (data.active !== false) startAccountLoop(data);
                } else if (change.type === 'modified') {
                    log('info', `Firestore: account modified -> ${data.name}`, data.name);
                    if (idx === -1) config.accounts.push(data);
                    else config.accounts[idx] = data;

                    if (accountRuntimes[data.name]) {
                        accountRuntimes[data.name].initialFollowers = data.initialFollowers || accountRuntimes[data.name].initialFollowers || 0;
                    }
                    
                    if (data.active === false) stopAccountLoop(data);
                    else startAccountLoop(data);
                } else if (change.type === 'removed') {
                    log('info', `Firestore: account removed -> ${data.name}`, data.name);
                    config.accounts = config.accounts.filter(a => a.id !== id);
                    stopAccountLoop(data);
                }
            });
        }, err => {
            log('error', `Accounts listener error: ${err.message}`);
        });
        log('info', 'Attached Firestore listener to accounts collection.');
    } catch (err) {
        log('error', `Failed to attach accounts listener: ${err.message}`);
    }
}

// --- Interactive Settings Edit (uses Firestore save) ---
async function editSettings() {
    if (!inquirer) {
        try { inquirer = require('inquirer'); } catch (e) {
            log('error', 'The "inquirer" package is required for interactive menus.', 'system');
            return;
        }
    }

    console.clear();
    log('title', '=== Edit Configuration ===');

    const { selection } = await inquirer.prompt([{
        type: 'list',
        name: 'selection',
        message: 'What would you like to edit?',
        choices: [
            { name: 'Edit common settings (delays, batch sizes, discovery)', value: 'common' },
            { name: 'Back', value: 'back' }
        ]
    }]);

    if (selection === 'common') {
        const questions = [
            { type: 'input', name: 'targetUsernames', message: 'Initial Target Usernames (comma-separated):', default: Array.isArray(config.targetUsernames) ? config.targetUsernames.join(',') : "" },
            { type: 'confirm', name: 'enableDiscovery', message: 'Enable Automatic Target Discovery?', default: config.enableDiscovery },
            { type: 'number', name: 'discoveryRate', message: 'Discovery Rate (0.0 to 1.0):', default: config.discoveryRate, when: answers => answers.enableDiscovery },
            { type: 'number', name: 'maxDiscoveryQueue', message: 'Max Discovered Targets:', default: config.maxDiscoveryQueue, when: answers => answers.enableDiscovery },
            { type: 'list', name: 'targetType', message: 'Target Type:', choices: ['follower', 'following', 'both'], default: config.targetType },
            { type: 'number', name: 'claimHourUTC', message: 'Hour for daily claim (UTC, 0-23):', default: config.claimHourUTC },
            { type: 'number', name: 'followDelay', message: 'Delay between follows (s):', default: config.followDelay },
            { type: 'number', name: 'followBatchSize', message: 'Follows per batch:', default: config.followBatchSize },
            { type: 'number', name: 'batchDelay', message: 'Delay between batches (s):', default: config.batchDelay },
            { type: 'input', name: 'unfollowWhitelist', message: 'Unfollow Whitelist (comma-separated):', default: config.unfollowWhitelist.join(',') },
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
        log('warn', 'No accounts configured. Please add at least one account in Firestore.');
        await sleep(2);
        return mainMenu();
    }
    log('title', 'Starting Multi-Account Continuous Cycle');
    const activeAccounts = config.accounts.filter(a => a.active !== false);
    for (const account of activeAccounts) {
        startAccountLoop(account);
    }
    log('success', `All ${activeAccounts.length} active accounts are running in the background. Press 'm' to return to the menu.`);
    await sleep(2);
}

async function mainMenu() {
    if (!inquirer) {
        try { inquirer = require('inquirer'); } catch (e) {
            log('error', 'The "inquirer" package is required for interactive menus.', 'system');
            return;
        }
    }

    console.clear();
    log('title', '=== ECOX Follower Bot (v3) ===');
    log('info', `Total Accounts Loaded: ${config.accounts.length}`);
    log('info', `Active Workers: ${config.accounts.filter(a => accountRuntimes[a.name] && accountRuntimes[a.name].running).length}`);
    log('info', `Global Discovery: ${config.enableDiscovery ? 'ON' : 'OFF'}`);

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Select an action:',
        choices: [
            { name: 'Start/Resume All Active Account Loops', value: 'start' },
            { name: 'Stop All Account Loops', value: 'stop' },
            { name: 'Run Standard Unfollow Pass (All Accounts)', value: 'unfollow' },
            { name: 'Edit Global Settings (Firestore)', value: 'edit' },
            { name: 'Exit', value: 'exit' }
        ]
    }]);

    switch (action) {
        case 'start':
            await startMultiAccountCycle();
            break;
        case 'stop':
            config.accounts.forEach(stopAccountLoop);
            await sleep(1);
            return mainMenu();
        case 'unfollow':
            log('warn', 'Standard unfollow can be destructive.', 'system');
            const { confirmUnfollow } = await inquirer.prompt([{ type: 'confirm', name: 'confirmUnfollow', message: 'Are you sure?', default: false }]);
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
            log('title', 'Exiting program.', 'system');
            config.accounts.forEach(stopAccountLoop);
            process.exit(0);
    }
}

// --- Initialization ---
async function init() {
    log('title', 'Starting ECOX Bot Initializer...');
    await loadConfigFromFirestore();
    attachConfigListener(); // Attach listener for global config
    attachAccountsListener();
    await mainMenu();
}

init().catch(err => {
    log('error', `Fatal Initialization Error: ${err.message}`);
    process.exit(1);
});
