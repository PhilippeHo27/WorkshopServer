const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes'); 

function broadcastToRoom(senderId, binaryMessage, state, roomData) {
    if (!roomData?.clients) return;
    
    roomData.clients.forEach(clientId => {
        if (clientId !== senderId) {
            const clientSocket = state.activeConnections.get(clientId);
            if (clientSocket && clientSocket.readyState === WebSocket.OPEN) { 
                clientSocket.send(binaryMessage);
            }
        }
    });
}

function broadcastOriginalMessageToRoom(clientId, binaryMessage, state, log = console.log, targetRoomId = null) {
    let roomData;
    let roomIdToLog;

    if (targetRoomId) {
        roomData = state.userRooms.get(targetRoomId);
        roomIdToLog = targetRoomId;
        if (!roomData) {
            log(`Target room ${targetRoomId} not found for client ${clientId}`);
            return;
        }
    } else {
        const clientState = state.clientConnections?.get(clientId);
        if (clientState?.roomId) {
            roomIdToLog = clientState.roomId;
            roomData = state.userRooms.get(roomIdToLog);
        } else {
            // Fallback: search all rooms for this client
            const roomEntry = Array.from(state.userRooms.entries())
                .find(([_, rData]) => rData.clients.has(clientId));
            if (roomEntry) {
                [roomIdToLog, roomData] = roomEntry;
            }
        }

        if (!roomData) {
            log(`Client ${clientId} not in any room`);
            return;
        }
    }

    log(`Broadcasting for client ${clientId} in room ${roomIdToLog}`);
    broadcastToRoom(clientId, binaryMessage, state, roomData);
}

// function sendServerResponseToClient(clientId, responseData, state, log = console.log) {
//     const clientSocket = state.activeConnections.get(clientId);
//     if (clientSocket && clientSocket.readyState === WebSocket.OPEN) { 
//         try {
//             const packet = [0, PacketType.SERVER_RESPONSE, responseData];
//             clientSocket.send(msgpack.encode(packet));
//             log(`Sent server response to ${clientId}`, { responseData });
//         } catch (error) {
//             log(`Error sending server response to ${clientId}: ${error.message}`);
//         }
//     } else {
//         log(`Cannot send server response, client ${clientId} not connected`);
//     }
// }

function sendServerResponseToClient(clientId, responseData, originalPacketType, state, log = console.log) {
    const clientSocket = state.activeConnections.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) { 
        try {
            const packet = [0, PacketType.SERVER_RESPONSE, responseData, originalPacketType];
            clientSocket.send(msgpack.encode(packet));
            log(`Sent server response to ${clientId}`, { responseData, originalPacketType });
        } catch (error) {
            log(`Error sending server response to ${clientId}: ${error.message}`);
        }
    } else {
        log(`Cannot send server response, client ${clientId} not connected`);
    }
}


module.exports = {
    broadcastToRoom,
    broadcastOriginalMessageToRoom,
    sendServerResponseToClient
};
