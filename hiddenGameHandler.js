// hiddenGameHandler.js
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes');
const { broadcastToRoom, broadcastOriginalMessageToRoom } = require('./utils'); 

const readyStates = new Map();

function handleHiddenGamePacket(clientId, binaryMessage, state, log) { 
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

function handleExtraTurnMoves(clientId, binaryMessage, state, log) { 
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

/**
 * Handle ready state confirmation and start game when all players ready
 */
function handleHiddenGameConfirmStart(clientId, data, state, log) {
    const clientState = state.clientConnections.get(clientId);
    if (!clientState || !clientState.roomId) return;

    const roomId = clientState.roomId;
    const room = state.userRooms.get(roomId);
    if (!room) return;
    
    const isReady = data[2]; // Extract ready state from BooleanPacket
    
    if (!readyStates.has(roomId)) {
        readyStates.set(roomId, new Map());
    }
    
    const roomReadyStates = readyStates.get(roomId);
    roomReadyStates.set(clientId, isReady);
    
    log('Player ready state updated', { clientId, roomId, isReady });
    
    broadcastToRoom(clientId, msgpack.encode(data), state, room);
    
    if (checkAllPlayersReady(room, roomReadyStates)) {
        log('All players ready, starting game', { roomId });
        
        const firstPlayerId = determineFirstPlayer(roomId, state, log);
        const startGameMessage = createGameStartMessage(firstPlayerId);
        
        room.clients.forEach(cId => {
            const clientSocket = state.activeConnections.get(cId);
            if (clientSocket && clientSocket.readyState === 1) {
                clientSocket.send(startGameMessage);
            }
        });
        
        readyStates.delete(roomId);
    }
}

function checkAllPlayersReady(room, roomReadyStates) {
    if (room.clients.size !== roomReadyStates.size) {
        return false;
    }
    
    for (const clientId of room.clients) {
        if (!roomReadyStates.get(clientId)) {
            return false;
        }
    }
    
    return true;
}

function createGameStartMessage(firstPlayerId) {
    const gameStartPacket = [
        0, // Server sender ID
        PacketType.GAME_START_INFO,
        firstPlayerId
    ];
    
    return msgpack.encode(gameStartPacket);
}

function determineFirstPlayer(roomId, state, log) {
    const room = state.userRooms.get(roomId);
    if (!room) return null;
    
    const playerArray = Array.from(room.clients);
    const firstPlayerIndex = Math.floor(Math.random() * playerArray.length);
    const firstPlayerId = playerArray[firstPlayerIndex];
    
    log('First player determined', { roomId, firstPlayerId });
    
    return firstPlayerId;
}

/**
 * Clean up ready states and notify opponents when player disconnects
 */
function handleClientDisconnect(clientId, state, log) {
    for (const [roomId, roomReadyStates] of readyStates.entries()) {
        if (roomReadyStates.has(clientId)) {
            roomReadyStates.delete(clientId);
            
            const room = state.userRooms.get(roomId);
            if (room) {
                room.clients.forEach(otherId => {
                    if (otherId !== clientId) {
                        const otherSocket = state.activeConnections.get(otherId);
                        if (otherSocket && otherSocket.readyState === 1) {
                            const disconnectPacket = [
                                0,
                                PacketType.OPPONENT_DISCONNECTED,
                                true
                            ];
                            otherSocket.send(msgpack.encode(disconnectPacket));
                        }
                    }
                });
            }
            
            if (!room || room.clients.size <= 1) {
                readyStates.delete(roomId);
            }
            
            log('Player disconnected during ready phase', { clientId, roomId });
            break;
        }
    }
}

function handleHiddenGameImmune(clientId, binaryMessage, state, log) {
    log('Broadcasting immune pieces update', { clientId });
    broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log);
}

module.exports = {
    handleHiddenGamePacket,
    handleHiddenGameConfirmStart,
    handleClientDisconnect,
    handleHiddenGameImmune,
    handleExtraTurnMoves
};
