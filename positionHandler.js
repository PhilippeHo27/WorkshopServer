// positionHandler.js

const { broadcastOriginalMessageToRoom } = require('./utils');

function handlePositionPacket(clientId, binaryMessage, state, log) {

    const pongRoom = state.userRooms.get('pongRoom');
    if (!pongRoom) return;

    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log, 'pongRoom');
}

module.exports = {
    handlePositionPacket
};
