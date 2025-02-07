// chatHandler.js

function handleChatPacket(clientId, decoded, binaryMessage, state, log) {
    const [senderId, packetType, text] = decoded;
    
    if (!text || typeof text !== 'string') {
        log('Invalid chat message', { clientId });
        return;
    }

    // Find which room this client is in
    const room = Array.from(state.userRooms.entries())
        .find(([_, roomData]) => roomData.clients.has(clientId));
    
    if (!room) {
        log('Client not in any room', { clientId });
        return;
    }

    const [roomId, roomData] = room;
    log('Chat message received', { clientId, senderId, text, roomId });

    broadcastToRoom(clientId, binaryMessage, state, roomData);
}

function broadcastToRoom(senderId, binaryMessage, state, roomData) {
    roomData.clients.forEach(clientId => {
        if (clientId !== senderId) {
            const clientSocket = state.activeConnections.get(clientId);
            if (clientSocket && clientSocket.readyState === 1) {
                clientSocket.send(binaryMessage);
            }
        }
    });
}

module.exports = {
    handleChatPacket
};
