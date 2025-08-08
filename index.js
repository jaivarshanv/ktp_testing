import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Helper function for IST time
const toIST = () => {
  return new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
};

// Insert companies as default destinations after a delay
setTimeout(() => {
  try {
    const companies = db.prepare('SELECT name FROM companies').all();
    companies.forEach(company => {
      try {
        db.prepare('INSERT OR IGNORE INTO destinations (name) VALUES (?)').run(company.name);
      } catch (e) {
        // Ignore duplicates
      }
    });
    console.log('Default destinations created from companies');
  } catch (e) {
    console.log('Error creating default destinations:', e.message);
  }
}, 1000);

// Get all companies
app.get('/api/companies', (req, res) => {
  try {
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Error fetching companies' });
  }
});

// Add new company
app.post('/api/companies', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name required' });
  
  try {
    const result = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name.trim());
    
    // Also add as destination
    try {
      db.prepare('INSERT OR IGNORE INTO destinations (name) VALUES (?)').run(name.trim());
    } catch (e) {
      console.log('Destination might already exist');
    }
    
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Company already exists' });
    } else {
      console.error('Error adding company:', error);
      res.status(500).json({ error: 'Error adding company' });
    }
  }
});

// Get all mediators
app.get('/api/mediators', (req, res) => {
  try {
    const mediators = db.prepare('SELECT * FROM mediators ORDER BY name').all();
    res.json(mediators);
  } catch (error) {
    console.error('Error fetching mediators:', error);
    res.status(500).json({ error: 'Error fetching mediators' });
  }
});

// Add new mediator
app.post('/api/mediators', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Mediator name required' });
  
  try {
    const result = db.prepare('INSERT INTO mediators (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Mediator already exists' });
    } else {
      console.error('Error adding mediator:', error);
      res.status(500).json({ error: 'Error adding mediator' });
    }
  }
});

// Get all material types
app.get('/api/material-types', (req, res) => {
  try {
    const materialTypes = db.prepare('SELECT * FROM material_types ORDER BY name').all();
    res.json(materialTypes);
  } catch (error) {
    console.error('Error fetching material types:', error);
    res.status(500).json({ error: 'Error fetching material types' });
  }
});

// Add new material type
app.post('/api/material-types', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Material type name required' });
  
  try {
    const result = db.prepare('INSERT INTO material_types (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Material type already exists' });
    } else {
      console.error('Error adding material type:', error);
      res.status(500).json({ error: 'Error adding material type' });
    }
  }
});

// Get all destinations
app.get('/api/destinations', (req, res) => {
  try {
    const destinations = db.prepare('SELECT * FROM destinations ORDER BY name').all();
    res.json(destinations);
  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({ error: 'Error fetching destinations' });
  }
});

// Add new destination
app.post('/api/destinations', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Destination name required' });
  
  try {
    const result = db.prepare('INSERT INTO destinations (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Destination already exists' });
    } else {
      console.error('Error adding destination:', error);
      res.status(500).json({ error: 'Error adding destination' });
    }
  }
});

// Get all batches
app.get('/api/batches', (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT 
        b.*,
        c.name as company_name,
        m.name as mediator_name,
        d.name as destination_name
      FROM batches b
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN mediators m ON b.mediator_id = m.id
      LEFT JOIN destinations d ON b.destination_id = d.id
      ORDER BY b.in_time DESC
    `).all();
    
    res.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Error fetching batches' });
  }
});

// Get open batches (not exited) - THIS WAS THE MISSING ENDPOINT
app.get('/api/batches/open', (req, res) => {
  try {
    const openBatches = db.prepare(`
      SELECT b.*, c.name as company_name, m.name as mediator_name 
      FROM batches b 
      LEFT JOIN companies c ON b.company_id = c.id 
      LEFT JOIN mediators m ON b.mediator_id = m.id 
      WHERE b.out_time IS NULL 
      ORDER BY b.in_time DESC
    `).all();
    
    console.log(`Found ${openBatches.length} open batches`);
    res.json(openBatches);
  } catch (error) {
    console.error('Error fetching open batches:', error);
    res.status(500).json({ error: 'Error fetching open batches' });
  }
});

// Create new batch entry
app.post('/api/batch', (req, res) => {
  const { company_id, lot_number, items, received_through_type, mediator_id } = req.body;
  
  if (!company_id || !lot_number || !items || items.length === 0 || !received_through_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (received_through_type === 'mediator' && !mediator_id) {
    return res.status(400).json({ error: 'Mediator is required when received through mediator' });
  }
  
  try {
    const in_time = toIST();
    
    // Start transaction
    const createBatch = db.transaction(() => {
      // Insert batch
      const batchResult = db.prepare(`
        INSERT INTO batches (company_id, in_time, lot_number, received_through_type, mediator_id) 
        VALUES (?, ?, ?, ?, ?)
      `).run(company_id, in_time, lot_number, received_through_type, mediator_id || null);
      
      const batchId = batchResult.lastInsertRowid;
      
      // Insert batch items
      const insertItem = db.prepare(`
        INSERT INTO batch_items (batch_id, material_type_id, color, number_of_rolls) 
        VALUES (?, ?, ?, ?)
      `);
      
      items.forEach(item => {
        insertItem.run(batchId, item.material_type_id, item.color, item.number_of_rolls);
      });
      
      return batchId;
    });
    
    const batchId = createBatch();
    res.json({ message: 'Batch created successfully', batchId, in_time });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Error creating batch' });
  }
});

// Process batch exit
app.post('/api/batch/:id/exit', (req, res) => {
  const { id } = req.params;
  const { destination_id, notes, transport_type, vehicle_registration } = req.body;
  
  console.log('Exit request received:', { id, destination_id, notes, transport_type, vehicle_registration });
  
  if (!destination_id) {
    return res.status(400).json({ error: 'Destination is required' });
  }
  
  if (!transport_type) {
    return res.status(400).json({ error: 'Transport type is required' });
  }
  
  if (transport_type === 'external' && !vehicle_registration) {
    return res.status(400).json({ error: 'Vehicle registration is required for external transport' });
  }
  
  // Validate vehicle registration format (Indian format) only for external transport
  if (transport_type === 'external' && vehicle_registration) {
    const vehicleRegex = /^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{1,4}$/i;
    if (!vehicleRegex.test(vehicle_registration.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Please enter a valid vehicle registration number' });
    }
  }
  
  try {
    // Check if batch exists and hasn't exited
    const existingBatch = db.prepare('SELECT * FROM batches WHERE id = ? AND out_time IS NULL').get(id);
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found or already exited' });
    }
    
    const out_time = toIST();
    
    // Prepare the update query - only include vehicle_registration if transport_type is external
    const updateQuery = `
      UPDATE batches 
      SET out_time = ?, destination_id = ?, exit_notes = ?, transport_type = ?, vehicle_registration = ? 
      WHERE id = ? AND out_time IS NULL
    `;
    
    const result = db.prepare(updateQuery).run(
      out_time, 
      destination_id, 
      notes || null, 
      transport_type,
      transport_type === 'external' ? vehicle_registration.toUpperCase() : null,
      id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Batch not found or already exited' });
    }
    
    console.log('Batch exit successful:', { id, out_time, destination_id, transport_type });
    
    res.json({ 
      message: 'Batch exited successfully', 
      out_time, 
      destination_id, 
      transport_type,
      vehicle_registration: transport_type === 'external' ? vehicle_registration.toUpperCase() : null
    });
  } catch (error) {
    console.error('Error updating batch exit:', error);
    res.status(500).json({ error: 'Error updating batch exit: ' + error.message });
  }
});

// Get single batch with items for editing
app.get('/api/batch/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    // Get batch details
    const batch = db.prepare(`
      SELECT b.*, c.name as company_name, m.name as mediator_name 
      FROM batches b 
      LEFT JOIN companies c ON b.company_id = c.id 
      LEFT JOIN mediators m ON b.mediator_id = m.id 
      WHERE b.id = ?
    `).get(id);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    // Get batch items
    const items = db.prepare(`
      SELECT bi.*, mt.name as material_name 
      FROM batch_items bi 
      LEFT JOIN material_types mt ON bi.material_type_id = mt.id 
      WHERE bi.batch_id = ?
    `).all(id);
    
    res.json({ ...batch, items });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Error fetching batch' });
  }
});

// Update batch (only if not exited)
app.put('/api/batch/:id', (req, res) => {
  const { id } = req.params;
  const { company_id, lot_number, received_through_type, mediator_id, items } = req.body;
  
  try {
    // Check if batch exists and hasn't exited
    const existingBatch = db.prepare('SELECT * FROM batches WHERE id = ? AND out_time IS NULL').get(id);
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found or already exited' });
    }
    
    // Start transaction
    const updateBatch = db.transaction(() => {
      // Update batch details
      db.prepare(`
        UPDATE batches 
        SET company_id = ?, lot_number = ?, received_through_type = ?, mediator_id = ? 
        WHERE id = ?
      `).run(company_id, lot_number, received_through_type, mediator_id || null, id);
      
      // Delete existing items
      db.prepare('DELETE FROM batch_items WHERE batch_id = ?').run(id);
      
      // Insert updated items
      const insertItem = db.prepare(`
        INSERT INTO batch_items (batch_id, material_type_id, color, number_of_rolls) 
        VALUES (?, ?, ?, ?)
      `);
      
      items.forEach(item => {
        insertItem.run(id, item.material_type_id, item.color, item.number_of_rolls);
      });
    });
    
    updateBatch();
    res.json({ message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Error updating batch' });
  }
});

// Delete batch (only if not exited)
app.delete('/api/batch/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if batch exists and hasn't exited
    const existingBatch = db.prepare('SELECT * FROM batches WHERE id = ? AND out_time IS NULL').get(id);
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found or already exited' });
    }
    
    // Start transaction
    const deleteBatch = db.transaction(() => {
      // Delete batch items first
      db.prepare('DELETE FROM batch_items WHERE batch_id = ?').run(id);
      // Delete batch
      db.prepare('DELETE FROM batches WHERE id = ?').run(id);
    });
    
    deleteBatch();
    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ error: 'Error deleting batch' });
  }
});

// Get batch items for a specific batch
app.get('/api/batch/:id/items', (req, res) => {
  const { id } = req.params;
  
  try {
    const items = db.prepare(`
      SELECT bi.*, mt.name as material_type_name 
      FROM batch_items bi 
      LEFT JOIN material_types mt ON bi.material_type_id = mt.id 
      WHERE bi.batch_id = ?
    `).all(id);
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching batch items:', error);
    res.status(500).json({ error: 'Error fetching batch items' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /api/batches/open');
  console.log('- POST /api/batch/:id/exit');
  console.log('- GET /api/destinations');
  console.log('- POST /api/destinations');
});