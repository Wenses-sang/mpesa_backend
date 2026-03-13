// ================== IMPORTS ==================
require('dotenv').config(); // Load .env variables
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./database'); // MySQL connection

// ================== CREATE APP ==================
const app = express();
app.use(express.json());
app.use(cors());

// ================== MPESA CONFIG ==================
// Always reference .env keys correctly
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_SHORTCODE;
const passkey = process.env.MPESA_PASSKEY;
const callbackUrl = process.env.MPESA_CALLBACK_URL;

// ================== GENERATE ACCESS TOKEN ==================
async function getToken() {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("TOKEN ERROR:", error.response?.data || error.message);
    throw new Error("Failed to generate token");
  }
}

// ================== GENERATE TIMESTAMP ==================
function getTimestamp() {
  const date = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// ================== REGISTER ==================
app.post('/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !password) return res.status(400).json({ error: "All fields required" });

  db.query(`SELECT * FROM users WHERE email=?`, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      `INSERT INTO users (full_name,email,phone,password) VALUES(?,?,?,?)`,
      [full_name, email, phone, hashedPassword],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          success: true,
          message: "User registered successfully",
          userId: result.insertId
        });
      }
    );
  });
});

// ================== LOGIN ==================
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query(`SELECT * FROM users WHERE email=?`, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(400).json({ error: "User not found" });

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone
      }
    });
  });
});

// ================== MPESA STK PUSH ==================
app.post('/mpesa/pay', async (req, res) => {
  try {
    const { phone, amount, userId } = req.body;
    if (!phone || !amount || !userId) return res.status(400).json({ error: "Phone, amount and userId required" });

    const token = await getToken();
    const timestamp = getTimestamp();
    const passwordEncoded = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    const stkData = {
      BusinessShortCode: shortcode,
      Password: passwordEncoded,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: "Fees",
      TransactionDesc: "School Fees Payment"
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    db.query(
      `INSERT INTO payments (user_id,merchantRequestID,checkoutRequestID,phone,amount,status)
       VALUES(?,?,?,?,?,?)`,
      [userId, response.data.MerchantRequestID, response.data.CheckoutRequestID, phone, amount, "Pending"],
      (err) => { if (err) console.error("DB INSERT ERROR:", err.message); }
    );

    res.json({ success: true, message: "STK Push sent", data: response.data });
  } catch (error) {
    console.error("STK ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "STK Push failed" });
  }
});

// ================== MPESA CALLBACK ==================
app.post('/callback', (req, res) => {
  const stkCallback = req.body?.Body?.stkCallback;
  if (!stkCallback) return res.sendStatus(400);

  const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

  if (ResultCode === 0) {
    const metadata = stkCallback.CallbackMetadata.Item;
    const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;

    db.query(
      `UPDATE payments SET receipt=?, status=? WHERE checkoutRequestID=?`,
      [receipt, "Success", CheckoutRequestID],
      (err) => { if (err) console.error(err.message); }
    );
  } else {
    db.query(
      `UPDATE payments SET status=?, description=? WHERE checkoutRequestID=?`,
      ["Failed", ResultDesc, CheckoutRequestID],
      (err) => { if (err) console.error(err.message); }
    );
  }

  res.sendStatus(200);
});

// ================== GET USER PAYMENTS ==================
app.get('/payments/:userId', (req, res) => {
  const userId = req.params.userId;

  db.query(
    `SELECT * FROM payments WHERE user_id=? ORDER BY id DESC`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));