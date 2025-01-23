// positionHandler.js
const PacketType = require('./packetTypes');
const { broadcastToRoom } = require('./roomManager');

function handlePositionPacket(clientId, decoded, originalMessage, state, log) {
    const [senderId, packetType, objectId, posX, posY, posZ] = decoded;

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


function fastBroadcast(senderId, binaryMessage, state) {
    state.clients.forEach((socket, id) => {
        if (id !== senderId && socket.readyState === 1) {
            socket.send(binaryMessage);
        }
    });
}


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
