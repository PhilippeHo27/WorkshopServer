const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes');


const rooms = new Map();
const ROOM_CONFIG = {
    MAX_CLIENTS: 8,
    MIN_CLIENTS: 2,
    IDLE_TIMEOUT: 300
};

function handleRoomCreatePacket(clientId, roomId, state, log) 
{
    log('INFO', 'Room create request', { clientId, roomId });

    let success = false;     
    if (!rooms.has(roomId)) 
    {
        rooms.set(roomId, { clients: new Set() });
        success = true;
        log('INFO', 'Room created', { roomId });
    } 
    else 
    {
        log('WARN', 'Room already exists', { roomId });
    }
    
    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) 
    {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('DEBUG', 'Sent room create response', { clientId, success });
    }
}


function handleRoomJoinPacket(clientId, roomId, state, log) 
{
    log('INFO', 'Room join request', { clientId, roomId });

    let success = false;
    
    const room = rooms.get(roomId);
    if (!room) 
    {
        log('WARN', 'Failed to join room', {
            clientId,
            roomId,
            reason: 'Room does not exist.'
        });
    }
    else if (room.clients.size >= ROOM_CONFIG.MAX_CLIENTS)
    {
        log('WARN', 'Failed to join room', {
            clientId,
            roomId,
            reason: 'Room is full.'
        });
    }
    else 
    {
        room.clients.add(clientId);
        success = true;
        log('INFO', 'Joined room successfully', { clientId, roomId });
    }

    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) 
    {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('DEBUG', 'Sent room join response', { clientId, success });
    }
}

function handleRoomLeavePacket(clientId, roomId, state, log) {
    log('INFO', 'Room leave request', { clientId, roomId });

    let success = false;
    
    const room = rooms.get(roomId);
    if (!room) {
        log('WARN', 'Failed to leave room', {
            clientId,
            roomId,
            reason: 'Room does not exist'
        });
    } else {
        room.clients.delete(clientId);
        success = true;
        log('INFO', 'Client left room', { clientId, roomId });

        // Clean up empty room
        if (room.clients.size === 0) {
            rooms.delete(roomId);
            log('INFO', 'Empty room removed', { roomId });
        }
    }

    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('DEBUG', 'Sent room leave response', { clientId, success });
    }
}

module.exports = {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket
};
