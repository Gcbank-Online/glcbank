// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const db = require('./db');
const { signToken, authenticateMiddleware, bcrypt, SALT_ROUNDS } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

function fromCents(cents){ return (cents/100).toFixed(2); }

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Register
app.post('/auth/register', async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required() });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { email, password } = value;
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRes = await db.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, hash]);
    const user = userRes.rows[0];
    const acctNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    await db.query('INSERT INTO accounts (user_id, account_number, balance_bigint) VALUES ($1, $2, $3)', [user.id, acctNum, 0]);
    const token = signToken({ userId: user.id, email: user.email });
    return res.status(201).json({ token, account_number: acctNum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { email, password } = value;
  try {
    const userRes = await db.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = userRes.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ userId: user.id, email: user.email });
    const acctRes = await db.query('SELECT id, account_number, balance_bigint FROM accounts WHERE user_id = $1 LIMIT 1', [user.id]);
    const acct = acctRes.rows[0];
    return res.json({ token, account: { account_number: acct.account_number, balance: fromCents(acct.balance_bigint) } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get my account & balance
app.get('/me/account', authenticateMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const acctRes = await db.query('SELECT id, account_number, balance_bigint FROM accounts WHERE user_id = $1 LIMIT 1', [userId]);
    if (acctRes.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    const acct = acctRes.rows[0];
    return res.json({ account_number: acct.account_number, balance: fromCents(acct.balance_bigint) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get transactions (paginated)
app.get('/me/transactions', authenticateMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const offset = parseInt(req.query.offset || '0');
  try {
    const acctRes = await db.query('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [userId]);
    if (acctRes.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    const acctId = acctRes.rows[0].id;
    const txRes = await db.query('SELECT id, amount_bigint, counterparty_account, type, note, created_at FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [acctId, limit, offset]);
    const txs = txRes.rows.map(r => ({ id: r.id, amount: (r.amount_bigint/100).toFixed(2), counterparty: r.counterparty_account, type: r.type, note: r.note, created_at: r.created_at }));
    return res.json({ transactions: txs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Lookup account by account_number
app.get('/accounts/lookup/:accountNumber', authenticateMiddleware, async (req, res) => {
  const acctNum = req.params.accountNumber;
  try {
    const r = await db.query('SELECT id, account_number FROM accounts WHERE account_number = $1 LIMIT 1', [acctNum]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    return res.json({ account_number: r.rows[0].account_number, account_id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Transfer endpoint (atomic)
app.post('/transfers', authenticateMiddleware, async (req, res) => {
  const schema = Joi.object({
    from_account_number: Joi.string().required(),
    to_account_number: Joi.string().required(),
    amount: Joi.number().positive().required(),
    note: Joi.string().allow('').max(500)
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { from_account_number, to_account_number, amount, note } = value;
  const userId = req.user.userId;
  if (from_account_number === to_account_number) return res.status(400).json({ error: "Can't transfer to same account" });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const accountRows = await client.query(
      `SELECT id, user_id, account_number, balance_bigint
       FROM accounts
       WHERE account_number = ANY($1)
       FOR UPDATE`,
      [[from_account_number, to_account_number]]
    );

    if (accountRows.rowCount < 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    const fromRow = accountRows.rows.find(r => r.account_number === from_account_number);
    const toRow = accountRows.rows.find(r => r.account_number === to_account_number);

    if (!fromRow || !toRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account lookup failed' });
    }

    if (fromRow.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized to transfer from this account' });
    }

    const amountCents = Math.round(amount * 100);

    if (fromRow.balance_bigint < amountCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const newFromBalance = fromRow.balance_bigint - amountCents;
    const newToBalance = toRow.balance_bigint + amountCents;

    await client.query('UPDATE accounts SET balance_bigint = $1 WHERE id = $2', [newFromBalance, fromRow.id]);
    await client.query('UPDATE accounts SET balance_bigint = $1 WHERE id = $2', [newToBalance, toRow.id]);

    await client.query('INSERT INTO transactions (account_id, amount_bigint, counterparty_account, type, note) VALUES ($1, $2, $3, $4, $5)', [fromRow.id, -amountCents, to_account_number, 'transfer_out', note]);
    await client.query('INSERT INTO transactions (account_id, amount_bigint, counterparty_account, type, note) VALUES ($1, $2, $3, $4, $5)', [toRow.id, amountCents, from_account_number, 'transfer_in', note]);

    await client.query('COMMIT');

    return res.json({
      message: 'Transfer successful',
      from_account: { account_number: from_account_number, balance: (newFromBalance/100).toFixed(2) },
      to_account: { account_number: to_account_number, balance: (newToBalance/100).toFixed(2) }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error', err);
    return res.status(500).json({ error: 'Transfer failed' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => console.log(`GCBank API listening on ${PORT}`));
