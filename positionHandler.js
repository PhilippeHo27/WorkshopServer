// positionHandler.js
const PacketType = require('./packetTypes');
const { broadcastToRoom } = require('./roomManager');

/**
 * Handle an incoming POSITION packet. 
 * Example structure of decoded data might be:
 * [senderId, PacketType.POSITION, sequence, objectId, posX, posY, posZ, (optional) roomId]
 */
function handlePositionPacket(clientId, decoded, originalMessage, state, log) {
    // destructure as needed
    // e.g. [senderId, type, sequence, objectId, posX, posY, posZ, roomId?]
    const [senderId, packetType, sequence, objectId, posX, posY, posZ, roomId] = decoded;

    log('INFO', 'Position update received', {
        clientId,
        senderId,
        objectId,
        coords: { x: posX, y: posY, z: posZ },
        roomId
    });

    // If there's a roomId, broadcast only to that room
    if (roomId !== undefined && roomId !== null) {
        broadcastToRoom(roomId, clientId, originalMessage, state.clients);
    } else {
        // Otherwise, do a global broadcast (like chatHandler’s fastBroadcast)
        fastBroadcast(clientId, originalMessage, state);
    }

    // Optional: update stats or track positions
    updateClientStats(clientId, PacketType.POSITION, state);
}

/**
 * Broadcast to everyone except the sender.
 */
function fastBroadcast(senderId, binaryMessage, state) {
    state.clients.forEach((socket, id) => {
        if (id !== senderId && socket.readyState === 1) {
            socket.send(binaryMessage);
        }
    });
}

/**
 * Update client stats if needed (similar to chatHandler.js).
 */
function updateClientStats(clientId, packetType, state) {
    const clientInfo = state.clientConnections.get(clientId);
    if (!clientInfo) return;
    clientInfo.lastMessageTime = Date.now();
    clientInfo.messageCount++;
    // Track position messages if you’d like
    if (packetType === PacketType.POSITION) {
        clientInfo.positionUpdateCount = (clientInfo.positionUpdateCount || 0) + 1;
    }
}

module.exports = {
    handlePositionPacket
};
