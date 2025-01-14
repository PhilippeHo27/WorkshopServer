// server.js
const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const { routePacket } = require('./packetRouter');
const PacketType = require('./packetTypes');

// 1) Server Configuration
const SERVER_CONFIG = {
    port: 8080,
    timeSync: {
        interval: 1000, // in milliseconds
        enabled: true
    }
};

// 2) Logging Levels (optional)
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 3) Server State
const STATE = {
    usedClientIds: new Set(),
    clients: new Map(),            // clientId -> WebSocket
    clientConnections: new Map()   // clientId -> connection info
};

// 4) Simple Logger
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

// 5) Utility: Generate next client ID
function getNextAvailableClientId() {
    let id = 1;
    while (STATE.usedClientIds.has(id)) {
        id++;
    }
    STATE.usedClientIds.add(id);
    return id;
}

// 6) Utility: Create new client connection info
function createClientConnectionInfo() {
    return {
        connectTime: Date.now(),
        lastMessageTime: null,
        messageCount: 0,
        chatCount: 0
    };
}

// 7) Utility: Encode / Decode
function encodePacket(packetArray) {
    return msgpack.encode(packetArray);
}

function decodeMsgPack(message) {
    try {
        const decoded = msgpack.decode(message);
        log('DEBUG', 'Decoded MessagePack data', {
            raw: Array.from(message).slice(0, 20),
            decoded
        });
        return decoded;
    } catch (error) {
        log('ERROR', 'MessagePack decode failed', {
            error: error.message,
            messageLength: message.length
        });
        return null;
    }
}

// 8) Time Sync
let globalSequenceNumber = 0;
function getNextSequenceNumber() {
    return globalSequenceNumber++;
}

function sendTimeSync() {
    const currentTime = Date.now();
    const packet = [
        0, // senderId 0 for server
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

// 9) ID Assignment
function sendClientIdAssignment(socket, clientId) {
    const packet = [
        0, // server as sender
        PacketType.ID_ASSIGN,
        getNextSequenceNumber(),
        clientId
    ];
    const encodedPacket = encodePacket(packet);
    socket.send(encodedPacket);
    log('DEBUG', 'Sent ID_ASSIGN packet', { clientId, encodedPacket: Array.from(encodedPacket) });
}

// 10) Handle Connections and Disconnections
function handleNewConnection(socket) {
    const clientId = getNextAvailableClientId();
    setupNewClient(clientId, socket);
    setupClientEventListeners(clientId, socket);
}

function setupNewClient(clientId, socket) {
    log('INFO', 'New client connected', { clientId });
    STATE.clients.set(clientId, socket);
    STATE.clientConnections.set(clientId, createClientConnectionInfo());
    sendClientIdAssignment(socket, clientId);
}

function setupClientEventListeners(clientId, socket) {
    socket.on('message', (message) => {
        routePacket(clientId, message, STATE, log, decodeMsgPack);
    });

    socket.on('close', () => {
        handleClientDisconnection(clientId);
    });

    socket.on('error', (error) => {
        log('ERROR', 'Socket error', { clientId, error: error.message });
    });
}

function handleClientDisconnection(clientId) {
    const clientInfo = STATE.clientConnections.get(clientId);
    log('INFO', 'Client disconnected', {
        clientId,
        stats: {
            connectTime: clientInfo ? clientInfo.connectTime : 0,
            disconnectTime: Date.now(),
            totalMessages: clientInfo ? clientInfo.messageCount : 0,
            chatMessages: clientInfo ? clientInfo.chatCount : 0,
            connectionDuration: clientInfo ? Date.now() - clientInfo.connectTime : 0
        }
    });

    STATE.clients.delete(clientId);
    STATE.clientConnections.delete(clientId);
    STATE.usedClientIds.delete(clientId);
}

// 11) Server Initialization
const server = new WebSocket.Server({ port: SERVER_CONFIG.port });

server.on('connection', handleNewConnection);

if (SERVER_CONFIG.timeSync.enabled) {
    setInterval(sendTimeSync, SERVER_CONFIG.timeSync.interval);
}

log('INFO', 'WebSocket server started', { port: SERVER_CONFIG.port });
