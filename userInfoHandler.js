const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const PacketType = require('./packetTypes');

function storeUserName(clientId, userName, state, log) {
    if (!userName || typeof userName !== 'string') {
        log('WARN', 'Invalid username received', { clientId, userName });
        return; // just return without value
    }

    const previousName = state.userNames.get(clientId);
    state.userNames.set(clientId, userName);
    
    log('INFO', 'Username stored', {
        clientId,
        userName,
        previousName: previousName || 'none'
    });

    updateUserNamesToClients(state, log);
}

function updateUserNamesToClients(state, log) {
    // Create a simple array of [clientId, userName] pairs
    const userList = Array.from(state.userNames.entries()).map(([id, name]) => ({
        id,
        name
    }));

    // Prepare the packet
    const packet = msgpack.encode([
        0, // sequence number (not used for system messages)
        PacketType.USER_LIST_UPDATE,
        userList
    ]);

    // Send to all connected clients
    state.activeConnections.forEach((socket, clientId) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(packet);
            log('DEBUG', 'Sent user list update', { 
                recipientId: clientId, 
                userCount: userList.length 
            });
        }
    });

    log('INFO', 'Broadcast user list update', { 
        connectedUsers: userList.length,
        users: userList
    });
}

module.exports = {
    storeUserName,
    updateUserNamesToClients
};
