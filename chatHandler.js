// chatHandler.js

const PacketType = require('./packetTypes');

//Handle an incoming chat packet
function handleChatPacket(clientId, decoded, binaryMessage, state, log) {
    const [senderId, packetType, text] = decoded;
    
    if (!text || typeof text !== 'string') {
        log('WARN', 'Invalid chat message', { clientId });
        return;
    }

    // Find which room this client is in
    const room = Array.from(state.userRooms.entries())
        .find(([_, roomData]) => roomData.clients.has(clientId));
    
    if (!room) {
        log('WARN', 'Client not in any room', { clientId });
        return;
    }

    const [roomId, roomData] = room;
    log('INFO', 'Chat message received', { clientId, senderId, text, roomId });

    broadcastToRoom(roomId, clientId, binaryMessage, state, roomData);
    updateClientStats(clientId, PacketType.CHAT, state);
}

function broadcastToRoom(roomId, senderId, binaryMessage, state, roomData) {
    roomData.clients.forEach(clientId => {
        if (clientId !== senderId) {
            const clientSocket = state.activeConnections.get(clientId);
            if (clientSocket && clientSocket.readyState === 1) {
                clientSocket.send(binaryMessage);
            }
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
    handleChatPacket
};
