// ================== IMPORTS ==================
require('dotenv').config(); // Load environment variables
const mysql = require('mysql2');

// ================== CREATE MYSQL CONNECTION POOL ==================
const db = mysql.createPool({
  host: process.env.DB_HOST || 'your-cloud-db-host',
  user: process.env.DB_USER || 'your-db-username',
  password: process.env.DB_PASSWORD || 'your-db-password',
  database: process.env.DB_NAME || 'your-database-name',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

// Test connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to MySQL database!');
    connection.release();
  }
});

// ================== CREATE TABLES IF NOT EXIST ==================
const createTables = () => {
  // ================= USERS TABLE =================
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20),
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(usersTable, (err) => {
    if (err) console.error('Error creating users table:', err.message);
    else console.log('Users table ready.');
  });

  // ================= PAYMENTS TABLE =================
  const paymentsTable = `
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      merchantRequestID VARCHAR(255),
      checkoutRequestID VARCHAR(255),
      phone VARCHAR(20),
      amount DECIMAL(10,2),
      receipt VARCHAR(255),
      status VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  db.query(paymentsTable, (err) => {
    if (err) console.error('Error creating payments table:', err.message);
    else console.log('Payments table ready.');
  });
};

// ================== INITIALIZE TABLES ==================
createTables();

// ================== EXPORT DB ==================
module.exports = db;