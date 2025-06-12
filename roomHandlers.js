// server.js

const { sendServerResponseToClient } = require('./utils');

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
    
    sendServerResponseToClient(clientId, success, state, log);
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

    sendServerResponseToClient(clientId, success, state, log);
}

function handleRoomLeavePacket(clientId, roomId, state, log, permanentRoomsConfig = {}) {
    log('Room leave request', { clientId, roomId });

    // If no roomId provided, try to get it from client connection info
    const clientConnectionInfo = state.clientConnections.get(clientId);
    if (!roomId && clientConnectionInfo) {
        roomId = clientConnectionInfo.roomId;
    }

    let success = false;
    
    const room = state.userRooms.get(roomId);
    if (!room) {
        log('Failed to leave room', {
            clientId,
            roomId,
            reason: 'Room does not exist or client not in a room to leave'
        });
    } else {
        room.clients.delete(clientId);
        // Clear room from client info
        if (clientConnectionInfo) {
            clientConnectionInfo.roomId = null;
        }
        success = true;
        log('Client left room', { clientId, roomId });

        // Clean up empty room only if it's not a permanent room
        const isPermanent = Object.values(permanentRoomsConfig).includes(roomId);
        if (!isPermanent && room.clients.size === 0) {
            state.userRooms.delete(roomId);
            log('Empty non-permanent room removed', { roomId });
        }
    }

    // Send response even if room didn't exist, client might expect confirmation of 'leave attempt'
    sendServerResponseToClient(clientId, success, state, log, 'Sent room leave response');
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
            sendServerResponseToClient(memberId, true, state, log, 'Sent room destruction notification to member');
        });

        // Delete the room
        state.userRooms.delete(roomId);
        success = true;
        log('Room destroyed', { clientId, roomId });
    }

    // Send confirmation to the client who requested the destroy
    sendServerResponseToClient(clientId, success, state, log, 'Sent room destroy response');
}


module.exports = {
    handleRoomCreatePacket,
    handleRoomJoinPacket,
    handleRoomLeavePacket,
    handleRoomDestroyPacket
};
