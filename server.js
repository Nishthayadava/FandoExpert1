// server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs'); // Add this line to import the fs module
const csvParser = require('csv-parser');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});


const generateToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query the database for the user by username
        const userQuery = await pool.query('SELECT * FROM users WHERE name = $1', [username]);

        // Check if the user exists
        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];

            // Compare the hashed password with the stored one
            const passwordMatch = bcrypt.compareSync(password, user.password);
            if (passwordMatch) {
                // If the password matches, generate a JWT token and return user data
                const token = generateToken(user);
                
                return res.json({
                    token,             // JWT token
                    role: user.role,   // Role (Admin or Agent)
                    userId: user.id,   // User ID
                });
            } else {
                // Password is incorrect
                return res.status(401).json({ message: 'Invalid credentials' });
            }
        } else {
            // User not found
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/attendance/login', async (req, res) => {

    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date
    try {
        const existingAttendance = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );


        if (existingAttendance.rows.length === 0) {
            const loginTime = new Date().toLocaleTimeString('it-IT', { hour12: false });
   
         
            
            await pool.query(
                'INSERT INTO attendance (user_id, date, login_time,logout_time, status, total_working_time,break_type) VALUES ($1, $2, $3::time, $4::time,$5,$6,$7)',
                [userId, date, loginTime, loginTime, 'Present', 0.00,'Available']
            );
            return res.status(201).send('Attendance recorded');
        } else {
            return res.status(400).send('Attendance for today already recorded');
        }
    } catch (error) {
        console.error('Error recording attendance:', error); // Log the error
        res.status(500).send('Error recording attendance');
    }
});

// Logout User
app.post('/api/attendance/logout', async (req, res) => {
    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date
 
    try {
        const logoutTime = new Date().toLocaleTimeString('it-IT', { hour12: false }); // HH:MM:SS

        const attendanceRecord = await pool.query(
            'SELECT login_time FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        if (attendanceRecord.rows.length === 0) {
            return res.status(400).send('No attendance record found for today');
        }

        const loginTime = attendanceRecord.rows[0].login_time;
  // Ensure loginTime is valid
  if (!loginTime) {
    return res.status(400).send('Invalid login time. Unable to log out.');
}
        // Convert HH:MM:SS to total seconds for calculation
        const [loginHours, loginMinutes, loginSeconds] = loginTime.split(':').map(Number);
        const [logoutHours, logoutMinutes, logoutSeconds] = logoutTime.split(':').map(Number);

        const totalLoginSeconds = loginHours * 3600 + loginMinutes * 60 + loginSeconds;
        const totalLogoutSeconds = logoutHours * 3600 + logoutMinutes * 60 + logoutSeconds;

           // Ensure logout time is later than login time
           if (totalLogoutSeconds <= totalLoginSeconds) {
            return res.status(400).send('Logout time must be after login time');
        }
        // Calculate total working time in hours
        const workingTime = (totalLogoutSeconds - totalLoginSeconds) / 60; // Convert seconds to hours

        await pool.query(
            'UPDATE attendance SET logout_time = $1, total_working_time = $2 WHERE user_id = $3 AND date = $4',
            [logoutTime, workingTime.toFixed(2), userId, date] // Ensure working time is a string
        );

        res.status(200).send('User logged out successfully');
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).send('Error logging out');
    }
});


// Create User
app.post('/api/create-user', async (req, res) => {
    const { username, password, role } = req.body;

    // Encrypt the password
    const hashedPassword = bcrypt.hashSync(password, 10);
    

    try {
        await pool.query(
            'INSERT INTO users (name, role ,password) VALUES ($1, $2, $3)',
            [username, role, hashedPassword]
        );
        res.status(201).send('User created successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating user');
    }
});


app.get('/api/attendance/:userId', async (req, res) => {
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
});


app.post('/api/attendance/break', async (req, res) => {
    const { userId, breakType } = req.body;


    
    const date = new Date().toISOString().split('T')[0]; // Get current date
    const time = new Date().toLocaleTimeString('it-IT', { hour12: false }); // HH:MM:SS

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
     

            const currentBreakType = currentRecord.break_type;

       
                // Check if it's a lunch break and calculate the time difference
    if (breakType === 'lunch') {
        const lunchStart = currentRecord[breakStartColumn];
        const lunchEnd = currentRecord[breakEndColumn];

        if (lunchStart && lunchEnd) {
            const startTime = new Date(`1970-01-01T${lunchStart}Z`); // Add 'Z' for UTC
            const endTime = new Date(`1970-01-01T${lunchEnd}Z`); // Add 'Z' for UTC
            
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                console.error('Invalid Date');
                return res.status(400).send('Invalid date for lunch break');
            } else {
                const timeDifference = (endTime - startTime) / (1000 * 60); // Difference in minutes
                console.log(`Time difference: ${timeDifference} hours`);
           



      // Check if the gap is less than 1 hour and include it in the break start condition
      if (timeDifference !== null && timeDifference > 60) {
        const excessTime = timeDifference - 60; // Calculate excess time in minutes
        const totalWorkingTime = parseFloat(currentRecord.total_working_time) || 0; // Get current total working time
        const newTotalWorkingTime = totalWorkingTime - excessTime; // Convert excess minutes to hours


        await pool.query(
            `UPDATE attendance SET total_working_time = $1 WHERE user_id = $2 AND date = $3`,
            [newTotalWorkingTime, userId, date]
        );

    }
}
}
}


        if (currentRecord[breakStartColumn] === null || currentRecord[currentBreakType] == 'Available'  ) {
            // Start Break
            await pool.query(
                `UPDATE attendance SET ${breakStartColumn} = $1 , break_type = $2 WHERE user_id = $3 AND date = $4 `,
                [time, breakType, userId, date] // Store time as HH:MM:SS
            );
            return res.status(200).send(`${breakType.charAt(0).toUpperCase() + breakType.slice(1)} break started`);
        } else {
            // End Break
            await pool.query(
                `UPDATE attendance SET ${breakEndColumn} = $1 , break_type = $2 WHERE user_id = $3 AND date = $4`,
                [time, 'Available', userId, date] // Store time as HH:MM:SS
            );
            return res.status(200).send(`${breakType.charAt(0).toUpperCase() + breakType.slice(1)} break ended`);
        }
    }
    catch (error) {
        console.error('Error recording break:', error); // Log full error
        res.status(500).send('Error recording break');
    }
});

// Apply Leave
app.post('/api/apply-leave', async (req, res) => {
    const { userId, date } = req.body;

    await pool.query(
        'UPDATE attendance SET leave_applied = $1 WHERE user_id = $2 AND date = $3',
        ['Y', userId, date]
    );

    res.send('Leave applied successfully');
});









// ***************************************************************ADMIN***************************************************

app.get('/api/admin/attendance', async (req, res) => {
    try {
        const attendanceRecords = await pool.query(`
            SELECT 
                a.user_id AS id,  -- Rename user_id to id
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
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});





//**************************************CSV******************************************

function authenticateToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');  // Get token from "Authorization: Bearer <token>"
    console.log('Received Token:', token); // Log the token to check if it is properly formatted

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err); // Log the error for better debugging
            return res.status(403).json({ message: 'Token is invalid' });
        }
        req.user = user; // Attach the decoded user object to request
        next();
    });
}

const upload = multer({ dest: 'uploads/' });

app.post('/api/uploadleads', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  console.log(req.file);  // Log the uploaded file object to verify
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const client = await pool.connect();
        for (const lead of results) {
          const {  name, email, phone_number, address } = lead;
          const query = 'INSERT INTO customers (name, email, phone_number, address) VALUES ($1, $2, $3, $4)';
          await client.query(query, [ name, email, phone_number, address]);
        }
        client.release();
        res.status(200).json({ message: 'Leads uploaded successfully.' });
      } catch (error) {
        console.error(error);  // Log the error for better debugging
        res.status(500).json({ message: 'Error uploading leads', error: error.message });
      }
    });
});
app.get('/api/get-users', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT id, name, role FROM users'); // Adjust query as needed
      res.json(rows);  // Return all users (you can filter by role on the frontend as you already do)
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
  });
app.get('/api/getleads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers');
        // Make sure that the returned rows have a valid `id`
        const leads = result.rows.map((lead) => ({
            id: lead.id, // Ensure each row has a valid `id` property
            agentId: lead.agentId,
            name: lead.name,
            email: lead.email,
            phone_number: lead.phone_number,
            address: lead.address,
        }));
        res.status(200).json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ message: 'Error fetching leads', error });
    }
});
app.post('/api/assignagent', authenticateToken, async (req, res) => {
    const { leadId, agentId } = req.body;
    const { user } = req;  // This should now be populated by the middleware
  
    if (!user) {
      return res.status(403).json({ message: 'User not authenticated' });
    }
  
    if (user.role !== 'Admin') {
      return res.status(403).json({ message: 'You are not authorized to assign agents.' });
    }
  
    try {
      const client = await pool.connect();
  
      // Check if the agent exists and is of role 'agent'
      const agentQuery = await client.query('SELECT id, role FROM users WHERE id = $1 AND role = $2', [agentId, 'Agent']);
      if (agentQuery.rows.length === 0) {
        return res.status(404).json({ message: 'Agent not found or invalid role.' });
      }
  
      // Assign agent to lead
      const updateQuery = 'UPDATE customers SET userid = $1 WHERE id = $2';
      await client.query(updateQuery, [agentId, leadId]);
  
      client.release();
      res.status(200).json({ message: 'Lead assigned successfully.' });
    } catch (error) {
      console.error(error); // Log the error for better debugging
      res.status(500).json({ message: 'Error assigning agent', error });
    }
  });


  const generateRefreshToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

app.post('/api/refresh-token', async (req, res) => {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
        return res.status(403).send('Refresh token is required');
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = generateToken({ id: decoded.id, role: decoded.role });

        return res.json({ accessToken: newAccessToken });
    } catch (err) {
        return res.status(403).send('Invalid or expired refresh token');
    }
});


// API endpoint to get leads assigned to the logged-in agent
app.get('/api/my-leads', authenticateToken, async (req, res) => {
    const { user } = req;  // Get the logged-in user from the middleware
  
    // Ensure the logged-in user is an agent
    if (user.role !== 'Agent') {
        return res.status(403).json({ message: 'You are not authorized to view this data.' });
    }

    try {
        const client = await pool.connect();

        // Query for leads assigned to the logged-in agent (using assigned_user_id)
        const leadsQuery = 'SELECT id,name, email, phone_number,address, created_at,status FROM customers WHERE userid = $1';
        const leadsResult = await client.query(leadsQuery, [user.id]);
        
        client.release();

        // Check if there are leads assigned to this agent
        if (leadsResult.rows.length === 0) {
            return res.status(404).json({ message: 'No leads assigned to you.' });
        }

        // Return the leads data to the agent
        res.status(200).json({ message: 'Leads fetched successfully', leads: leadsResult.rows });
    } catch (error) {
        console.error('Error fetching leads for agent:', error.message);
        res.status(500).json({ message: 'Error fetching leads', error: error.message });
    }
});

// API endpoint to update the status of a lead
app.patch('/api/update-lead-status', authenticateToken, async (req, res) => {
    const { user } = req;  // Get the logged-in user from the middleware
    const { leadId, newStatus } = req.body;  // Get lead ID and new status from the request body

    // Ensure the logged-in user is an agent
    if (user.role !== 'Agent') {
        return res.status(403).json({ message: 'You are not authorized to perform this action.' });
    }

    if (!leadId || !newStatus) {
        return res.status(400).json({ message: 'Lead ID and new status are required.' });
    }

    try {
        const client = await pool.connect();

        // Update the lead's status in the database
        const updateQuery = 'UPDATE customers SET status = $1 WHERE id = $2 AND userid = $3 RETURNING *';
        const updateResult = await client.query(updateQuery, [newStatus, leadId, user.id]);
        
        client.release();

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: 'Lead not found or not assigned to you.' });
        }

        // Return updated lead data
        res.status(200).json({ message: 'Lead status updated successfully', lead: updateResult.rows[0] });
    } catch (error) {
        console.error('Error updating lead status:', error.message);
        res.status(500).json({ message: 'Error updating lead status', error: error.message });
    }
});
