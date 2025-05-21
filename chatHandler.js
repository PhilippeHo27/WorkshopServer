// chatHandler.js

const { broadcastOriginalMessageToRoom } = require('./utils');

function handleChatPacket(clientId, decoded, binaryMessage, state, log) {
    const [senderId, packetType, text] = decoded;
    
    if (!text || typeof text !== 'string') {
        log('Invalid chat message', { clientId });
        return;
    }

    // Logging specific to chat can remain
    log('Chat message received, preparing to broadcast', { clientId, senderId, text });

    // Use the new utility. It will find the room and broadcast.
    // clientId is the senderId for broadcasting purposes.
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

module.exports = {
    handleChatPacket
};
