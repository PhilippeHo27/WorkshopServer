const PacketType = require('./packetTypes');

function handlePositionPacket(clientId, decoded, binaryMessage, state, log) {
    const [senderId, packetType, objectId, posX, posY, posZ] = decoded;

    // Find which room this client is in
    const room = Array.from(state.userRooms.entries())
        .find(([_, roomData]) => roomData.clients.has(clientId));
    
    // log('INFO', 'Position update received', {
    //     clientId,
    //     senderId,
    //     objectId,
    //     coords: { x: posX, y: posY, z: posZ },
    //     roomId: room ? room[0] : 'broadcast'
    // });

    if (room) {
        // If in a room, broadcast to room members
        const [roomId, roomData] = room;
        broadcastToRoom(roomId, clientId, binaryMessage, state, roomData);
    } else {
        // If not in a room, broadcast to all connected clients
        broadcastToAll(clientId, binaryMessage, state);
    }

    updateClientStats(clientId, PacketType.POSITION, state);
}

// New function to broadcast to all clients
function broadcastToAll(senderId, binaryMessage, state) {
    state.activeConnections.forEach((clientSocket, clientId) => {
        if (clientId !== senderId && clientSocket.readyState === 1) {
            clientSocket.send(binaryMessage);
        }
    });
}

function updateClientStats(clientId, packetType, state) {
    const clientInfo = state.clientConnections.get(clientId);
    if (!clientInfo) return;
    clientInfo.lastMessageTime = Date.now();
    clientInfo.messageCount++;
    if (packetType === PacketType.CHAT) {
        clientInfo.chatCount++;
    }
}

module.exports = {
    handlePositionPacket
};
