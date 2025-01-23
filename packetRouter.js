// packetRouter.js

const PacketType = require('./packetTypes');
const { handleChatPacket } = require('./chatHandler');
const { handlePositionPacket } = require('./positionHandler');
const {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket
} = require('./roomHandlers');
const { storeUserName } = require('./userInfoHandler.js');

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
            handleRoomCreatePacket(clientId, decoded[2], state, log);
            break;
        case PacketType.ROOM_JOIN:
            handleRoomJoinPacket(clientId, decoded[2], state, log);
            break;
        case PacketType.ROOM_LEAVE:
            handleRoomLeavePacket(clientId, decoded[2], state, log);
            break;
        case PacketType.ROOM_DESTROY:
            handleRoomDestroyPacket(clientId, decoded[2], state, log);
            break;
        case PacketType.USER_INFO:
            storeUserName(clientId, decoded[2], state, log);
            break;
        default:
            log('WARN', 'Unknown packet type', { clientId, type: packetType, decoded });
    }
}

module.exports = {
    routePacket
};
