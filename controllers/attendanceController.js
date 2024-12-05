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


const logoutAttendance = async (req, res) => {
    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    const logoutTime = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Kolkata' });

    try {
        const attendanceRecord = await pool.query(
            'SELECT login_time FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        if (attendanceRecord.rows.length === 0) {
            return res.status(400).send('No attendance record found for today');
        }

        const loginTime = attendanceRecord.rows[0].login_time;
        if (!loginTime) {
            return res.status(400).send('Invalid login time. Unable to log out.');
        }

        const [loginHours, loginMinutes, loginSeconds] = loginTime.split(':').map(Number);
        const [logoutHours, logoutMinutes, logoutSeconds] = logoutTime.split(':').map(Number);

        const totalLoginSeconds = loginHours * 3600 + loginMinutes * 60 + loginSeconds;
        const totalLogoutSeconds = logoutHours * 3600 + logoutMinutes * 60 + logoutSeconds;

        if (totalLogoutSeconds <= totalLoginSeconds) {
            return res.status(400).send('Logout time must be after login time');
        }

        const workingTime = (totalLogoutSeconds - totalLoginSeconds) / 60; // Convert seconds to minutes

        // Update attendance record with logout time and total working time
        const updateResult = await pool.query(
            'UPDATE attendance SET logout_time = $1, total_working_time = $2 WHERE user_id = $3 AND date = $4',
            [logoutTime, workingTime.toFixed(2), userId, date]
        );

        if (updateResult.rowCount === 0) {
            return res.status(400).send('Failed to update attendance record');
        }

        res.status(200).send('User logged out successfully');
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).send('Error logging out');
    }
};


module.exports = { loginAttendance, logoutAttendance };
