// roomManager.js
// Manages the room logic: create, join, leave, destroy, and broadcast to rooms.

const rooms = new Map();
// Example structure of `rooms`:
// rooms.set(roomId, { clients: new Set([clientId, ...]) });

/**
 * Create a new room if it doesn't already exist.
 * @param {string|number} roomId
 * @returns {boolean} whether creation succeeded
 */
function createRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { clients: new Set() });
        return true;
    }
    return false;
}

/**
 * Join a room, assuming a max capacity (default = 2 for now).
 * @param {string|number} roomId
 * @param {number} clientId
 * @param {number} [maxCapacity=2]
 * @returns {{success: boolean, reason?: string}}
 */
function joinRoom(roomId, clientId, maxCapacity = 2) {
    const room = rooms.get(roomId);
    if (!room) {
        return { success: false, reason: 'Room does not exist.' };
    }
    if (room.clients.size >= maxCapacity) {
        return { success: false, reason: 'Room is full.' };
    }
    room.clients.add(clientId);
    return { success: true };
}

/**
 * Leave a room by removing the client from that room's set of clients.
 * @param {string|number} roomId
 * @param {number} clientId
 */
function leaveRoom(roomId, clientId) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.clients.delete(clientId);

    // Optionally auto-destroy room if empty
    if (room.clients.size === 0) {
        rooms.delete(roomId);
    }
}

/**
 * Destroy a room manually (e.g., if requested by a client).
 * @param {string|number} roomId
 */
function destroyRoom(roomId) {
    rooms.delete(roomId);
}

/**
 * Broadcast a binary message to all clients in a specific room,
 * except the sender (if you want).
 * @param {string|number} roomId
 * @param {number} senderId
 * @param {Buffer} binaryMessage
 * @param {Map<number, WebSocket>} clientMap
 */
function broadcastToRoom(roomId, senderId, binaryMessage, clientMap) {
    const room = rooms.get(roomId);
    if (!room) return;

    for (const cId of room.clients) {
        if (cId === senderId) continue;
        const clientSocket = clientMap.get(cId);
        if (clientSocket && clientSocket.readyState === 1) { // WebSocket.OPEN
            clientSocket.send(binaryMessage);
        }
    }
}

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    destroyRoom,
    broadcastToRoom
};
