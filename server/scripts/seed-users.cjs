const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), 'vault/secrets.env') });

const { scrypt, randomBytes } = crypto;
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1, maxmem: 128 * 16384 * 8 * 2 };

function scryptHash(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_COST, (err, dk) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${dk.toString('hex')}`);
    });
  });
}

const users = [
  { userId: 'youssef.karim', email: 'youssef.karim@safrangroup.com', role: 'admin' },
  { userId: 'wala.gloulou', email: 'wala.gloulou@safrangroup.com', role: 'admin' },
  { userId: 'benoit.marie', email: 'benoit.marie@safrangroup.com', role: 'admin' },
  { userId: 'aliz.pinto-mora', email: 'aliz.pinto-mora@safrangroup.com', role: 'admin' },
];

const poolConfig = {
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  port: Number(process.env.MSSQL_PORT || 1433),
  options: {
    encrypt: String(process.env.MSSQL_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.MSSQL_TRUST_CERT || 'false') === 'true',
    instanceName: process.env.MSSQL_INSTANCE,
  },
  pool: { max: 2, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

(async () => {
  const pool = await sql.connect(poolConfig);
  try {
    for (const u of users) {
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      const hash = await scryptHash(tempPassword);
      await pool.request()
        .input('user_id', sql.NVarChar(64), u.userId)
        .input('email', sql.NVarChar(256), u.email)
        .input('role', sql.NVarChar(16), u.role)
        .input('pwd_hash', sql.NVarChar(512), hash)
        .query(`
          MERGE app_users AS target
          USING (SELECT @user_id AS user_id) AS source
          ON target.user_id = source.user_id
          WHEN MATCHED THEN
            UPDATE SET email=@email, role=@role, pwd_hash=@pwd_hash, must_reset=1, updated_at=SYSDATETIMEOFFSET()
          WHEN NOT MATCHED THEN
            INSERT (user_id, email, role, pwd_hash, must_reset)
            VALUES (@user_id, @email, @role, @pwd_hash, 1);
        `);
      console.log(`${u.userId}: ${tempPassword}`);
    }
  } finally {
    await pool.close();
  }
})().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
