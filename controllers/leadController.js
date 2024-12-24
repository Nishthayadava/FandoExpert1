const pool = require('../models/db');
const getLeads = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers');
    const leads = result.rows.map((lead) => ({
      id: lead.id,
      agentId: lead.agentId,
      name: lead.name,
      email: lead.email,
      phone_number: lead.phone_number,
      address: lead.address,
      userid: lead.userid,
      remark: lead.remark,
      status: lead.status,
      created: lead.created_at,
      updated: lead.updated_at,
    }));
    res.status(200).json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Error fetching leads', error });
  }
};

const getMyLeads = async (req, res) => {
  const { user } = req;

  if (!user || !user.id) {
    return res.status(403).json({ message: 'User not authenticated' });
  }

  try {
    const client = await pool.connect();
    console.log("user", user.id);

    // Trim spaces from user.id
    const userIdTrimmed = String(user.id).trim(); 

    const query = `
      SELECT * FROM customers 
      WHERE userid = $1 
      AND (status IS NULL OR remark IS NULL)
    `;
    console.log("query", query);
    
    // Pass the trimmed user.id to the query
    const result = await client.query(query, [userIdTrimmed]);

    console.log("result", result);
    client.release();
    console.log("rows result", result.rows.length);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No leads found for the user.' });
    }

    res.status(200).json({ leads: result.rows });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

const updateLead = async (req, res) => {
    const { leadId } = req.params;
    const { remark, status, userId } = req.body;
  console.log("leadId", leadId);
  cosole.log("userId", userId)

    try {
        const client = await pool.connect();
        const leadQuery = await client.query('SELECT id FROM customers WHERE id = $1', [userId]);
        if (leadQuery.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Lead not found.' });
        }

        const updateQuery = 'UPDATE customers SET remark = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING id, remark, status';
        const updateResult = await client.query(updateQuery, [remark, status, userId]);
        client.release();

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
};

// Assign an agent to a lead
const assignAgent = async (req, res) => {
  const { leadIds, agentId } = req.body;
  const { user } = req;

  if (!user) {
    return res.status(403).json({ message: 'User not authenticated' });
  }

  if (user.role !== 'Admin') {
    return res.status(403).json({ message: 'You are not authorized to assign agents.' });
  }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ message: 'Please provide a valid array of lead IDs.' });
  }

  try {
    const client = await pool.connect();
    const agentQuery = await client.query('SELECT id, role FROM users WHERE id = $1 AND role = $2', [agentId, 'Agent']);
    if (agentQuery.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: 'Agent not found or invalid role.' });
    }

    const updateQuery = 'UPDATE customers SET userid = $1, created_at = NOW() WHERE id = ANY($2::int[])';
    const updateResult = await client.query(updateQuery, [agentId, leadIds]);

    client.release();

    if (updateResult.rowCount > 0) {
      res.status(200).json({ message: 'Leads assigned successfully.' });
    } else {
      res.status(404).json({ message: 'No leads were updated. Please check lead IDs.' });
    }
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({ message: 'Error assigning agent', error });
  }
};
const updateLeadStatus = async (req, res) => {
  const { user } = req; // Get the logged-in user from the middleware
  const { leadId, newStatus, remark, role } = req.body; // Get lead ID, new status, and remark from the request body

  // Ensure the logged-in user is not an Admin
  if (role === 'Admin') {
    return res.status(403).json({ message: 'You are not authorized to perform this action.' });
  }

  if (!leadId || !newStatus) {
    return res.status(400).json({ message: 'Lead ID and new status are required.' });
  }

  try {
    const client = await pool.connect();

    // Update the lead's status and remark for the logged-in agent
    const updateQuery = `
      UPDATE customers
      SET status = $1, remark = $2, updated_at = NOW()
      WHERE id = $3 AND userid = $4
      RETURNING *;
    `;
    const updateResult = await client.query(updateQuery, [newStatus, remark, leadId, user.id]);

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
};
module.exports = {   getLeads,
  updateLead,
  assignAgent, getMyLeads,updateLeadStatus};
