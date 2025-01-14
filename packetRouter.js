// packetRouter.js
// Routes incoming packets to the appropriate handler, based on PacketType.

const PacketType = require('./packetTypes');
const { handleChatPacket } = require('./chatHandler');
const { handlePositionPacket } = require('./positionHandler')
const {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket,
    handleRoomDestroyPacket
} = require('./roomHandlers');

/**
 * Route the decoded packet to the correct handler.
 *
 * @param {number} clientId
 * @param {Buffer} message
 * @param {object} state - the global state
 * @param {function} log - the logging function
 * @param {function} decodeMsgPack - your decode function
 */
function routePacket(clientId, message, state, log, decodeMsgPack) {
    if (!Buffer.isBuffer(message)) {
        log('WARN', 'Received non-binary message. Ignoring.', { clientId });
        return;
    }

    const decoded = decodeMsgPack(message);
    if (!decoded || !Array.isArray(decoded)) return;

    const packetType = decoded[1];

    switch (packetType) {
        case PacketType.CHAT:
            handleChatPacket(clientId, decoded, message, state, log);
            break;
        case PacketType.POSITION:
            handlePositionPacket(clientId, decoded, message, state, log);
            break;
        case PacketType.ROOM_CREATE:
            handleRoomCreatePacket(clientId, decoded, message, state, log);
            break;
        case PacketType.ROOM_JOIN:
            handleRoomJoinPacket(clientId, decoded, message, state, log);
            break;
        case PacketType.ROOM_LEAVE:
            handleRoomLeavePacket(clientId, decoded, message, state, log);
            break;
        case PacketType.ROOM_DESTROY:
            handleRoomDestroyPacket(clientId, decoded, message, state, log);
            break;
        default:
            log('WARN', 'Unknown packet type', { clientId, type: packetType, decoded });
    }
}

module.exports = {
    routePacket
};
