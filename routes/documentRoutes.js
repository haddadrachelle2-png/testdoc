const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const auth = require('../middleware/auth'); // JWT auth middleware
const adminOnly = require("../middleware/adminOnly");
const multer = require("multer");
// const upload = multer({ dest: "uploads/" });
const upload = multer({ storage: multer.memoryStorage() });
const { getPool, sql } = require("../config/db");


// ✅ Create a new document
router.post('/create', auth, documentController.create);

// ✅ Save a document (create or update draft)
router.post('/save', auth, documentController.save);
// router.post("/upload/:id", auth, upload.single("file"), documentController.uploadFile);

// ✅ Send selected drafts (mark as is_sent=1)
router.post('/send', auth, documentController.sendDrafts);

router.post('/approve-bulk', auth, adminOnly, documentController.approveBulk);
router.post("/approve/:id", auth, adminOnly, documentController.approvedocument);

router.post("/markseen", auth,adminOnly, documentController.set_mark_selected);

// ✅ Get all drafts, optional filter by start/end date
// Example: /api/documents/drafts?start=2025-11-01&end=2025-11-25
router.get('/drafts', auth, documentController.getDraftsByDate);

router.get('/inbox', auth, documentController.getInbox);

router.get('/pending', auth, adminOnly, documentController.getPendingDocuments);

router.get('/sent', auth, documentController.getSentDocuments);
// PDF report of sent documents
router.get('/sent/report', auth, documentController.generateSentReportPdf);

router.get('/:id/destinations', auth, documentController.getDocumentDestinations);

// ✅ Get a single draft by ID (for editing) - MUST BE LAST
router.get('/:id', auth, documentController.getDraftById);

// Multer config - store file in memory as buffer


router.post("/api/documents/upload/:id", upload.single("file"), documentController.uploadFile);

module.exports = router;


// const express = require('express');
// const router = express.Router();
// const documentController = require('../controllers/documentController');
// const auth = require('../middleware/auth');

// router.post('/create', auth, documentController.create);
// router.get('/drafts', auth, documentController.getDrafts);
// router.post('/save', auth, documentController.save);
// router.get('/:id', auth, documentController.getDraftById);

// // router.get('/searchdrafts', auth, documentController.getDraftsByDate);
// router.post('/send', auth, documentController.sendDrafts);


// module.exports = router;
