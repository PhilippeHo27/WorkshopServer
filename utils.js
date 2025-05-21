// utils.js

/**
 * Broadcasts a binary message to all clients in a room except the sender.
 * @param {string} senderId - The ID of the client who sent the original message.
 * @param {Buffer} binaryMessage - The binary message to broadcast.
 * @param {object} state - The global server state, containing activeConnections.
 * @param {object} roomData - The data object for the room, containing a 'clients' Set.
 */
function broadcastToRoom(senderId, binaryMessage, state, roomData) {
    if (!roomData || !roomData.clients) {
        console.error('broadcastToRoom: Invalid roomData or roomData.clients is missing');
        return;
    }
    roomData.clients.forEach(clientId => {
        if (clientId !== senderId) {
            const clientSocket = state.activeConnections.get(clientId);
            // WebSocket.OPEN is typically 1
            if (clientSocket && clientSocket.readyState === 1) { 
                clientSocket.send(binaryMessage);
            }
        }
    });
}

/**
 * Finds a client's room and broadcasts the original binary message to other members.
 * @param {string} clientId - The ID of the client who sent the original message.
 * @param {Buffer} binaryMessage - The binary message to broadcast.
 * @param {object} state - The global server state (activeConnections, userRooms, clientConnections).
 * @param {function} [log=console.log] - Logger function.
 * @param {string} [targetRoomId=null] - Specific room ID to broadcast to. If null, finds client's current room.
 */
function broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log = console.log, targetRoomId = null) {
    let roomData;
    let roomIdToLog;

    if (targetRoomId) {
        roomData = state.userRooms.get(targetRoomId);
        roomIdToLog = targetRoomId;
        if (!roomData) {
            log(`broadcastOriginalMessageToRoom: Target room ${targetRoomId} not found for client ${clientId}`);
            return;
        }
    } else {
        // Try to find room from clientConnections (preferred for VinceGame)
        const clientState = state.clientConnections && state.clientConnections.get(clientId);
        if (clientState && clientState.roomId) {
            roomIdToLog = clientState.roomId;
            roomData = state.userRooms.get(roomIdToLog);
        } else {
            // Fallback to iterating userRooms (like in original chatHandler)
            const roomEntry = Array.from(state.userRooms.entries())
                .find(([_, rData]) => rData.clients.has(clientId));
            if (roomEntry) {
                [roomIdToLog, roomData] = roomEntry;
            }
        }

        if (!roomData) {
            log(`broadcastOriginalMessageToRoom: Client ${clientId} not in any identifiable room.`);
            return;
        }
    }

    log(`broadcastOriginalMessageToRoom: Broadcasting for client ${clientId} in room ${roomIdToLog}`);
    broadcastToRoom(clientId, binaryMessage, state, roomData);
}

const WebSocket = require('ws'); 
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes'); 

/**
 * Sends a standardized SERVER_RESPONSE packet to a single client.
 * @param {string} clientId - The ID of the client to send the response to.
 * @param {*} responseData - The data to include in the response (e.g., boolean success, or other details).
 * @param {object} state - The global server state, containing activeConnections.
 * @param {function} [log=console.log] - Logger function.
 * @param {string} [logMessagePrefix='Sent server response'] - Prefix for the log message.
 */
function sendServerResponseToClient(clientId, responseData, state, log = console.log, logMessagePrefix = 'Sent server response') {
    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) { 
        try {
            const packet = [0, PacketType.SERVER_RESPONSE, responseData];
            clientSocket.send(msgpack.encode(packet));
            log(`${logMessagePrefix}`, { clientId, responseData });
        } catch (error) {
            log(`Error encoding/sending server response to client ${clientId}: ${error.message}`, { error, clientId, responseData }, 'error');
        }
    } else {
        log(`Cannot send server response, client ${clientId} socket not open or not found. State: ${clientSocket ? clientSocket.readyState : 'N/A'}`, { clientId }, 'warn');
    }
}

module.exports = {
    broadcastToRoom,
    broadcastOriginalMessageToRoom,
    sendServerResponseToClient
};
