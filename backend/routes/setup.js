const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/*
 * Database errors that mean the MySQL server/database itself
 * cannot currently be reached.
 */
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ECONNRESET'
]);

/*
 * Errors that mean the database is reachable, but the
 * HotelPro schema has not been created yet.
 */
const SCHEMA_MISSING_ERROR_CODES = new Set([
  'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR'
]);

/*
 * =========================================================
 * GET /api/setup/status
 * =========================================================
 *
 * This endpoint is called every time the frontend starts.
 *
 * The result must come from the database, NOT browser
 * localStorage/sessionStorage.
 */
router.get('/status', async (req, res) => {
  try {
    /*
     * Check hotel installation record.
     */
    const [settingsRows] = await pool.query(
      `
        SELECT
          id,
          hotel_name,
          currency_code,
          installed_at
        FROM hotel_settings
        LIMIT 1
      `
    );

    /*
     * Check whether at least one user exists.
     */
    const [userRows] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM users
      `
    );

    const settings = settingsRows[0] || null;

    const userCount = Number(
      userRows[0]?.count || 0
    );

    /*
     * HotelPro is considered installed only when:
     *
     * 1. hotel_settings exists
     * 2. installed_at has a value
     * 3. At least one administrator/user exists
     */
    const installed = Boolean(
      settings &&
      settings.installed_at &&
      userCount > 0
    );

    logger.info(
      `Setup status check: installed=${installed}, users=${userCount}, hotel=${settings?.hotel_name || 'none'}`
    );

    return res.json({
      installed,
      dbUnreachable: false,
      hotelName: settings?.hotel_name || null,
      currencyCode: settings?.currency_code || null
    });

  } catch (err) {

    /*
     * Database server itself is unavailable.
     */
    if (CONNECTION_ERROR_CODES.has(err.code)) {

      logger.error(
        `Setup status: database unreachable — ${err.code}: ${err.message}`
      );

      return res.json({
        installed: false,
        dbUnreachable: true,
        dbErrorCode: err.code,
        hotelName: null,
        currencyCode: null
      });
    }

    /*
     * Database exists and is reachable, but the HotelPro
     * tables have not been created yet.
     *
     * This is a legitimate first-install state.
     */
    if (SCHEMA_MISSING_ERROR_CODES.has(err.code)) {

      logger.warn(
        `Setup status: HotelPro database schema is not ready — ${err.code}: ${err.message}`
      );

      return res.json({
        installed: false,
        dbUnreachable: false,
        schemaMissing: true,
        hotelName: null,
        currencyCode: null
      });
    }

    /*
     * IMPORTANT:
     *
     * Do not silently convert an unexpected database error
     * into "not installed".
     *
     * Otherwise an already-installed hotel could be sent
     * back to the installation wizard because of a query
     * problem.
     */
    logger.error(
      `Setup status: unexpected database error — ${err.code || 'UNKNOWN'}: ${err.message}`
    );

    return res.status(500).json({
      error: 'Unable to determine HotelPro installation status.',
      installed: false,
      dbUnreachable: false
    });
  }
});


/*
 * =========================================================
 * POST /api/setup/install
 * =========================================================
 *
 * Performs the first-time HotelPro installation.
 *
 * The database transaction ensures that hotel settings
 * and the administrator account are created together.
 */
router.post('/install', async (req, res, next) => {

  let connection;

  try {

    connection = await pool.getConnection();

    /*
     * Start transaction.
     */
    await connection.beginTransaction();

    /*
     * -----------------------------------------------------
     * Check whether HotelPro is already installed.
     * -----------------------------------------------------
     */

    const [userRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM users
      `
    );

    const userCount = Number(
      userRows[0]?.count || 0
    );

    const [settingsRows] = await connection.query(
      `
        SELECT
          id,
          installed_at
        FROM hotel_settings
        LIMIT 1
      `
    );

    const existingSettings = settingsRows[0] || null;

    /*
     * Never allow a second installation.
     */
    if (
      userCount > 0 &&
      existingSettings?.installed_at
    ) {

      await connection.rollback();

      throw new AppError(
        'HotelPro 5.0 is already installed. Please log in instead.',
        409
      );
    }


    /*
     * -----------------------------------------------------
     * Read installation form
     * -----------------------------------------------------
     */

    const {
      hotelName,
      legalName,
      address,
      city,
      state,
      country,
      phone,
      email,
      timezone,

      currencyCode,
      currencySymbol,
      currencyPosition,

      taxPercent,
      taxLabel,
      serviceChargePercent,

      checkinTime,
      checkoutTime,

      admin
    } = req.body;


    /*
     * -----------------------------------------------------
     * Validate hotel information
     * -----------------------------------------------------
     */

    if (
      !hotelName ||
      !currencyCode ||
      !currencySymbol
    ) {

      throw new AppError(
        'Hotel name and currency selection are required.',
        422
      );
    }


    /*
     * -----------------------------------------------------
     * Validate administrator
     * -----------------------------------------------------
     */

    if (
      !admin ||
      !admin.fullName ||
      !admin.email ||
      !admin.username ||
      !admin.password
    ) {

      throw new AppError(
        'Administrator account details are required.',
        422
      );
    }


    if (admin.password.length < 8) {

      throw new AppError(
        'Admin password must be at least 8 characters.',
        422
      );
    }


    /*
     * -----------------------------------------------------
     * Normalize numeric values
     * -----------------------------------------------------
     */

    const normalizedTaxPercent =
      Number(taxPercent) || 0;

    const normalizedServiceChargePercent =
      Number(serviceChargePercent) || 0;


    /*
     * -----------------------------------------------------
     * Save hotel settings
     * -----------------------------------------------------
     */

    if (existingSettings) {

      await connection.query(
        `
          UPDATE hotel_settings
          SET
            hotel_name = ?,
            legal_name = ?,
            address = ?,
            city = ?,
            state = ?,
            country = ?,
            phone = ?,
            email = ?,
            currency_code = ?,
            currency_symbol = ?,
            currency_position = ?,
            timezone = ?,
            tax_percent = ?,
            tax_label = ?,
            service_charge_percent = ?,
            checkin_time = ?,
            checkout_time = ?,
            installed_at = NOW()
          WHERE id = ?
        `,
        [
          hotelName,
          legalName || null,
          address || null,
          city || null,
          state || null,
          country || null,
          phone || null,
          email || null,

          currencyCode,
          currencySymbol,
          currencyPosition || 'before',

          timezone || 'UTC',

          normalizedTaxPercent,
          taxLabel || 'Tax',
          normalizedServiceChargePercent,

          checkinTime || '14:00:00',
          checkoutTime || '12:00:00',

          existingSettings.id
        ]
      );

    } else {

      await connection.query(
        `
          INSERT INTO hotel_settings (
            hotel_name,
            legal_name,
            address,
            city,
            state,
            country,
            phone,
            email,
            currency_code,
            currency_symbol,
            currency_position,
            timezone,
            tax_percent,
            tax_label,
            service_charge_percent,
            checkin_time,
            checkout_time,
            installed_at
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            NOW()
          )
        `,
        [
          hotelName,
          legalName || null,
          address || null,
          city || null,
          state || null,
          country || null,
          phone || null,
          email || null,

          currencyCode,
          currencySymbol,
          currencyPosition || 'before',

          timezone || 'UTC',

          normalizedTaxPercent,
          taxLabel || 'Tax',
          normalizedServiceChargePercent,

          checkinTime || '14:00:00',
          checkoutTime || '12:00:00'
        ]
      );
    }


    /*
     * -----------------------------------------------------
     * Create first administrator
     * -----------------------------------------------------
     */

    if (userCount === 0) {

      const [roleRows] = await connection.query(
        `
          SELECT id
          FROM roles
          WHERE name = 'admin'
          LIMIT 1
        `
      );

      const adminRole = roleRows[0];

      if (!adminRole) {

        throw new AppError(
          'Default roles are missing — run the database migration first.',
          500
        );
      }


      /*
       * Hash administrator password.
       */
      const passwordHash = await bcrypt.hash(
        admin.password,
        12
      );


      /*
       * Create administrator account.
       */
      await connection.query(
        `
          INSERT INTO users (
            role_id,
            full_name,
            email,
            username,
            password_hash
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          adminRole.id,
          admin.fullName,
          admin.email,
          admin.username,
          passwordHash
        ]
      );
    }


    /*
     * -----------------------------------------------------
     * Verify installation before committing.
     * -----------------------------------------------------
     */

    const [verifySettingsRows] =
      await connection.query(
        `
          SELECT
            id,
            hotel_name,
            currency_code,
            installed_at
          FROM hotel_settings
          LIMIT 1
        `
      );

    const [verifyUserRows] =
      await connection.query(
        `
          SELECT COUNT(*) AS count
          FROM users
        `
      );

    const verifiedSettings =
      verifySettingsRows[0];

    const verifiedUserCount =
      Number(
        verifyUserRows[0]?.count || 0
      );

    const verifiedInstalled = Boolean(
      verifiedSettings &&
      verifiedSettings.installed_at &&
      verifiedUserCount > 0
    );


    if (!verifiedInstalled) {

      throw new AppError(
        'Installation could not be verified. No changes were committed.',
        500
      );
    }


    /*
     * Everything succeeded.
     */
    await connection.commit();


    logger.info(
      `HotelPro installation completed successfully: ${hotelName}`
    );


    return res.status(201).json({
      message:
        'HotelPro 5.0 installed successfully.',
      installed: true,
      hotelName,
      currencyCode
    });

  } catch (err) {

    /*
     * Roll back any partial installation.
     */
    if (connection) {

      try {
        await connection.rollback();
      } catch (rollbackError) {

        logger.error(
          `Setup rollback failed: ${rollbackError.message}`
        );
      }
    }

    next(err);

  } finally {

    /*
     * Always return the connection to the pool.
     */
    if (connection) {
      connection.release();
    }
  }
});


module.exports = router;