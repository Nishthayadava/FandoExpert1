const pool = require('../models/db');

const loginAttendance = async (req, res) => {
    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date
    try {
        const existingAttendance = await pool.query('SELECT * FROM attendance WHERE user_id = $1 AND date = $2', [userId, date]);
        if (existingAttendance.rows.length === 0) {
            const loginTime = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Kolkata' });
            await pool.query(
                'INSERT INTO attendance (user_id, date, login_time, logout_time, status, total_working_time, break_type) VALUES ($1, $2, $3::time, $4::time, $5, $6, $7)',
                [userId, date, loginTime, loginTime, 'Present', 0.00, 'Available']
            );
            return res.status(201).send('Attendance recorded');
        } else {
            return res.status(400).send('Attendance for today already recorded');
        }
    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).send('Error recording attendance');
    }
};

module.exports = { loginAttendance };
