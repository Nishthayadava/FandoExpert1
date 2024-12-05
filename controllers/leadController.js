const pool = require('../models/db');

const updateLead = async (req, res) => {
    const { leadId } = req.params;
    const { remark, status, userId } = req.body;

    try {
        const client = await pool.connect();
        const leadQuery = await client.query('SELECT id FROM customers WHERE id = $1', [leadId]);
        if (leadQuery.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Lead not found.' });
        }

        const updateQuery = 'UPDATE customers SET remark = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING id, remark, status';
        const updateResult = await client.query(updateQuery, [remark, status, leadId]);
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

module.exports = { updateLead };
