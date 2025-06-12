// server.js
const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const { routePacket } = require('./packetRouter');
const PacketType = require('./packetTypes');
const { handleRoomLeavePacket } = require('./roomHandlers');
const { updateUserNamesToClients } = require('./userInfoHandler');
const { handleClientDisconnect } = require('./matchmakingHandler');


// 1) Server Configuration
const SERVER_CONFIG = {
    port: 8080,
    timeSync: {
        interval: 1000,
        enabled: false
    }
};

const PERMANENT_ROOMS = {
    PONG_ROOM: 'pongRoom',
    LOBBY_ROOM: 'lobbyRoom'
};

// 2) Server State
const ACTIVE_DATA = {
    usedClientIds: new Set(),
    userNames: new Map(),
    activeConnections: new Map(),
    clientConnections: new Map(),
    userRooms: new Map()
};

// 4) Simple Logger
function log(message, data = {}) {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${
        String(d.getMinutes()).padStart(2, '0')}:${
        String(d.getSeconds()).padStart(2, '0')}.${
        String(d.getMilliseconds()).padStart(3, '0')}`;
    console.log(JSON.stringify({ t, message, ...data }));
}

// 4) Utility: Generate next client ID
let nextClientId = 1;
function getNextAvailableClientId() {
    const id = nextClientId++;  // ← That's it. Done. Atomic.
    ACTIVE_DATA.usedClientIds.add(id);  // Optional for tracking
    return id;
}

// 5) Utility: Create new client connection info
function createClientConnectionInfo() {
    return {
        connectTime: Date.now(),
        roomId: null
    };
}

// 6) Utility: Encode / Decode
function encodePacket(packetArray) {
    return msgpack.encode(packetArray);
}

function decodeMsgPack(message) {
    try {
        const decoded = msgpack.decode(message, {
            useDefaults: true,
            ignoreUndefined: true,
            requireAllProperties: false,
            extensionCodec: new msgpack.ExtensionCodec(),
            context: undefined,
        });
        log('Decoded MessagePack data', {
            raw: Array.from(message).slice(0, 20),
            decoded
        });
        return decoded;
    } catch (error) {
        log('MessagePack decode failed', {
            error: error.message,
            messageLength: message.length
        });
        return null;
    }
}


// 7) Time Sync
let globalSequenceNumber = 0;
function getNextSequenceNumber() {
    return globalSequenceNumber++;
}

function sendTimeSync() {
    const currentTime = Date.now();
    const packet = [
        0,
        PacketType.TIME_SYNC,
        getNextSequenceNumber(),
        currentTime
    ];
    const encodedPacket = encodePacket(packet);

    ACTIVE_DATA.activeConnections.forEach((client, id) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(encodedPacket);
            log('Sent TIME_SYNC packet', { clientId: id, serverTime: currentTime });
        }
    });
}

// 8) ID Assignment
function sendClientIdAssignment(socket, clientId) {
    const packet = [
        0,
        PacketType.ID_ASSIGN,
        clientId
    ];
    const encodedPacket = encodePacket(packet);
    socket.send(encodedPacket);
    log('Sent ID_ASSIGN packet', { clientId, encodedPacket: Array.from(encodedPacket) });
}

// 9) Handle Connections and Disconnections
function handleNewConnection(socket) {
    const clientId = getNextAvailableClientId();
    setupNewClient(clientId, socket);
    setupClientEventListeners(clientId, socket);
}

function setupNewClient(clientId, socket) {
    log('New client connected', { clientId });
    ACTIVE_DATA.activeConnections.set(clientId, socket);
    ACTIVE_DATA.clientConnections.set(clientId, createClientConnectionInfo());
    sendClientIdAssignment(socket, clientId);
}

function setupClientEventListeners(clientId, socket) {
    socket.on('message', (message) => {
        routePacket(clientId, message, ACTIVE_DATA, log, decodeMsgPack);
    });

    socket.on('close', () => {
        handleClientDisconnection(clientId);
    });

    socket.on('error', (error) => {
        log('Socket error', { clientId, error: error.message });
    });
}

function handleClientDisconnection(clientId) {
    try {
        const clientInfo = ACTIVE_DATA.clientConnections.get(clientId);
        
        log('Client disconnected', {
            clientId,
            roomId: clientInfo?.roomId,
            stats: clientInfo ? {
                connectTime: clientInfo.connectTime,
                disconnectTime: Date.now(),
                connectionDuration: Date.now() - clientInfo.connectTime
            } : null
        });

        // 1. Handle game-specific cleanup FIRST (while clientInfo still exists)
        if (clientInfo?.roomId) {
            // Game-specific disconnection handling
            handleClientDisconnect(clientId, ACTIVE_DATA, log);
            
            // Room departure handling
            handleRoomLeavePacket(clientId, clientInfo.roomId, ACTIVE_DATA, log, PERMANENT_ROOMS);
        }

        // 2. Clean up client data AFTER game cleanup
        ACTIVE_DATA.activeConnections.delete(clientId);
        ACTIVE_DATA.clientConnections.delete(clientId);
        ACTIVE_DATA.usedClientIds.delete(clientId);
        ACTIVE_DATA.userNames.delete(clientId);
        
        // 3. Update other clients
        updateUserNamesToClients(ACTIVE_DATA, log);
        
    } catch (error) {
        log('Error during client disconnection cleanup', { 
            clientId, 
            error: error.message 
        });
    }
}

// 10) Server Initialization
function initializePermanentRooms() {
    ACTIVE_DATA.userRooms.set(PERMANENT_ROOMS.PONG_ROOM, {
        clients: new Set(),
    });
    ACTIVE_DATA.userRooms.set(PERMANENT_ROOMS.LOBBY_ROOM, {
        clients: new Set(),
    });
}

const server = new WebSocket.Server({ port: SERVER_CONFIG.port });
initializePermanentRooms();
server.on('connection', handleNewConnection);
log('WebSocket server started', { });
