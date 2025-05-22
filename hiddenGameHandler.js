// hiddenGameHandler.js
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes');
const { broadcastToRoom, broadcastOriginalMessageToRoom } = require('./utils'); 

// Track ready states for each room
const readyStates = new Map();

/**
 * Handle Hidden game packet.
 * @param {string} clientId - Client ID.
 * @param {Buffer} binaryMessage - Binary message.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 */
function handleHiddenGamePacket(clientId, binaryMessage, state, log) { 
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

/**
 * Handle extra turn moves.
 * @param {string} clientId - Client ID.
 * @param {Buffer} binaryMessage - Binary message.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 */
function handleExtraTurnMoves(clientId, binaryMessage, state, log) { 
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

/**
 * Handle Hidden game confirm start.
 * @param {string} clientId - Client ID.
 * @param {array} data - Data array.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 */
function handleHiddenGameConfirmStart(clientId, data, state, log) {
    const clientState = state.clientConnections.get(clientId);
    if (!clientState || !clientState.roomId) return;

    const roomId = clientState.roomId;
    const room = state.userRooms.get(roomId);
    if (!room) return;
    
    // Extract ready state Boolean value of the BooleanPacket
    const isReady = data[2];
    
    // Initialize ready states for this room if not exists
    if (!readyStates.has(roomId)) {
        readyStates.set(roomId, new Map());
    }
    
    // Update ready state for this client
    const roomReadyStates = readyStates.get(roomId);
    roomReadyStates.set(clientId, isReady);
    
    log('Player ready state updated', { clientId, roomId, isReady });
    
    // Forward ready state to other player
    broadcastToRoom(clientId, msgpack.encode(data), state, room);
    
    // Check if both players are ready
    const allPlayersReady = checkAllPlayersReady(room, roomReadyStates);
    
    if (allPlayersReady) {
        log('All players ready, determining first player and starting game', { roomId });
        
        // Determine first player immediately
        const firstPlayerId = determineFirstPlayer(roomId, state, log);
        
        // Create combined start game message with first player info
        const startGameMessage = createGameStartMessage(firstPlayerId);
        
        // Send to all clients
        room.clients.forEach(cId => {
            const clientSocket = state.activeConnections.get(cId);
            if (clientSocket && clientSocket.readyState === 1) {
                clientSocket.send(startGameMessage);
            }
        });
        
        // Clean up ready states for this room
        readyStates.delete(roomId);
    }
}

/**
 * Helper function to check if all players in the room are ready.
 * @param {object} room - Room object.
 * @param {Map} roomReadyStates - Room ready states map.
 * @returns {boolean} True if all players are ready, false otherwise.
 */
function checkAllPlayersReady(room, roomReadyStates) {
    // Make sure we have all players accounted for
    if (room.clients.size !== roomReadyStates.size) {
        return false;
    }
    
    // Check if every player is ready
    for (const clientId of room.clients) {
        const isReady = roomReadyStates.get(clientId);
        if (!isReady) {
            return false;
        }
    }
    
    return true;
}

/**
 * Create game start message with first player info.
 * @param {string} firstPlayerId - First player ID.
 * @returns {Buffer} Game start message.
 */
function createGameStartMessage(firstPlayerId) {
    // Create a binary message with both game start and first player info
    const gameStartPacket = [
        0, // SenderId (server is 0)
        PacketType.GAME_START_INFO,
        firstPlayerId // Include first player ID in the packet
    ];
    
    return msgpack.encode(gameStartPacket);
}

/**
 * Determine first player.
 * @param {string} roomId - Room ID.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 * @returns {string} First player ID.
 */
function determineFirstPlayer(roomId, state, log) {
    const room = state.userRooms.get(roomId);
    if (!room) return null;
    
    // Pick a random player to go first
    const playerArray = Array.from(room.clients);
    const firstPlayerIndex = Math.floor(Math.random() * playerArray.length);
    const firstPlayerId = playerArray[firstPlayerIndex];
    
    log('First player determined', { roomId, firstPlayerId });
    
    return firstPlayerId;
}

/**
 * Handle client disconnections.
 * @param {string} clientId - Client ID.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 */
function handleClientDisconnect(clientId, state, log) {
    // Check all rooms for ready states
    for (const [roomId, roomReadyStates] of readyStates.entries()) {
        if (roomReadyStates.has(clientId)) {
            // Remove client from ready states
            roomReadyStates.delete(clientId);
            
            const room = state.userRooms.get(roomId);
            if (room) {
                // Notify other players that someone disconnected
                room.clients.forEach(otherId => {
                    if (otherId !== clientId) {
                        const otherSocket = state.activeConnections.get(otherId);
                        if (otherSocket && otherSocket.readyState === 1) {
                            const disconnectPacket = [
                                0, // SenderId (server is 0)
                                PacketType.OPPONENT_DISCONNECTED,
                                true
                            ];
                            otherSocket.send(msgpack.encode(disconnectPacket));
                        }
                    }
                });
            }
            
            // If room is empty or only has one player, clean up
            if (!room || room.clients.size <= 1) {
                readyStates.delete(roomId);
            }
            
            log('Player disconnected during ready phase', { clientId, roomId });
            break;
        }
    }
}

/**
 * Handle Hidden game immune.
 * @param {string} clientId - Client ID.
 * @param {Buffer} binaryMessage - Binary message.
 * @param {object} state - State object.
 * @param {function} log - Log function.
 */
function handleHiddenGameImmune(clientId, binaryMessage, state, log) {
    log('Broadcasting immune pieces update via utility', { clientId });
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

module.exports = {
    handleHiddenGamePacket,
    handleHiddenGameConfirmStart,
    handleClientDisconnect,
    handleHiddenGameImmune,
    handleExtraTurnMoves
};
