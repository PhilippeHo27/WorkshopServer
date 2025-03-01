const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes');

const ROOM_CONFIG = {
    MAX_CLIENTS: 8,
    MIN_CLIENTS: 2,
    IDLE_TIMEOUT: 300
};

function handleRoomCreatePacket(clientId, roomId, state, log) 
{
    log('Room create request', { clientId, roomId });

    let success = false;     
    if (!state.userRooms.has(roomId)) {
        // Create room
        state.userRooms.set(roomId, { clients: new Set() });
        const room = state.userRooms.get(roomId);
        
        // Auto-join creator
        if (room.clients.size < ROOM_CONFIG.MAX_CLIENTS) {
            room.clients.add(clientId);
            // Track room in client info
            state.clientConnections.get(clientId).roomId = roomId;
            success = true;
            log('Room created and joined', { roomId, clientId });
        } else {
            log('Room created but join failed - room full', { roomId });
        }
    } else {
        log('Room already exists', { roomId });
    }
    
    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) 
    {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('Sent room create response', { clientId, success });
    }
}

function handleRoomJoinPacket(clientId, roomId, state, log) 
{
    log('Room join request', { clientId, roomId });

    let success = false;
    
    const room = state.userRooms.get(roomId);
    if (!room) 
    {
        log('Failed to join room', {
            clientId,
            roomId,
            reason: 'Room does not exist.'
        });
    }
    else if (room.clients.size >= ROOM_CONFIG.MAX_CLIENTS)
    {
        log('Failed to join room', {
            clientId,
            roomId,
            reason: 'Room is full.'
        });
    }
    else 
    {
        room.clients.add(clientId);
        // Track room in client info
        state.clientConnections.get(clientId).roomId = roomId;
        success = true;
        log('Joined room successfully', { clientId, roomId });
    }

    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) 
    {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('Sent room join response', { clientId, success });
    }
}

function handleRoomLeavePacket(clientId, roomId, state, log) {
    log('Room leave request', { clientId, roomId });

    // If no roomId provided, try to get it from client connection info
    if (!roomId && state.clientConnections.has(clientId)) {
        roomId = state.clientConnections.get(clientId).roomId;
    }

    let success = false;
    
    const room = state.userRooms.get(roomId);
    if (!room) {
        log('Failed to leave room', {
            clientId,
            roomId,
            reason: 'Room does not exist'
        });
    } else {
        room.clients.delete(clientId);
        // Clear room from client info
        if (state.clientConnections.has(clientId)) {
            state.clientConnections.get(clientId).roomId = null;
        }
        success = true;
        log('Client left room', { clientId, roomId });

        // Clean up empty room
        if (room.clients.size === 0) {
            state.userRooms.delete(roomId);
            log('Empty room removed', { roomId });
        }
    }

    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('Sent room leave response', { clientId, success });
    }
}

function handleRoomDestroyPacket(clientId, roomId, state, log) {
    log('Room destroy request', { clientId, roomId });

    let success = false;
    
    const room = state.userRooms.get(roomId);
    if (!room) {
        log('Failed to destroy room', {
            clientId,
            roomId,
            reason: 'Room does not exist'
        });
    } else {
        // Notify all clients in the room that it's being destroyed
        room.clients.forEach(memberId => {
            // Clear room from client info
            if (state.clientConnections.has(memberId)) {
                state.clientConnections.get(memberId).roomId = null;
            }
            
            // Send notification to each client
            const memberSocket = state.activeConnections.get(memberId);
            if (memberSocket && memberSocket.readyState === WebSocket.OPEN) {
                memberSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, true]));
            }
        });

        // Delete the room
        state.userRooms.delete(roomId);
        success = true;
        log('Room destroyed', { clientId, roomId });
    }

    // Send confirmation to the client who requested the destroy
    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(msgpack.encode([0, PacketType.SERVER_RESPONSE, success]));
        log('Sent room destroy response', { clientId, success });
    }
}


module.exports = {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket,
    handleRoomDestroyPacket
};
