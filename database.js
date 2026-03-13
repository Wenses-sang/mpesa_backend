// ================== IMPORTS ==================
require('dotenv').config(); // Load environment variables
const mysql = require('mysql2');

// ================== CREATE MYSQL CONNECTION ==================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'your-cloud-db-host',       // e.g., db123.railway.app
  user: process.env.DB_USER || 'your-db-username',         // your MySQL username
  password: process.env.DB_PASSWORD || 'your-db-password', // your MySQL password
  database: process.env.DB_NAME || 'your-database-name',   // your MySQL database name
  port: process.env.DB_PORT || 3306
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    process.exit(1); // stop the server if DB connection fails
  } else {
    console.log('Connected to MySQL database!');
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