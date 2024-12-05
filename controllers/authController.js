const pool = require('../models/db');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};
const generateRefreshToken = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const userQuery = await pool.query('SELECT * FROM users WHERE name = $1 AND password=$2', [username, password]);
        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];
            const token = generateToken(user);
            return res.json({ token, role: user.role, userId: user.id });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
const refreshToken = async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(403).send('Refresh token is required');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newAccessToken = generateToken({ id: decoded.id, role: decoded.role });

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(403).send('Invalid or expired refresh token');
  }
};
module.exports = { login , refreshToken};
