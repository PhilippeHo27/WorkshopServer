// // roomManager.js
// const rooms = new Map();

// function createRoom(roomId) {
//     if (!rooms.has(roomId)) {
//         rooms.set(roomId, { clients: new Set() });
//         return true;
//     }
//     return false;
// }

// function joinRoom(roomId, clientId, maxCapacity = 8) {
//     const room = rooms.get(roomId);
//     if (!room) {
//         return { success: false, reason: 'Room does not exist.' };
//     }
//     if (room.clients.size >= maxCapacity) {
//         return { success: false, reason: 'Room is full.' };
//     }
//     room.clients.add(clientId);
//     return { success: true };
// }

// function leaveRoom(roomId, clientId) {
//     const room = rooms.get(roomId);
//     if (!room) return;
//     room.clients.delete(clientId);

//     if (room.clients.size === 0) {
//         rooms.delete(roomId);
//     }
// }

// function destroyRoom(roomId) {
//     rooms.delete(roomId);
// }

// module.exports = {
//     createRoom,
//     joinRoom,
//     leaveRoom,
//     destroyRoom
// };
