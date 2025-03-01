// packetTypes.js

module.exports = {
    CHAT: 0,
    POSITION: 1,
    ID_ASSIGN: 2,
    TIME_SYNC: 3,

    // For rooms:
    ROOM_CREATE: 4,
    ROOM_JOIN: 5,
    ROOM_LEAVE: 6,
    ROOM_DESTROY: 7,
    SERVER_RESPONSE: 8,
    USER_INFO: 9,

    // Vince's game
    VINCE_GAME: 10,
    VINCE_GAME_IMMUNE: 11,
    VINCE_GAME_CONFIRM_START: 12,
    MATCH_MAKING_REQUEST: 13,
    MATCH_FOUND: 14,
    
    // New packet types for the ready system:
    GAME_START_INFO: 15,
    OPPONENT_DISCONNECTED: 17
};
