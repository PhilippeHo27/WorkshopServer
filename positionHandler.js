// positionHandler.js

function handlePositionPacket(clientId, binaryMessage, state) {

    const pongRoom = state.userRooms.get('pongRoom');
    if (!pongRoom) return;

    broadcastToRoom(clientId, binaryMessage, state, pongRoom);
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
    handlePositionPacket
};
