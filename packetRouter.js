// packetRouter.js

const PacketType = require('./packetTypes');
const { handleChatPacket } = require('./chatHandler');
const { handlePositionPacket } = require('./positionHandler');
const {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket,
    handleRoomDestroyPacket
} = require('./roomHandlers');
const { storeUserName } = require('./userInfoHandler.js');
const { handleVinceGamePacket,
    handleVinceGameConfirmStart,
    handleVinceGameImmune,
    handleExtraTurnMoves
} = require('./vinceGameHandler.js');
const { handleMatchmakingRequest } = require('./matchmakingHandler.js');

function routePacket(clientId, message, state, log, decodeMsgPack) {
    if (!Buffer.isBuffer(message)) {
        log('Received non-binary message. Ignoring.', { clientId });
        return;
    }

    const decoded = decodeMsgPack(message);
    if (!decoded || !Array.isArray(decoded)) return;

    const packetType = decoded[1];

    switch (packetType) {
        case PacketType.CHAT: // redundant
            handleChatPacket(clientId, decoded, message, state, log);
            break;
        case PacketType.POSITION: // redundant
            handlePositionPacket(clientId, message, state, log);
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
        case PacketType.VINCE_GAME: // redundant
            handleVinceGamePacket(clientId, message, state, log);
            break;
        case PacketType.VINCE_GAME_CONFIRM_START: // redundant
            handleVinceGameConfirmStart(clientId, decoded, state, log);
            break;
        case PacketType.VINCE_GAME_IMMUNE: // redundant
            handleVinceGameImmune(clientId, message, state, log);
            break;
        case PacketType.MATCH_MAKING_REQUEST:
            handleMatchmakingRequest(clientId, decoded, state, log);
            break;
        case PacketType.EXTRA_TURN_MOVES: // redundant
            handleExtraTurnMoves(clientId, message, state, log);
            break;
        default:
            log('Unknown packet type', { clientId, type: packetType, decoded });
    }
}

module.exports = {
    routePacket
};
