// packetTypes.js
// This file holds all the packet type constants so that all modules
// can reference them from one place.

module.exports = {
    CHAT: 0,
    POSITION: 1,
    ID_ASSIGN: 2,
    TIME_SYNC: 3,

    // For rooms:
    ROOM_CREATE: 4,
    ROOM_JOIN: 5,
    ROOM_LEAVE: 6,
    ROOM_DESTROY: 7
};
