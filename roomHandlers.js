// roomHandlers.js
// Specific packet handlers for creating/joining/leaving/destroying rooms.

const PacketType = require('./packetTypes');
const {
    createRoom,
    joinRoom,
    leaveRoom,
    destroyRoom
} = require('./roomManager');

/**
 * Handle ROOM_CREATE packet: [senderId, ROOM_CREATE, sequence, roomId]
 */
function handleRoomCreatePacket(clientId, decoded, message, state, log) {
    const [senderId, packetType, sequence, roomId] = decoded;
    log('INFO', 'Room create request', { clientId, roomId });

    const success = createRoom(roomId);
    if (!success) {
        log('WARN', 'Room already exists', { roomId });
    } else {
        log('INFO', 'Room created', { roomId });
    }
}

/**
 * Handle ROOM_JOIN: [senderId, ROOM_JOIN, sequence, roomId]
 */
function handleRoomJoinPacket(clientId, decoded, message, state, log) {
    const [senderId, packetType, sequence, roomId] = decoded;
    log('INFO', 'Room join request', { clientId, roomId });

    const result = joinRoom(roomId, clientId, 2);
    if (!result.success) {
        log('WARN', 'Failed to join room', {
            clientId,
            roomId,
            reason: result.reason
        });
    } else {
        log('INFO', 'Joined room successfully', { clientId, roomId });
    }
}

/**
 * Handle ROOM_LEAVE: [senderId, ROOM_LEAVE, sequence, roomId]
 */
function handleRoomLeavePacket(clientId, decoded, message, state, log) {
    const [senderId, packetType, sequence, roomId] = decoded;
    log('INFO', 'Room leave request', { clientId, roomId });

    leaveRoom(roomId, clientId);
    log('INFO', 'Client left room', { clientId, roomId });
}

/**
 * Handle ROOM_DESTROY: [senderId, ROOM_DESTROY, sequence, roomId]
 */
function handleRoomDestroyPacket(clientId, decoded, message, state, log) {
    const [senderId, packetType, sequence, roomId] = decoded;
    log('INFO', 'Room destroy request', { clientId, roomId });

    destroyRoom(roomId);
    log('INFO', 'Room destroyed', { clientId, roomId });
}

module.exports = {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket,
    handleRoomDestroyPacket
};
