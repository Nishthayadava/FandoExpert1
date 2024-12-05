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
    console.log(`Logout request received for userId: ${userId}, date: ${date}, logoutTime: ${logoutTime}`);

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
        console.log(`Login Time (Seconds): ${totalLoginSeconds}, Logout Time (Seconds): ${totalLogoutSeconds}`);

        if (totalLogoutSeconds <= totalLoginSeconds) {
            return res.status(400).send('Logout time must be after login time');
        }

        const workingTime = (totalLogoutSeconds - totalLoginSeconds) / 60; // Convert seconds to minutes
        console.log(`Total Working Time: ${workingTime}`);

        // Update attendance record with logout time and total working time
        const updateResult = await pool.query(
            'UPDATE attendance SET logout_time = $1, total_working_time = $2 WHERE user_id = $3 AND date = $4',
            [logoutTime, workingTime.toFixed(2), userId, date]
        );
        console.log(`Update Result: ${updateResult.rowCount}`);

        if (updateResult.rowCount === 0) {
            return res.status(400).send('Failed to update attendance record');
        }

        res.status(200).send('User logged out successfully');
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).send('Error logging out');
    }
};




const handleBreak = async (req, res) => {
    const { userId, breakType } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date
    const time = new Date().toLocaleTimeString('en-GB', {
        hour12: false,
        timeZone: 'Asia/Kolkata'
    });

    try {
        const existingAttendance = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        if (existingAttendance.rows.length === 0) {
            return res.status(400).send('No attendance record for today');
        }

        const currentRecord = existingAttendance.rows[0];
        const breakStartColumn = breakType === 'lunch' ? 'lunch_break_start' : 'break_time_start';
        const breakEndColumn = breakType === 'lunch' ? 'lunch_break_end' : 'break_time_end';

        // Handle lunch break and excess time calculation
        if (breakType === 'lunch') {
            const lunchStart = currentRecord[breakStartColumn];
            const lunchEnd = currentRecord[breakEndColumn];

            if (lunchStart && lunchEnd) {
                const startTime = new Date(`1970-01-01T${lunchStart}Z`); // Convert to Date object
                const endTime = new Date(`1970-01-01T${lunchEnd}Z`); 

                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                    return res.status(400).send('Invalid date for lunch break');
                }

                const timeDifference = (endTime - startTime) / (1000 * 60); // Time difference in minutes
                if (timeDifference > 60) { // If break time is greater than 60 mins
                    const excessTime = timeDifference - 60;
                    const totalWorkingTime = parseFloat(currentRecord.total_working_time) || 0;
                    const newTotalWorkingTime = totalWorkingTime - excessTime;

                    await pool.query(
                        'UPDATE attendance SET total_working_time = $1 WHERE user_id = $2 AND date = $3',
                        [newTotalWorkingTime, userId, date]
                    );
                }
            }
        }

        // Start or End break
        if (currentRecord[breakStartColumn] === null || currentRecord.break_type === 'Available') {
            await pool.query(
                `UPDATE attendance SET ${breakStartColumn} = $1 , break_type = $2 WHERE user_id = $3 AND date = $4`,
                [time, breakType, userId, date]
            );
            return res.status(200).send(`${breakType.charAt(0).toUpperCase() + breakType.slice(1)} break started`);
        } else {
            await pool.query(
                `UPDATE attendance SET ${breakEndColumn} = $1 , break_type = 'Available' WHERE user_id = $2 AND date = $3`,
                [time, userId, date]
            );
            return res.status(200).send(`${breakType.charAt(0).toUpperCase() + breakType.slice(1)} break ended`);
        }
    } catch (error) {
        console.error('Error recording break:', error);
        res.status(500).send('Error recording break');
    }
};

// Apply leave
const applyLeave = async (req, res) => {
    const { userId, date } = req.body;

    try {
        await pool.query(
            'UPDATE attendance SET leave_applied = $1 WHERE user_id = $2 AND date = $3',
            ['Y', userId, date]
        );
        res.send('Leave applied successfully');
    } catch (error) {
        console.error('Error applying leave:', error);
        res.status(500).send('Error applying leave');
    }
};

// Get attendance for a specific user
const getAttendance = async (req, res) => {
  const { userId } = req.params;

  try {
    const attendanceRecords = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );
    res.json(attendanceRecords.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching attendance');
  }
};

// Admin: Get all attendance records
const getAdminAttendance = async (req, res) => {
    try {
        const attendanceRecords = await pool.query(`
            SELECT 
                a.user_id AS id,  
                u.name, 
                u.role, 
                a.date, 
                a.login_time, 
                a.logout_time, 
                a.total_working_time, 
                a.status, 
                a.leave_applied 
            FROM 
                attendance a
            JOIN 
                users u ON a.user_id = u.id 
            ORDER BY 
                a.date DESC
        `);
        res.json(attendanceRecords.rows);
    } catch (error) {
        console.error('Error fetching all attendance records:', error);
        res.status(500).send('Error fetching attendance records');
    }
};
module.exports = { loginAttendance, logoutAttendance,handleBreak,applyLeave,getAdminAttendance,getAttendance };
