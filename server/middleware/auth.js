const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    //client sends : "Authorization : Bearer <accesToken>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No Token provided' });
    }
    try {
        //verify agains ACCESS secret specifically
        // a refresh token sent here would fail because different secret
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({error : 'Invalid or expired token'});
    }
};

module.exports = authMiddleware
