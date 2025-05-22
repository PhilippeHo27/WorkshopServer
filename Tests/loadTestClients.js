// projectnameserver/test/loadTestClients.js

const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');

// --- Configuration ---
const NUM_CLIENTS = 30;
// const SERVER_URL = 'ws://localhost:8080'; // For local testing
const SERVER_URL = 'ws://3.99.70.5:8080'; // Your AWS Ubuntu server
const CONNECT_DELAY_MS = 100; // Stagger connections by up to 100ms

// --- Packet Types (EXACTLY matching your server's packetTypes.js) ---
const PacketType = {
    CHAT: 0,
    POSITION: 1,
    ID_ASSIGN: 2,
    TIME_SYNC: 3,
    ROOM_CREATE: 4,
    ROOM_JOIN: 5,
    ROOM_LEAVE: 6,
    ROOM_DESTROY: 7,
    SERVER_RESPONSE: 8,
    USER_INFO: 9,
    HIDDEN_GAME: 10,             // Corrected
    HIDDEN_GAME_IMMUNE: 11,      // Corrected
    HIDDEN_GAME_CONFIRM_START: 12, // Corrected
    MATCH_MAKING_REQUEST: 13,
    MATCH_FOUND: 14,
    GAME_START_INFO: 15,
    OPPONENT_DISCONNECTED: 17,
    EXTRA_TURN_MOVES: 18        // Corrected
};


// --- Helper to create packets ---
// Your server expects an array: [senderId, packetType, ...payload]
// For client-sent packets initially, senderId can be 0 or a placeholder,
// as the server will use the connection's assigned clientId.
// Your C# code sets `package.SenderId = _clientId;` before sending.
// The server seems to use `clientId` from the connection, and `decoded[0]` is the client-echoed senderId.

function createUserInfoPacket(clientNumericId, userName) {
    // Based on your C# StringPacket for UserInfo and server's storeUserName
    // Server expects: [clientEchoedSenderId, PacketType.USER_INFO, userNameString]
    return msgpack.encode([clientNumericId, PacketType.USER_INFO, userName]);
}

function createMatchmakingRequestPacket(clientNumericId, isSearching) {
    // Based on your C# MatchmakingRequest
    // Server expects: [clientEchoedSenderId, PacketType.MATCH_MAKING_REQUEST, isSearchingBoolean]
    return msgpack.encode([clientNumericId, PacketType.MATCH_MAKING_REQUEST, isSearching]);
}

// --- Main Test Logic ---
const clients = [];

async function simulateClient(clientNumericId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        let assignedServerId = null; // This will be the ID assigned by the server

        console.log(`ClientSim ${clientNumericId}: Attempting to connect...`);

        ws.on('open', () => {
            console.log(`ClientSim ${clientNumericId}: Connected.`);
            clients.push({ id: clientNumericId, ws: ws, serverId: null });

            // 1. Send UserInfo packet
            const userName = `TestUser_${clientNumericId}`;
            console.log(`ClientSim ${clientNumericId}: Sending USER_INFO (Name: ${userName})`);
            ws.send(createUserInfoPacket(0, userName)); // Sending 0 as initial senderId
        });

        ws.on('message', (binaryMessage) => {
            try {
                const decoded = msgpack.decode(binaryMessage);
                // console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId || 'N/A'}): Received`, decoded);

                const serverPacketType = decoded[1];

                if (serverPacketType === PacketType.ID_ASSIGN) {
                    assignedServerId = decoded[2];
                    const clientRef = clients.find(c => c.id === clientNumericId);
                    if (clientRef) clientRef.serverId = assignedServerId;
                    console.log(`ClientSim ${clientNumericId}: Assigned Server ID ${assignedServerId}.`);

                    // 2. Now that we have an ID (or even if we didn't wait, server uses connection ID), send matchmaking request
                    console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): Sending MATCH_MAKING_REQUEST (true).`);
                    ws.send(createMatchmakingRequestPacket(assignedServerId, true));

                } else if (serverPacketType === PacketType.MATCH_FOUND) {
                    const roomId = decoded[2];
                    console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): MATCH_FOUND! Room ID: ${roomId}.`);
                    // TODO: Potentially simulate joining the room or sending game packets
                    // For now, we'll just log and consider it a success for this client.
                    // ws.close(); // Optionally close after match found for this test
                    resolve(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}) successfully matched to room ${roomId}.`);

                } else if (serverPacketType === PacketType.SERVER_RESPONSE) {
                    const success = decoded[2];
                    const message = decoded.length > 3 ? decoded[3] : '';
                     console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): SERVER_RESPONSE: Success: ${success}, Msg: ${message}`);
                } else {
                    // console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): Received unhandled packet type ${serverPacketType}`, decoded);
                }

            } catch (error) {
                console.error(`ClientSim ${clientNumericId}: Error decoding/handling message:`, error, "Raw data:", binaryMessage);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): Disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
            clients.splice(clients.findIndex(c => c.id === clientNumericId), 1);
            // If it disconnects before resolving (e.g. match found), reject or handle as a failed test case.
            // For this example, we'll let it be.
        });

        ws.on('error', (error) => {
            console.error(`ClientSim ${clientNumericId} (ServerID: ${assignedServerId}): WebSocket Error:`, error.message);
            reject(error); // Reject the promise on error
        });

        // Timeout for connection or getting matched
        setTimeout(() => {
             if (ws.readyState !== WebSocket.OPEN || assignedServerId === null) { // Example condition
                console.warn(`ClientSim ${clientNumericId}: Timed out waiting for connection/ID/match.`);
                ws.terminate(); // Force close
                reject(new Error(`ClientSim ${clientNumericId} timed out.`));
            } else if (ws.readyState === WebSocket.OPEN && !clients.find(c => c.id === clientNumericId)?.matched) {
                // If still open but not matched, you might consider this a partial success or timeout
                // For now, let's assume it's still waiting if not explicitly resolved by MATCH_FOUND
            }
        }, 30000); // 30-second timeout per client
    });
}

async function runLoadTest() {
    console.log(`Starting simulation for ${NUM_CLIENTS} clients to ${SERVER_URL}...`);
    const promises = [];
    for (let i = 1; i <= NUM_CLIENTS; i++) {
        // Stagger the start of each client connection attempt
        await new Promise(resolve => setTimeout(resolve, Math.random() * CONNECT_DELAY_MS));
        promises.push(simulateClient(i).catch(e => console.error(`ClientSim ${i} promise failed: ${e.message}`)));
    }

    console.log("All client simulations initiated. Waiting for them to complete or timeout...");
    try {
        const results = await Promise.allSettled(promises);
        console.log("\n--- Load Test Summary ---");
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                console.log(`ClientSim ${index + 1}: SUCCESS - ${result.value}`);
            } else {
                console.log(`ClientSim ${index + 1}: FAILED - ${result.reason}`);
            }
        });
        const successfulMatches = results.filter(r => r.status === 'fulfilled').length;
        console.log(`\nTotal successful client match simulations: ${successfulMatches} out of ${NUM_CLIENTS}`);

    } catch (e) {
        console.error("Error running load test:", e);
    } finally {
        console.log("Load test finished. Closing any remaining connections...");
        clients.forEach(client => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close();
            }
        });
        // Give a moment for close messages to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        process.exit(0); // Exit the script
    }
}

runLoadTest();
