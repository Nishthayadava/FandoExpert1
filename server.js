// server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
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
        const userQuery = await pool.query('SELECT * FROM users WHERE name = $1 AND password=$2', [username,password]);
        console.log("userQuery",userQuery);
        // Check if the user exists
        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];

            
            
        



                console.log("Password Matched");
                // If the password matches, generate a JWT token and return user data
                const token = generateToken(user);
                
                return res.json({
                    token,             // JWT token
                    role: user.role,   // Role (Admin or Agent)
                    userId: user.id,   // User ID
                });
           
            
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
            const loginTime =  new Date().toLocaleTimeString('en-GB', { 
  hour12: false, 
  timeZone: 'Asia/Kolkata' 
});
   
         
            
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

app.get('/api/getuserprofile/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId; // Get userId from URL parameters
      

        // Query the database using the userId from the request parameters
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];
        const userProfile = {
            id: user.id,
            name: user.name,
            role: user.role,
        };

        res.status(200).json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Error fetching user profile', error });
    }
});


// Logout User
app.post('/api/attendance/logout', async (req, res) => {
    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    try {
        // Get the current time in HH:MM:SS format (24-hour format)
const logoutTime = new Date().toLocaleTimeString('en-GB', { 
  hour12: false, 
  timeZone: 'Asia/Kolkata' 
});
        // Log to verify the incoming request data and time
        console.log('Received request for logout:', { userId, date, logoutTime });

        // Step 1: Retrieve the user's login time for today
        const attendanceRecord = await pool.query(
            'SELECT login_time FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        // Log to verify the fetched attendance record
        console.log('Attendance Record:', attendanceRecord.rows);

        if (attendanceRecord.rows.length === 0) {
            return res.status(400).send('No attendance record found for today');
        }
        console.log('attendanceRecord.rows.length:', attendanceRecord.rows.length);

        const loginTime = attendanceRecord.rows[0].login_time;

        // Ensure loginTime is valid
        if (!loginTime) {
            return res.status(400).send('Invalid login time. Unable to log out.');
        }
        console.log('loginTime', loginTime);

        // Step 2: Convert login time and logout time to seconds for comparison
        const [loginHours, loginMinutes, loginSeconds] = loginTime.split(':').map(Number);
        const [logoutHours, logoutMinutes, logoutSeconds] = logoutTime.split(':').map(Number);

        const totalLoginSeconds = loginHours * 3600 + loginMinutes * 60 + loginSeconds;
        const totalLogoutSeconds = logoutHours * 3600 + logoutMinutes * 60 + logoutSeconds;

        console.log('totalLoginSeconds', totalLoginSeconds);
        console.log('totalLogoutSeconds', totalLogoutSeconds);

        // Ensure logout time is later than login time
        if (totalLogoutSeconds <= totalLoginSeconds) {
            return res.status(400).send('Logout time must be after login time');
        }

        // Step 3: Calculate total working time in minutes
        const workingTime = (totalLogoutSeconds - totalLoginSeconds) / 60; // Convert seconds to minutes

        // Log the calculated working time
        console.log('Calculated Working Time (minutes):', workingTime.toFixed(2));

        // Step 4: Update the attendance record with logout time and total working time
        const updateResult = await pool.query(
            'UPDATE attendance SET logout_time = $1, total_working_time = $2 WHERE user_id = $3 AND date = $4',
            [logoutTime, workingTime.toFixed(2), userId, date]
        );
        console.log('updateResult', updateResult);

        // Log the update result to check how many rows were affected
        console.log('Rows affected by update:', updateResult.rowCount);

        if (updateResult.rowCount === 0) {
            return res.status(400).send('Failed to update attendance record');
        }

        // Step 5: Respond back indicating successful logout
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
    

    try {
        await pool.query(
            'INSERT INTO users (name, role ,password) VALUES ($1, $2, $3)',
            [username, role, password]
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
    const time =  new Date().toLocaleTimeString('en-GB', { 
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
            console.log(name);
                        console.log(email);
            console.log(phone_number);
            console.log(address);

          const query = 'INSERT INTO customers (name, email, phone_number, address) VALUES ($1, $2, $3, $4)';
          await client.query(query, [ name, email, phone_number, address]);
                        console.log("Inserted CSV");

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
            userid: lead.userid,
            remark: lead.remark,
            status: lead.status,
        }));
        res.status(200).json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ message: 'Error fetching leads', error });
    }
});


// PUT route to update a lead
app.put('/api/updatelead/:id', authenticateToken, async (req, res) => {
    const leadId = req.params.id;
    const { remark, status ,userids} = req.body;
    const { user } = req;  // This should be populated by the `authenticateToken` middleware

    // Check if the user is authenticated
    if (!user) {
        return res.status(403).json({ message: 'User not authenticated' });
    }
    const userIdFromToken = user.id;  // This should be decoded from the JWT token

    // Check if the user has 'Admin' role

    console.log(user.id);
    console.log(userids)
    if (userids!= userIdFromToken ) {
        return res.status(403).json({ message: 'You are not authorized agent' });
    }
    if (user.role !== 'Agent') {
        return res.status(403).json({ message: 'You are not authorized to update leads.' });
    }

    // Validate input: ensure remark and status are provided
    if (!remark || !status) {
        return res.status(400).json({ message: 'Remark and Status are required.' });
    }

    try {
        const client = await pool.connect();

        // Check if the lead exists (basic check for the lead in the database)
        const leadQuery = await client.query('SELECT id FROM customers WHERE id = $1', [leadId]);
        if (leadQuery.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Lead not found.' });
        }

        // Update the lead with the provided remark and status
        const updateQuery = `
            UPDATE customers
            SET remark = $1, status = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, remark, status
        `;
        const updateResult = await client.query(updateQuery, [remark, status, leadId]);

        client.release();

        // Check if any rows were updated
        if (updateResult.rowCount > 0) {
            const updatedLead = updateResult.rows[0];
            res.status(200).json({ message: 'Lead updated successfully.', lead: updatedLead });
        } else {
            res.status(404).json({ message: 'No lead was updated. Please check the lead ID.' });
        }
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ message: 'Error updating lead.', error });
    }
});



app.post('/api/assignagent', authenticateToken, async (req, res) => {
    const { leadIds, agentId } = req.body;
    const { user } = req;  // This should now be populated by the middleware
  
    if (!user) {
      return res.status(403).json({ message: 'User not authenticated' });
    }
  
    if (user.role.trim() !== 'Admin') {
      return res.status(403).json({ message: 'You are not authorized to assign agents.' });
    }
    
    // Check if leadIds is an array and has at least one element
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: 'Please provide a valid array of lead IDs.' });
    }

    try {
        const client = await pool.connect();
  
        // Check if the agent exists and has the role 'Agent'
        const agentQuery = await client.query('SELECT id, role FROM users WHERE id = $1 AND role = $2', [agentId, 'Agent']);
        console.log(agentQuery);
        if (agentQuery.rows.length === 0) {
          client.release();
          return res.status(404).json({ message: 'Agent not found or invalid role.' });
        }
  
        // Update the leads with the agentId for multiple lead IDs
        const updateQuery = 'UPDATE customers SET userid = $1, created_at=NOW() WHERE id = ANY($2::int[])';
        const updateResult = await client.query(updateQuery, [agentId, leadIds]);
        console.log(updateResult);

        client.release();
        
        if (updateResult.rowCount > 0) {
            res.status(200).json({ message: 'Leads assigned successfully.' });
        } else {
            res.status(404).json({ message: 'No leads were updated. Please check lead IDs.' });
        }
    } catch (error) {
        console.error('Error assigning agent:', error); // Log the error for better debugging
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
app.get('/api/my-leads', authenticateToken, async (req, res) => {
    const { user } = req;
  
    if (!user || !user.id) {
      return res.status(403).json({ message: 'User not authenticated' });
    }
  
    try {
      const client = await pool.connect();
      
      // Query to fetch users from the customers table where the role is 'Agent' and the user ID matches
      const query = 'SELECT id, name, email, phone_number, address, created_at, updated_at, status FROM customers WHERE userid = $1';
      const result = await client.query(query, [user.id]);
      
      client.release();
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'No agents found for the user.' });
      }
  
      res.status(200).json({ agents: result.rows });
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ message: 'Error fetching agents', error: error.message });
    }
  });
  

// API endpoint to update the status of a lead
app.patch('/api/update-lead-status', authenticateToken, async (req, res) => {
    const { user } = req;  // Get the logged-in user from the middleware
    const { leadId, newStatus, remark,role } = req.body;  // Get lead ID, new status, and remark from the request body

    // Ensure the logged-in user is an agent
    if (role !== 'Agent') {
        return res.status(403).json({ message: 'You are not authorized to perform this action.' });
    }

    if (!leadId || !newStatus) {
        return res.status(400).json({ message: 'Lead ID and new status are required.' });
    }

    try {
        const client = await pool.connect();
    console.log("client")

        // Update the lead's status and remark for the logged-in agent
        const updateQuery = `
            UPDATE customers
            SET status = $1, remark = $2, updated_at = NOW()
            WHERE id = $3 AND userid = $4
            RETURNING *;`;

        // Execute the update query
        const updateResult = await client.query(updateQuery, [newStatus, remark, leadId, user.id]);
            console.log("updateResult")

        client.release();

        // If no lead is updated (either the lead does not exist or is not assigned to the agent)
        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: 'Lead not found or not assigned to you.' });
        }

        // Return the updated lead data
        res.status(200).json({ message: 'Lead status updated successfully', lead: updateResult.rows[0] });
    } catch (error) {
        console.error('Error updating lead status:', error.message);
        res.status(500).json({ message: 'Error updating lead status', error: error.message });
    }
});



// ***********************************My code***********************************************//


// POST endpoint to insert sales data
app.post('/api/insert-sales', async (req, res) => {
    try {
      const { rank, date_of_joining, quality_score, agent, team_leader, sales, achievement, commitment } = req.body;
      const result = await pool.query(
        'INSERT INTO sales (rank, date_of_joining, quality_score, agent, team_leader, sales, achievement, commitment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [rank, date_of_joining, quality_score, agent, team_leader, sales, achievement, commitment]
      );
      res.status(201).json(result.rows[0]);  // Respond with the inserted row
    } catch (err) {
      console.error('Error inserting sales data:', err);
      res.status(500).json({ error: 'Failed to insert sales data' });
    }
  });

  // GET endpoint to fetch sales data
app.get('/api/get-sales', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM sales');
      res.status(200).json(result.rows);  // Respond with all sales data
    } catch (err) {
      console.error('Error fetching sales data:', err);
      res.status(500).json({ error: 'Failed to fetch sales data' });
    }
  });

// Endpoint to get all paid customers
app.get('/api/paid-customers', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM paid_customer ORDER BY sale_date DESC');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching paid customers:', error);
      res.status(500).json({ message: 'Failed to fetch paid customers.' });
    }
  });

// Endpoint to add a new paid customer
app.post('/api/paid-customers', async (req, res) => {
    const { sale_date, customer_id, full_name, package, expiry_date, payment_mode, total_received, company_amount, tax, agent, percentage, shared_amount, remark } = req.body;
  
    try {
      await pool.query(
        `INSERT INTO paid_customer (sale_date, customer_id, full_name, package, expiry_date, payment_mode, total_received, company_amount, tax, agent, percentage, shared_amount, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [sale_date, customer_id, full_name, package, expiry_date, payment_mode, total_received, company_amount, tax, agent, percentage, shared_amount, remark]
      );
      res.status(201).json({ message: 'Paid customer added successfully.' });
    } catch (error) {
      console.error('Error adding paid customer:', error);
      res.status(500).json({ message: 'Failed to add paid customer.' });
    }
  });
  
  // Endpoint to update an existing paid customer
  app.put('/api/paid-customers/:id', async (req, res) => {
    const { id } = req.params;
    const { sale_date, customer_id, full_name, package, expiry_date, payment_mode, total_received, company_amount, tax, agent, percentage, shared_amount, remark } = req.body;
  
    try {
      await pool.query(
        `UPDATE paid_customer SET sale_date = $1, customer_id = $2, full_name = $3, package = $4, expiry_date = $5, payment_mode = $6,
         total_received = $7, company_amount = $8, tax = $9, agent = $10, percentage = $11, shared_amount = $12, remark = $13
         WHERE id = $14`,
        [sale_date, customer_id, full_name, package, expiry_date, payment_mode, total_received, company_amount, tax, agent, percentage, shared_amount, remark, id]
      );
      res.status(200).json({ message: 'Paid customer updated successfully.' });
    } catch (error) {
      console.error('Error updating paid customer:', error);
      res.status(500).json({ message: 'Failed to update paid customer.' });
    }
  });
  
  ////muhjskas===nuchmuch


  // Endpoint to insert data into the sales_agents table
app.post('/api/insert-sales', async (req, res) => {
    const { rank, dateOfJoining, qualityScore, agent, teamLeader, sales, achievement, commitment } = req.body;
  
    const query = `
      INSERT INTO sales_agents (rank, date_of_joining, quality_score, agent, team_leader, sales, achievement, commitment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
  
    try {
      await pool.query(query, [rank, dateOfJoining, qualityScore, agent, teamLeader, sales, achievement, commitment]);
      res.status(200).json({ message: 'Data inserted successfully' });
    } catch (error) {
      console.error('Error inserting data:', error);
      res.status(500).json({ message: 'Error inserting data' });
    }
  });
  
  // Endpoint to fetch all sales data
  app.get('/api/fetch-sales', async (req, res) => {
    const query = 'SELECT * FROM sales_agents ORDER BY rank';
  
    try {
      const result = await pool.query(query);
      res.status(200).json(result.rows);  // Send back the fetched rows
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Error fetching data' });
    }
  });
  















  // ***********************************My code***********************************************//
