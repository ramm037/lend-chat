const jwt = require('jsonwebtoken');

//generate a short lives acces token (15 minutes)
//this is what gets sent in every API request header
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
};

//Generate a long lives refresh token (7 days)
// this onl ever goes to /auth/refresh endpoint
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username},
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = {generateAccessToken, generateRefreshToken};