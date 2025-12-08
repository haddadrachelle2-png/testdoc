const { getPool } = require("../config/db");
const documentModel = require("../models/documentModel");
const PDFDocument = require('pdfkit');
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // save with timestamp
  }
});

const upload = multer({ storage });

module.exports = {
  // Create a new document
  async create(req, res) {
    const { title, content, doc_num, doc_date, number_papers, destinations } = req.body;
    if (!title || !content || !doc_num || !doc_date || !number_papers || !destinations?.length) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      const safeDocDate = doc_date ? new Date(doc_date) : null;
      const docId = await documentModel.createDocument(
        title,
        content,
        doc_num,
        safeDocDate,
        number_papers,
        req.user.id,
        req.user.is_group_admin,
        destinations
      );
      res.json({ message: "Document created", id: docId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // Save a draft or update existing draft
  async save(req, res) {
    const { id, title, content, doc_num, doc_date, number_papers, destinations } = req.body;
    if (!title || !content || !doc_num || !doc_date || !number_papers || !destinations?.length) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      
      let docId;
      if (id) {
        // update existing draft
       const safeDocDate = doc_date ? new Date(doc_date) : null;
        docId = await documentModel.updateDraft(
          id,
          title,
          doc_num,
          safeDocDate,
          number_papers,
          content,
          destinations
        );
        res.json({ message: "Draft updated", id: docId });
      } else {
        // create new document
        docId = await documentModel.createDocument(
          title,
          content,
          doc_num,
          safeDocDate,
          number_papers,
          req.user.id,
          req.user.is_group_admin,
          destinations
        );
        res.json({ message: "Document created", id: docId });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // Get all drafts (not sent) for logged-in user
  async getDrafts(req, res) {
    try {
      const pool = await getPool();
      const result = await pool.request().input("sender_id", req.user.id)
        .query(`
                    SELECT id, title, content, doc_num, doc_date, number_papers, created_at 
                    FROM documents 
                    WHERE sender_id=@sender_id AND is_sent=0
                    ORDER BY created_at DESC
                `);
      res.json(result.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // Get a single draft by ID (with destinations)
  async getDraftById(req, res) {
    const docId = req.params.id;
    const userId = req.user.id;

    try {
      const pool = await getPool();

      // Fetch main document
      const docResult = await pool
        .request()
        .input("id", docId)
        .input("sender_id", userId).query(`
                    SELECT id, title, content ,doc_num,doc_date,number_papers
                    FROM documents 
                    WHERE id=@id AND sender_id=@sender_id AND is_sent=0
                `);

      if (!docResult.recordset.length) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const document = docResult.recordset[0];
     if (document.doc_date) {
            document.doc_date = document.doc_date.toISOString().split("T")[0];
     }
      // Fetch destinations
      const destResult = await pool
        .request()
        .input("document_id", docId)
        .query(
          `SELECT group_id FROM document_destinations WHERE document_id=@document_id`
        );

      const destinations = destResult.recordset.map((r) => r.group_id);

      res.json({ ...document, destinations });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // GET /api/documents/drafts?start=YYYY-MM-DD&end=YYYY-MM-DD
  async getDraftsByDate(req, res) {
    try {
      const pool = await getPool();
      const senderId = req.user.id;
      const { start, end } = req.query;

      let query = `
            SELECT *
            FROM documents 
            WHERE sender_id=@sender_id AND is_sent=0
        `;

      if (start) query += " AND created_at >= @start";
      if (end) query += " AND created_at <= @end";

      query += " ORDER BY created_at DESC";

      const request = pool.request().input("sender_id", senderId);
      if (start) request.input("start", start);
      if (end) request.input("end", end);

      const result = await request.query(query);
      res.json(result.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },
  // POST { draftIds: [1,2,3] }
  async sendDrafts(req, res) {
    try {
      const { draftIds } = req.body;
      if (!draftIds || !draftIds.length) {
        return res.status(400).json({ message: "No drafts selected" });
      }

      const pool = await getPool();
      const senderId = req.user.id;

      // Only allow sending drafts that belong to this user and are unsent
      let updateQuery = `
                UPDATE documents
                SET is_sent = 1, sent_at = getdate()`;
      
      if (req.user.is_group_admin) {
        updateQuery += `, admin_view = 1 , admin_view_date = getdate()`;
      }
      
      updateQuery += `
                WHERE id IN (${draftIds.join(
                  ","
                )}) AND sender_id=@sender_id AND is_sent=0
            `;

      await pool
        .request()
        .input("sender_id", senderId)
        .query(updateQuery);

      res.json({ message: "Selected drafts sent successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // GET /api/documents/sent?start=YYYY-MM-DD&end=YYYY-MM-DD
  async getSentDocuments(req, res) {
    try {
      const pool = await getPool();
      const senderId = req.user.id;
    //  const { start, end } = req.query;

      let query = `
            SELECT id, title, created_at, sent_at
            FROM documents
            WHERE sender_id=@sender_id AND is_sent=1
        `;
      // if (start) query += " AND sent_at >= @start";
      // if (end) query += " AND sent_at <= @end";
      query += " ORDER BY sent_at DESC";

      const request = pool.request().input("sender_id", senderId);
      // if (start) request.input("start", start);
      // if (end) request.input("end", end);

      const result = await request.query(query);
      res.json(result.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // GET /api/documents/:id/destinations
  async getDocumentDestinations(req, res) {
    try {
      const pool = await getPool();
      const docId = req.params.id;

      const result = await pool
        .request()
        .input("document_id", docId)
        .query(
          "SELECT g.name FROM document_destinations dd JOIN groups g ON dd.group_id=g.id WHERE dd.document_id=@document_id"
        );

      res.json(result.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

    // Get all sent from draft for logged-in user
  async getInbox(req, res) {
  try {
    const pool = await getPool();
    const userGroupId = req.user.group_id;
    const is_admin_group = req.user.is_admin_group;
    let query = `
      SELECT     d.id, d.title, d.[content], d.created_at, d.sender_id, g.name AS senderName, d.sent_at, d.is_received, g.is_admin_group
     FROM         dbo.documents AS d INNER JOIN
     dbo.users AS u ON u.id = d.sender_id INNER JOIN
      dbo.groups AS g ON u.group_id = g.id 
       WHERE d.is_sent = 1`;

    if (is_admin_group) {
      // Admins see all sent documents across all groups, but exclude documents
      // created by group-admin users themselves
      query += ` AND u.is_group_admin = 0`;
    } else {
      query += ` AND EXISTS (
        SELECT 1 FROM document_destinations dd
        WHERE dd.document_id = d.id AND dd.group_id = @group_id
      ) AND d.admin_view = 1`;
    }

    const { start, end } = req.query;
    if (start) query += " AND d.created_at >= @start";
    if (end) query += " AND d.created_at <= @end";

    query += " ORDER BY d.created_at DESC";

    const request = pool.request().input("group_id", userGroupId);

    if (start) request.input("start", start);
    if (end) request.input("end", end);

    const result = await request.query(query);
    console.log(result.recordset);
    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
},

  async set_mark_selected(req, res) {
    try {
        // Ensure only admin can do this
        // if (req.user.is_admin_group !== 1) {
        //     return res.status(403).json({
        //         message: "Only admin can perform this action."
        //     });
        // }

        const inboxIds = req.body.inboxIds;

        if (!Array.isArray(inboxIds) || inboxIds.length === 0) {
            return res.status(400).json({ message: "No inbox IDs provided." });
        }

        const pool = await getPool();

        const sql = `
            UPDATE documents
            SET is_received = 1,received_date = getdate()
            WHERE id IN (${inboxIds.join(",")})
        `;

        await pool.request().query(sql);

        res.json({ message: "Marked as seen by admin." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error." });
    }

  },

  // Get pending documents (unsent drafts from group members) - Admin only
  async getPendingDocuments(req, res) {
    try {
      const pool = await getPool();
      const adminGroupId = req.user.group_id;

      // Safety check
      if (!adminGroupId) {
        console.log('ERROR: adminGroupId is', adminGroupId, 'req.user is', req.user);
        return res.status(400).json({ message: "group_id missing from token", user: req.user });
      }

      const query = `
        SELECT d.id, d.title, d.[content], d.created_at, d.sender_id,
               g.name AS senderName
        FROM documents d
        INNER JOIN users u ON d.sender_id = u.id
        INNER JOIN groups g ON u.group_id = g.id
        WHERE d.is_received = 1 and isnull(d.admin_view, 0) = 0
        ORDER BY d.created_at DESC
      `;

      console.log('Executing query with adminGroupId:', adminGroupId);
      const result = await pool.request().query(query);

      res.json(result.recordset || []);

    } catch (err) {
      console.error('getPendingDocuments error:', err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // Bulk approve and send multiple documents - Admin only
  async approveBulk(req, res) {
    try {
      const pool = await getPool();
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No document IDs provided." });
      }

      // Mark all selected documents as admin_view
      const sql = `
        UPDATE documents
        SET admin_view = 1, admin_view_date = getdate()
        WHERE id IN (${ids.join(",")})
      `;

      await pool.request().query(sql);

      res.json({ message: `${ids.length} document(s) approved and sent successfully.` });

    } catch (err) {
      console.error('approveBulk error:', err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // Bulk approve and send multiple documents - Admin only
  async approvedocument(req, res) {
    try {
      const pool = await getPool();
      const id = req.params.id;
      
      // Mark all selected documents as admin_view
      const sql = `
        UPDATE documents
        SET admin_view = 1, admin_view_date = getdate()
        WHERE id = ${id}
      `;

      await pool.request().query(sql);

      res.json({ message: `Document approved and sent successfully.` });

    } catch (err) {
      console.error('approveBulk error:', err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  async uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pool = await getPool();
    const docId = req.params.id;

    const fileName = req.file.filename;
    const fileExt = path.extname(req.file.originalname);

    await pool
      .request()
      .input("id", docId)
      .input("file", fileName)
      .input("ext", fileExt)
      .query(`
        UPDATE documents
        SET doc_file = @file, doc_ext = @ext
        WHERE id = @id
      `);

    return res.json({ message: "File uploaded", file: fileName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error uploading file" });
  }
},


  // Generate PDF report for sent documents (returns attachment)
  async generateSentReportPdf(req, res) {
    try {
      const pool = await getPool();
      const senderId = req.user.id;
      const { start, end } = req.query;

      // Build SQL with optional date filters. Use FOR XML PATH aggregation for compatibility.
      const filters = ['d.sender_id = @sender_id', 'd.is_sent = 1'];
      if (start) filters.push('d.created_at >= @start');
      if (end) filters.push('d.created_at <= @end');

      const whereClause = 'WHERE ' + filters.join(' AND ');

      const query = `
        SELECT d.id, d.title, d.[content], d.created_at, d.sent_at,
          STUFF((
            SELECT ', ' + g2.name
            FROM document_destinations dd2
            JOIN groups g2 ON g2.id = dd2.group_id
            WHERE dd2.document_id = d.id
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS destinations
        FROM documents d
        ${whereClause}
        ORDER BY d.sent_at DESC
      `;

      const request = pool.request().input('sender_id', senderId);
      if (start) request.input('start', start);
      if (end) request.input('end', end);

      const result = await request.query(query);
      const rows = result.recordset || [];

      // Prepare PDF
      res.setHeader('Content-Disposition', 'attachment; filename="sent-documents-report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
    // const path = require('path');
     //doc.registerFont('ArabicFont', path.join(__dirname, 'fonts', 'Amiri-Regular.ttf'));

      doc.pipe(res);

      // Header
      doc.fontSize(18).text('Sent Documents Report', { align: 'center' });
      doc.moveDown(0.5);
      const rangeText = `Generated: ${new Date().toLocaleString()}` +
        (start || end ? ` | Range: ${start || '...'} - ${end || '...'}` : '');
      doc.fontSize(10).text(rangeText, { align: 'center' });
      doc.moveDown(1);

      // Table-like listing
      rows.forEach((r, idx) => {
        doc.fontSize(12).fillColor('#000').text(`${idx + 1}. ${r.title} (ID: ${r.id})`);
        doc.fontSize(10).fillColor('#444').text(`Sent At: ${r.sent_at ? new Date(r.sent_at).toLocaleString() : 'N/A'}`);
        if (r.destinations) doc.text(`Destinations: ${r.destinations}`);
        if (r.content) {
          const snippet = String(r.content).replace(/\s+/g, ' ').trim().slice(0, 500);
          doc.moveDown(0.2).fontSize(10).text(snippet + (r.content.length > 500 ? '...' : ''));
        }
        doc.moveDown(0.8);
        // Add a horizontal rule
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeOpacity(0.1).stroke();
        doc.moveDown(0.8);
      });

      doc.end();

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error generating PDF' });
    }
  }
}
