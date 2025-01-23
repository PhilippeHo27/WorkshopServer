// chatHandler.js

const PacketType = require('./packetTypes');

//Handle an incoming chat packet
function handleChatPacket(clientId, decoded, binaryMessage, state, log) {
    const [senderId, packetType, text] = decoded;
    
    if (!text || typeof text !== 'string') {
        log('WARN', 'Invalid chat message', { clientId });
        return;
    }

    const roomId = state.userRooms.get(clientId);
    log('INFO', 'Chat message received', { clientId, senderId, text, roomId});

    if (roomId !== undefined && roomId !== null) {
        broadcastToRoom(roomId, clientId, binaryMessage, state);
    }

    updateClientStats(clientId, PacketType.CHAT, state);
}

function broadcastToRoom(roomId, senderId, binaryMessage, state) {
    const roomMembers = Array.from(state.userRooms.entries())
    .filter(entry => entry[1] === roomId)
    .map(entry => entry[0]); 
    
    roomMembers.forEach(clientId => {
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
