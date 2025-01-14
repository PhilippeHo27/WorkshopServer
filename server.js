const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');

// 1) Server Configuration
const SERVER_CONFIG = {
    port: 8080,
    timeSync: {
        interval: 1000, // in milliseconds
        enabled: true
    }
};

// 2) Packet Types Enumeration
const PacketType = {
    CHAT: 0,
    POSITION: 1,
    ID_ASSIGN: 2,     // New PacketType for ID assignment
    TIME_SYNC: 3      // New PacketType for Time Synchronization
};

// 3) Logging Levels
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 4) Server State Management
const STATE = {
    usedClientIds: new Set(),
    clients: new Map(),
    clientConnections: new Map()
};

// 5) Logging System
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(
        JSON.stringify({
            timestamp,
            level: LOG_LEVELS[level],
            message,
            ...data
        })
    );
}

// 6) Utility Functions

// Create a new client connection info object
function createClientConnectionInfo() {
    return {
        connectTime: Date.now(),
        lastMessageTime: null,
        messageCount: 0,
        chatCount: 0,
        positionCount: 0
    };
}

// Get the next available client ID
function getNextAvailableClientId() {
    let id = 1;
    while (STATE.usedClientIds.has(id)) {
        id++;
    }
    STATE.usedClientIds.add(id);
    return id;
}

// Update client statistics based on packet type
function updateClientStats(clientId, packetType) {
    const clientInfo = STATE.clientConnections.get(clientId);
    if (clientInfo) {
        clientInfo.lastMessageTime = Date.now();
        clientInfo.messageCount++;
        if (packetType === PacketType.CHAT) {
            clientInfo.chatCount++;
        } else if (packetType === PacketType.POSITION) {
            clientInfo.positionCount++;
        }
    }
}

// Encode a packet into MessagePack format
function encodePacket(packetArray) {
    return msgpack.encode(packetArray);
}

// Decode a MessagePack-encoded message
function decodeMsgPack(message) {
    try {
        const decoded = msgpack.decode(message);
        log('DEBUG', 'Decoded MessagePack data', {
            raw: Array.from(message),
            decoded: decoded,
            type: decoded[1], // PacketType is at index 1
            typeOf: typeof decoded[1]
        });
        return decoded;
    } catch (error) {
        log('ERROR', 'MessagePack decode failed', {
            error: error.message,
            messageLength: message.length,
            messagePreview: Array.from(message.slice(0, 20))
        });
        return null;
    }
}

// 7) Packet Handlers

// Handle Chat Packets
function handleChatPacket(clientId, decoded, originalMessage) {
    const [senderId, type, sequence, text] = decoded;
    log('INFO', 'Chat message received', {
        clientId,
        senderId,
        sequence,
        message: text
    });

    // Broadcast the chat message to all other clients
    fastBroadcast(clientId, originalMessage);
    updateClientStats(clientId, PacketType.CHAT);
}

// Handle Position Packets
function handlePositionPacket(clientId, decoded, originalMessage) {
    // Assuming the position data is structured as [senderId, PacketType, sequence, objectId, x, y, z]
    log('DEBUG', 'Position update received', {
        clientId,
        position: {
            x: decoded[4],
            y: decoded[5],
            z: decoded[6]
        }
    });

    // Broadcast the position update to all other clients
    fastBroadcast(clientId, originalMessage);
    updateClientStats(clientId, PacketType.POSITION);
}

// Handle ID Assignment Packets (System Messages)
function handleIdAssignPacket(clientId, decoded) {
    const [senderId, type, sequence, assignedClientId] = decoded;
    log('INFO', 'ID assignment sent to client', {
        clientId,
        assignedClientId
    });

    // Update the client's ID if necessary
    // This depends on how the client handles ID assignment
}

// Handle Time Sync Packets (System Messages)
function handleTimeSyncPacket(clientId, decoded) {
    const [senderId, type, sequence, serverTime] = decoded;
    log('DEBUG', 'Time synchronization sent to client', {
        clientId,
        serverTime
    });

    // Optionally handle client acknowledgment of time sync
}

// 8) Packet Routing
function routePacket(clientId, message) {
    if (Buffer.isBuffer(message)) {
        const decoded = decodeMsgPack(message);
        if (!decoded || !Array.isArray(decoded)) return;

        const packetType = decoded[1];
        switch (packetType) {
            case PacketType.CHAT:
                handleChatPacket(clientId, decoded, message);
                break;
            case PacketType.POSITION:
                handlePositionPacket(clientId, decoded, message);
                break;
            default:
                log('WARN', 'Unknown packet type', { clientId, type: packetType, decoded });
        }
    } else {
        // All messages should now be binary (MessagePack). Log a warning if text is received.
        log('WARN', 'Received non-binary message. Ignoring.', { clientId });
    }
}

// 9) Broadcasting Functions

// Fast broadcast to all clients except the sender
function fastBroadcast(senderId, binaryMessage) {
    STATE.clients.forEach((client, id) => {
        if (id !== senderId && client.readyState === WebSocket.OPEN) {
            client.send(binaryMessage);
        }
    });
}

// 10) Client Management

// Set up a new client connection
function setupNewClient(clientId, socket) {
    log('INFO', 'New client connected', { clientId });
    STATE.clients.set(clientId, socket);
    STATE.clientConnections.set(clientId, createClientConnectionInfo());
    sendClientIdAssignment(socket, clientId);
}

// Handle new WebSocket connections
function handleNewConnection(socket) {
    const clientId = getNextAvailableClientId();
    setupNewClient(clientId, socket);
    setupClientEventListeners(clientId, socket);
}

// Set up event listeners for a client
function setupClientEventListeners(clientId, socket) {
    socket.on('message', (message) => routePacket(clientId, message));
    socket.on('close', () => handleClientDisconnection(clientId));
    socket.on('error', (error) => {
        log('ERROR', 'Socket error', { clientId, error: error.message });
    });
}

// Send ID assignment to the client in MessagePack format
function sendClientIdAssignment(socket, clientId) {
    const packet = [
        0, // SenderId for server can be 0 or another designated ID
        PacketType.ID_ASSIGN,
        getNextSequenceNumber(),
        clientId
    ];
    const encodedPacket = encodePacket(packet);
    socket.send(encodedPacket);
    log('DEBUG', 'Sent ID_ASSIGN packet', { clientId, encodedPacket: Array.from(encodedPacket) });
}

// Handle client disconnection
function handleClientDisconnection(clientId) {
    const clientInfo = STATE.clientConnections.get(clientId);
    log('INFO', 'Client disconnected', {
        clientId,
        stats: {
            connectTime: clientInfo?.connectTime,
            disconnectTime: Date.now(),
            totalMessages: clientInfo?.messageCount || 0,
            chatMessages: clientInfo?.chatCount || 0,
            positionUpdates: clientInfo?.positionCount || 0,
            connectionDuration: clientInfo ? Date.now() - clientInfo.connectTime : 0
        }
    });

    STATE.clients.delete(clientId);
    STATE.clientConnections.delete(clientId);
    STATE.usedClientIds.delete(clientId);
}

// 11) Time Synchronization (Optional)

// Send time synchronization packets to all clients
function sendTimeSync() {
    const currentTime = Date.now();
    const packet = [
        0, // SenderId for server
        PacketType.TIME_SYNC,
        getNextSequenceNumber(),
        currentTime
    ];
    const encodedPacket = encodePacket(packet);

    STATE.clients.forEach((client, id) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(encodedPacket);
            log('DEBUG', 'Sent TIME_SYNC packet', { clientId: id, serverTime: currentTime });
        }
    });
}

// 12) Sequence Number Management
let globalSequenceNumber = 0;

// Get the next sequence number, wrapping around if necessary
function getNextSequenceNumber() {
    return globalSequenceNumber++;
}

// 13) Server Initialization

// Create a new WebSocket server
const server = new WebSocket.Server({ port: SERVER_CONFIG.port });

// Handle new connections
server.on('connection', handleNewConnection);

// Initialize Time Synchronization if enabled
if (SERVER_CONFIG.timeSync.enabled) {
    setInterval(sendTimeSync, SERVER_CONFIG.timeSync.interval);
}

// Log that the server has started
log('INFO', 'WebSocket server started', { port: SERVER_CONFIG.port });
