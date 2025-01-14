// chatHandler.js
// Contains logic for handling the CHAT packet. We can broadcast to the entire server
// or to a room if desired. For now, we do a global broadcast unless the packet includes a roomId.

const PacketType = require('./packetTypes');
const { broadcastToRoom } = require('./roomManager');

/**
 * Handle an incoming chat packet. Typically structure:
 * [senderId, PacketType.CHAT, sequence, text, (optional) roomId]
 */
function handleChatPacket(clientId, decoded, originalMessage, state, log) {
    // destructure the array
    // e.g. [ senderId, type, sequence, text, roomId? ]
    const [senderId, packetType, sequence, text, roomId] = decoded;

    log('INFO', 'Chat message received', {
        clientId,
        senderId,
        text,
        roomId
    });

    // If there's a roomId, broadcast only to that room.
    // Otherwise, do a global broadcast.
    if (roomId !== undefined && roomId !== null) {
        broadcastToRoom(roomId, clientId, originalMessage, state.clients);
    } else {
        fastBroadcast(clientId, originalMessage, state);
    }

    // Update stats, if you wish
    updateClientStats(clientId, PacketType.CHAT, state);
}

/**
 * A helper function to broadcast to all except the sender.
 */
function fastBroadcast(senderId, binaryMessage, state) {
    state.clients.forEach((socket, id) => {
        if (id !== senderId && socket.readyState === 1) {
            socket.send(binaryMessage);
        }
    });
}

/**
 * Update client stats if needed.
 */
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
