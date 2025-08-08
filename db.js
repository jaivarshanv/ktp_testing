import Database from 'better-sqlite3';
const db = new Database('dyeing.db');

// Drop existing tables to recreate with new schema
db.prepare('DROP TABLE IF EXISTS batch_exit').run();
db.prepare('DROP TABLE IF EXISTS batch_items').run();
db.prepare('DROP TABLE IF EXISTS batches').run();
db.prepare('DROP TABLE IF EXISTS material_types').run();
db.prepare('DROP TABLE IF EXISTS mediators').run();
db.prepare('DROP TABLE IF EXISTS companies').run();
db.prepare('DROP TABLE IF EXISTS destinations').run();

// Database initialization - ensure all tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mediators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS material_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    in_time TEXT NOT NULL,
    out_time TEXT,
    lot_number TEXT NOT NULL,
    received_through_type TEXT NOT NULL,
    mediator_id INTEGER,
    destination_id INTEGER,
    exit_notes TEXT,
    transport_type TEXT,
    vehicle_registration TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (mediator_id) REFERENCES mediators(id),
    FOREIGN KEY (destination_id) REFERENCES destinations(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS batch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    material_type_id INTEGER NOT NULL,
    color TEXT NOT NULL,
    number_of_rolls INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (material_type_id) REFERENCES material_types(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert default material types
const defaultMaterials = ['Cotton', 'Polycotton', 'Polyester'];
const insertMaterial = db.prepare('INSERT OR IGNORE INTO material_types (name) VALUES (?)');
defaultMaterials.forEach(material => insertMaterial.run(material));

export default db;