// authMiddleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

// Function to generate access token (1 hour expiration)
const generateAccessToken = (user) => {
    const { id, role } = user;
    return jwt.sign({ id: id.trim(), role: role.trim() }, JWT_SECRET, { expiresIn: '1h' }); // 1 hour expiration
};

// Function to generate refresh token (7 days expiration)
const generateRefreshToken = (user) => {
    const { id, role } = user;
    return jwt.sign({ id: id.trim(), role: role.trim() }, JWT_REFRESH_SECRET, { expiresIn: '7d' }); // 7 days expiration
};

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) return res.status(403).json({ message: 'Token is required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired', expiredAt: err.expiredAt });
            }
            return res.status(403).json({ message: 'Invalid token' });
        }
        
        req.user = user;
        next();
    });
};

// Middleware to refresh token
const refreshToken = (req, res) => {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
        return res.status(403).send('Refresh token is required');
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send('Invalid or expired refresh token');
        }

        const newAccessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ accessToken: newAccessToken });
    });
};

module.exports = { authenticateToken, refreshToken, generateToken: generateAccessToken, generateRefreshToken };
