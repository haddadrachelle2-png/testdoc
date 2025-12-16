const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const auth = require('../middleware/auth'); // JWT auth middleware
const adminOnly = require("../middleware/adminOnly");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });
const { getPool, sql } = require("../config/db");

// ✅ Create a new document
router.post('/create', auth, documentController.create);

// ✅ Save a document (create or update draft)
router.post('/save', auth, upload.single("attachment"),documentController.save);

// ✅ Send selected drafts (mark as is_sent=1)
router.post('/send', auth, documentController.sendDrafts);

router.post('/approve-bulk', auth, adminOnly, documentController.approveBulk);
router.post("/approve/:id", auth, adminOnly, documentController.approvedocument);

router.post("/markseen", auth, documentController.set_mark_selected);

// ✅ Get all drafts, optional filter by start/end date
// Example: /api/documents/drafts?start=2025-11-01&end=2025-11-25
router.get('/drafts', auth, documentController.getDraftsByDate);

router.get('/inbox', auth, documentController.getInbox);

router.get('/pending', auth, adminOnly, documentController.getPendingDocuments);

router.get('/sent', auth, documentController.getSentDocuments);
// PDF report of sent documents
router.get('/sent/report', auth, documentController.generateSentReportPdf);

router.get('/:id/destinations', auth, documentController.getDocumentDestinations);
router.get("/:id/file", auth, documentController.getDraftFile);

// ✅ Get a single draft by ID (for editing) - MUST BE LAST
router.get('/:id', auth, documentController.getDraftById);
router.get('/view/:id', auth, documentController.getViewDocumentById);

module.exports = router;


