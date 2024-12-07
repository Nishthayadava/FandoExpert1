const pool = require('../models/db');
const { generateAccessToken, generateRefreshToken } = require('../middlewares/authMiddleware'); // Corrected the imports




const login = async (req, res) => {
    let { username, password } = req.body;
      username = username.trim();
    password = password.trim();
    try {
        const userQuery = await pool.query('SELECT * FROM users WHERE name = $1 AND password=$2', [username, password]);
        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];

            const token = generateAccessToken(user);            
            const refreshToken = generateRefreshToken(user);

            // Return tokens and user details
            return res.json({
                token: token,  // Access token (1 hour)
                refreshToken: refreshToken,  // Refresh token (7 days)
                role: user.role,
                userId: user.id
            });
              } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { login };
