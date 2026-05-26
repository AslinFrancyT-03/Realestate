const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  deleteAllBusinesses,
  uploadCSV,
  getAgents
} = require('../controllers/businessController');

// Configure Multer Storage for file uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// CSV File Filter
const csvFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: csvFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Define APIs
router.route('/')
  .get(getBusinesses)
  .post(createBusiness);

// GET AGENTS must be registered before standard /:id route
router.get('/agents', getAgents);

// DELETE ALL must be registered before standard /:id route
router.delete('/delete-all', deleteAllBusinesses);

// CSV upload MUST be before /:id to prevent 'upload-csv' being matched as an :id param
router.post('/upload-csv', upload.single('csvFile'), uploadCSV);

router.route('/:id')
  .get(getBusiness)
  .put(updateBusiness)
  .delete(deleteBusiness);

// Error handling middleware for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Multer Error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;
