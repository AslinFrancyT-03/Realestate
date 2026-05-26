const fs = require('fs');
const csv = require('csv-parser');
const Business = require('../models/Business');
const SystemStats = require('../models/SystemStats');

// Hierarchical duplicate checking helper:
// 1. Name + Mobile Number
// 2. Name + Website (if mobile missing)
// 3. Name + Address (if website missing)
const findDuplicate = async (title, mobileNumber, website, address, excludeId = null) => {
  const cleanTitle = normalizeString(title);
  const cleanMobile = normalizePhone(mobileNumber);
  const cleanWeb = cleanWebsite(website);
  const cleanAddr = normalizeString(address);

  if (!cleanTitle) return null;

  // 1. Name + Mobile Number (if mobileNumber is present)
  if (cleanMobile) {
    const query = {
      title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      mobileNumber: mobileNumber.trim()
    };
    if (excludeId) query._id = { $ne: excludeId };
    const dup = await Business.findOne(query);
    if (dup) return dup;
  }
  
  // 2. Name + Website (if mobileNumber is missing, but website is present)
  if (cleanWeb) {
    const query = {
      title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      website: { $regex: new RegExp(cleanWeb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    };
    if (excludeId) query._id = { $ne: excludeId };
    const dup = await Business.findOne(query);
    if (dup) return dup;
  }
  
  // 3. Name + Address (if website is missing, but address is present)
  if (cleanAddr) {
    const query = {
      title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      address: { $regex: new RegExp(`^${cleanAddr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };
    if (excludeId) query._id = { $ne: excludeId };
    const dup = await Business.findOne(query);
    if (dup) return dup;
  }

  return null;
};

/**
 * Normalize a CSV row: lowercase, trim, and strip BOM from all keys
 */
function normalizeRow(row) {
  const cleanRow = {};
  Object.keys(row).forEach(key => {
    const cleanKey = key.replace(/^\uFEFF/, '').trim().toLowerCase();
    cleanRow[cleanKey] = (row[key] || '').toString().trim();
  });
  return cleanRow;
}

/**
 * Extract a business object from a normalized CSV row.
 */
function extractBusinessFromRow(cleanRow) {
  // 1. Business Name (title)
  const title = (
    cleanRow['title'] || 
    cleanRow['bussinessname'] || 
    cleanRow['businessname'] || 
    ''
  ).trim() || 'N/A';

  // 2. Broker Name
  const brokerName = (
    cleanRow['brokername'] || 
    cleanRow['broker name'] || 
    cleanRow['broker_name'] || 
    ''
  ).trim() || title;

  // 3. Phone and Mobile Number
  const phone = (cleanRow['phone'] || '').trim() || 'N/A';
  const mobileNumber = (
    cleanRow['mobilenumber'] || 
    cleanRow['mobile number'] || 
    cleanRow['mobile_number'] || 
    ''
  ).trim() || phone;

  // 4. Website
  const website = (cleanRow['website'] || '').trim() || 'N/A';

  // 5. Email
  const email = (cleanRow['email'] || '').trim() || 'N/A';

  // 6. Score (totalScore)
  const scoreRaw = (cleanRow['totalscore'] || cleanRow['score'] || cleanRow['total_score'] || '').trim();
  let totalScore = 0;
  if (scoreRaw !== '') {
    const parsed = parseFloat(scoreRaw);
    totalScore = !isNaN(parsed) ? parsed : 0;
  }

  // 7. Reviews (reviewsCount)
  const reviewsRaw = (
    cleanRow['reviewscount'] || 
    cleanRow['reviewcount'] || 
    cleanRow['reviews_count'] || 
    cleanRow['review_count'] || 
    ''
  ).trim();
  const reviewsCount = reviewsRaw ? (parseInt(reviewsRaw) || 0) : 0;

  // 8. Address components
  const street = (cleanRow['street'] || '').trim() || 'N/A';
  const city = (cleanRow['city'] || '').trim() || 'N/A';
  const state = (cleanRow['state'] || '').trim() || 'N/A';
  const countryCode = (cleanRow['countrycode'] || cleanRow['country code'] || cleanRow['country_code'] || '').trim() || 'N/A';

  // Build Address
  let address = (cleanRow['address'] || '').trim();
  if (!address) {
    const parts = [street, city, state, countryCode].filter(v => v && v.toLowerCase() !== 'n/a');
    address = parts.join(', ') || 'N/A';
  }

  // 9. Categories combination
  const categoryList = [];
  const mainCategory = (cleanRow['categories'] || cleanRow['category'] || '').trim();
  if (mainCategory && mainCategory.toLowerCase() !== 'n/a') {
    categoryList.push(mainCategory);
  }
  // Gather categories/0 through categories/10
  for (let i = 0; i <= 10; i++) {
    const key = `categories/${i}`;
    const val = (cleanRow[key] || '').trim();
    if (val && val.toLowerCase() !== 'n/a') {
      categoryList.push(val);
    }
  }
  const finalCategory = [...new Set(categoryList)].join(', ') || 'N/A';

  const categoryName = (cleanRow['categoryname'] || cleanRow['category name'] || cleanRow['category_name'] || '').trim() || 'N/A';
  const url = (cleanRow['url'] || '').trim() || 'N/A';

  return {
    title,
    brokerName,
    mobileNumber,
    email,
    address,
    totalScore,
    reviewsCount,
    street,
    city,
    state,
    countryCode,
    website,
    phone,
    category: finalCategory,
    categoryName,
    url
  };
}

// @desc    Get all business listings + stats
// @route   GET /api/business
// @access  Public
// Helper to retrieve all globally unique listings based on hierarchical keys
const getGlobalUniqueListings = async () => {
  const allDocs = await Business.find({}).sort({ createdAt: 1 }).lean();
  const uniqueDocs = [];
  const seenKeys = new Set();
  
  for (const doc of allDocs) {
    const key = getDeduplicationKey(doc.title, doc.mobileNumber, doc.website, doc.address);
    if (key) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueDocs.push(doc);
      }
    } else {
      uniqueDocs.push(doc);
    }
  }
  return uniqueDocs;
};

// @desc    Get all business listings + stats
// @route   GET /api/business
// @access  Public
exports.getBusinesses = async (req, res) => {
  try {
    const { search, state, city, category, minScore, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

    // 1. Get all globally unique listings
    const globalUnique = await getGlobalUniqueListings();

    // 2. Compute global dashboard statistics on globalUnique
    const totalCount = globalUnique.length;
    
    const statesSet = new Set();
    const citiesSet = new Set();
    const categoriesSet = new Set();
    let totalScoreSum = 0;
    let ratingCount = 0;

    globalUnique.forEach(doc => {
      if (doc.state && doc.state.trim() && doc.state.toLowerCase() !== 'n/a') {
        statesSet.add(doc.state.trim());
      }
      if (doc.city && doc.city.trim() && doc.city.toLowerCase() !== 'n/a') {
        citiesSet.add(doc.city.trim());
      }
      if (doc.category && doc.category.trim() && doc.category.toLowerCase() !== 'n/a') {
        doc.category.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed && trimmed.toLowerCase() !== 'n/a') {
            categoriesSet.add(trimmed);
          }
        });
      }
      if (doc.totalScore > 0) {
        totalScoreSum += doc.totalScore;
        ratingCount++;
      }
    });

    const activeStates = Array.from(statesSet);
    const activeCities = Array.from(citiesSet);
    const activeCategories = Array.from(categoriesSet);
    const averageRating = ratingCount > 0 ? parseFloat((totalScoreSum / ratingCount).toFixed(2)) : 0.0;

    // Top 5 rated businesses
    const topRatedings = globalUnique
      .filter(doc => doc.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore || b.reviewsCount - a.reviewsCount)
      .slice(0, 5);

    // Top 5 categories with most listings
    const categoryCounts = {};
    globalUnique.forEach(doc => {
      if (doc.category && doc.category.trim() && doc.category.toLowerCase() !== 'n/a') {
        categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
      }
    });
    const topCategories = Object.keys(categoryCounts)
      .map(name => ({ name, count: categoryCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Filter the globalUnique list based on request parameters
    let filteredListings = [...globalUnique];

    if (search) {
      const searchStr = search.trim().toLowerCase();
      filteredListings = filteredListings.filter(doc => 
        (doc.title && doc.title.toLowerCase().includes(searchStr)) ||
        (doc.brokerName && doc.brokerName.toLowerCase().includes(searchStr)) ||
        (doc.city && doc.city.toLowerCase().includes(searchStr)) ||
        (doc.state && doc.state.toLowerCase().includes(searchStr)) ||
        (doc.email && doc.email.toLowerCase().includes(searchStr))
      );
    }

    if (state) {
      const stateStr = state.trim().toLowerCase();
      filteredListings = filteredListings.filter(doc => doc.state && doc.state.trim().toLowerCase() === stateStr);
    }

    if (city) {
      const cityStr = city.trim().toLowerCase();
      filteredListings = filteredListings.filter(doc => doc.city && doc.city.trim().toLowerCase() === cityStr);
    }

    if (category) {
      const categoryStr = category.trim().toLowerCase();
      filteredListings = filteredListings.filter(doc => doc.category && doc.category.trim().toLowerCase() === categoryStr);
    }

    if (minScore) {
      const minVal = parseFloat(minScore);
      filteredListings = filteredListings.filter(doc => doc.totalScore >= minVal);
    }

    // 4. Sort filteredListings
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      const field = (sortBy === 'reviewCount' || sortBy === 'reviewsCount') ? 'reviewsCount' : sortBy;
      filteredListings.sort((a, b) => {
        let valA = a[field] !== undefined ? a[field] : '';
        let valB = b[field] !== undefined ? b[field] : '';
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    } else {
      // Default: newest first (createdAt descending)
      filteredListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 5. Paginate
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    const paginatedListings = filteredListings.slice(skip, skip + limitNum);

    // Fetch duplicates removed from SystemStats
    const statsDoc = await SystemStats.findOne({ key: 'duplicatesRemoved' });
    const duplicatesRemoved = statsDoc ? statsDoc.value : 0;

    res.status(200).json({
      success: true,
      count: paginatedListings.length,
      pagination: {
        total: filteredListings.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filteredListings.length / limitNum)
      },
      data: paginatedListings,
      stats: {
        totalBusinesses: totalCount,
        totalStates: activeStates.length,
        totalCities: activeCities.length,
        averageRating,
        topRated: topRatedings,
        topCategories,
        duplicatesRemoved
      },
      filterOptions: {
        states: activeStates.sort(),
        cities: activeCities.sort(),
        categories: activeCategories.sort()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error fetching businesses',
      error: error.message
    });
  }
};

// @desc    Remove all duplicate records permanently from MongoDB
// @route   POST /api/business/clean-duplicates
// @access  Public
exports.cleanDuplicates = async (req, res) => {
  try {
    const allDocs = await Business.find({}).sort({ createdAt: 1 }).lean();
    
    const duplicateIds = [];
    const seenKeys = new Set();
    
    for (const doc of allDocs) {
      const key = getDeduplicationKey(doc.title, doc.mobileNumber, doc.website, doc.address);
      if (key) {
        if (seenKeys.has(key)) {
          duplicateIds.push(doc._id);
        } else {
          seenKeys.add(key);
        }
      }
    }
    
    let deletedCount = 0;
    if (duplicateIds.length > 0) {
      const result = await Business.deleteMany({ _id: { $in: duplicateIds } });
      deletedCount = result.deletedCount;
      
      // Update SystemStats with total duplicates removed permanently
      await SystemStats.updateOne(
        { key: 'duplicatesRemoved' },
        { $inc: { value: deletedCount } },
        { upsert: true }
      );
    }
    
    const newTotalCount = await Business.countDocuments();
    
    res.status(200).json({
      success: true,
      message: `Successfully cleaned duplicates permanently. Removed: ${deletedCount} records.`,
      duplicatesRemoved: deletedCount,
      totalListings: newTotalCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error during duplicate cleanup',
      error: error.message
    });
  }
};

// @desc    Get single business listing
// @route   GET /api/business/:id
// @access  Public
exports.getBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business listing not found'
      });
    }
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error fetching details',
      error: error.message
    });
  }
};

// @desc    Create new business listing
// @route   POST /api/business
// @access  Public
exports.createBusiness = async (req, res) => {
  try {
    const {
      title, brokerName, mobileNumber, email, address, totalScore,
      reviewsCount, street, city, state, countryCode, website, phone,
      category, categoryName, url
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Business Name (title) is required' });
    }

    // Check duplicate
    const duplicate = await findDuplicate(title, mobileNumber, website, address);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A duplicate business listing already exists matching the hierarchical criteria (${duplicate.title})`
      });
    }

    const reviewsVal = parseInt(reviewsCount) || 0;
    const business = await Business.create({
      title, brokerName, mobileNumber, email, address,
      totalScore: parseFloat(totalScore) || 0,
      reviewsCount: reviewsVal,
      street, city, state, countryCode, website, phone,
      category, categoryName, url
    });

    res.status(201).json({
      success: true,
      message: 'Business listing created successfully',
      data: business
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error creating listing',
      error: error.message
    });
  }
};

// @desc    Update business listing
// @route   PUT /api/business/:id
// @access  Public
// @desc    Update business listing
// @route   PUT /api/business/:id
// @access  Public
exports.updateBusiness = async (req, res) => {
  try {
    const {
      title, brokerName, mobileNumber, email, address, totalScore,
      reviewsCount, street, city, state, countryCode, website, phone,
      category, categoryName, url
    } = req.body;

    let business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business listing not found' });
    }

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Business Name (title) is required' });
    }

    // Check duplicate (excluding self)
    const duplicate = await findDuplicate(title, mobileNumber, website, address, req.params.id);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A duplicate business listing already exists matching the hierarchical criteria (${duplicate.title})`
      });
    }

    const reviewsVal = parseInt(reviewsCount) || 0;
    business = await Business.findByIdAndUpdate(
      req.params.id,
      {
        title, brokerName, mobileNumber, email, address,
        totalScore: parseFloat(totalScore) || 0,
        reviewsCount: reviewsVal,
        street, city, state, countryCode, website, phone,
        category, categoryName, url
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Business listing updated successfully',
      data: business
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error updating listing',
      error: error.message
    });
  }
};

// @desc    Delete business listing
// @route   DELETE /api/business/:id
// @access  Public
exports.deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business listing not found'
      });
    }

    await Business.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Business listing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error deleting listing',
      error: error.message
    });
  }
};

// @desc    Delete all business listings
// @route   DELETE /api/business/delete-all
// @access  Public
exports.deleteAllBusinesses = async (req, res) => {
  try {
    const result = await Business.deleteMany({});
    // Reset duplicatesRemoved count to 0 in SystemStats
    await SystemStats.updateOne({ key: 'duplicatesRemoved' }, { value: 0 }, { upsert: true });
    res.status(200).json({
      success: true,
      message: 'All records deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error deleting all listings',
      error: error.message
    });
  }
};

// @desc    Upload CSV file and import data
// @route   POST /api/upload-csv
// @access  Public
exports.uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const filePath = req.file.path;
    const results = [];
    const headers = [];

    // Parse CSV
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (hdrList) => {
        headers.push(...hdrList);
      })
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        try {
          // Check if at least a business name column is present
          const hasTitle = headers.some(h => {
            const norm = h.replace(/^\uFEFF/, '').trim().toLowerCase();
            return norm === 'title' || norm === 'bussinessname' || norm === 'businessname';
          });
          if (!hasTitle) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
              success: false,
              message: "Invalid CSV format. Missing business name column ('BussinessName' or 'title')."
            });
          }

          const importResult = await importCSVRows(results);

          // Delete uploaded file after processing
          fs.unlinkSync(filePath);

          res.status(200).json({
            success: true,
            message: `CSV parsing completed. Imported: ${importResult.imported}, Duplicates skipped: ${importResult.duplicates}, Updated: ${importResult.updated}, Errors: ${importResult.errors}`,
            stats: {
              totalRows: results.length,
              imported: importResult.imported,
              duplicates: importResult.duplicates,
              updated: importResult.updated,
              errors: importResult.errors
            }
          });
        } catch (dbErr) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          res.status(500).json({
            success: false,
            message: 'Error importing CSV data to database',
            error: dbErr.message
          });
        }
      })
      .on('error', (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({
          success: false,
          message: 'Error parsing CSV file',
          error: err.message
        });
      });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: 'Server Error uploading CSV',
      error: error.message
    });
  }
};

// Helper to clean and normalize string (case-insensitive, ignores multiple spaces)
function normalizeString(str) {
  if (!str || str.toLowerCase().trim() === 'n/a') return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper to clean phone numbers (removes all white spaces, dashes, etc.)
function normalizePhone(phone) {
  if (!phone || phone.toLowerCase().trim() === 'n/a') return '';
  return phone.trim().toLowerCase().replace(/\s+/g, '').replace(/[-()]/g, '');
}

// Helper to clean websites (removes protocol http/https/www and trailing slashes)
function cleanWebsite(web) {
  if (!web || web.toLowerCase().trim() === 'n/a') return '';
  let cleaned = web.trim().toLowerCase();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

// Helper to check if a field is blank
function isBlank(val) {
  if (val === undefined || val === null) return true;
  const str = String(val).trim().toLowerCase();
  return str === '' || str === 'n/a' || str === 'not available';
}

// Helper to check and generate the hierarchical deduplication key
function getDeduplicationKey(title, mobileNumber, website, address) {
  const cleanTitle = normalizeString(title);
  const cleanMobile = normalizePhone(mobileNumber);
  const cleanWeb = cleanWebsite(website);
  const cleanAddr = normalizeString(address);

  if (!cleanTitle) return null;

  // 1. Name + Mobile Number (highest priority)
  if (cleanMobile) {
    return `mobile|${cleanTitle}|${cleanMobile}`;
  }
  // 2. Name + Website (if mobile number is missing)
  if (cleanWeb) {
    return `website|${cleanTitle}|${cleanWeb}`;
  }
  // 3. Name + Address (if website is missing)
  if (cleanAddr) {
    return `address|${cleanTitle}|${cleanAddr}`;
  }
  
  return null;
}

/**
 * Import an array of raw CSV row objects into MongoDB with high-performance duplicate check and merging.
 * Returns { imported, duplicates, updated, errors }
 */
async function importCSVRows(results) {
  let importedCount = 0;
  let duplicateCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // In-memory indexing of existing database records
  const existingDocs = await Business.find({}).lean();
  
  // Map to quickly lookup existing database records by hierarchical key
  const dbMap = new Map();

  for (const doc of existingDocs) {
    const key = getDeduplicationKey(doc.title, doc.mobileNumber, doc.website, doc.address);
    if (key) {
      dbMap.set(key, doc);
    }
  }

  // Map to track processed records within the current CSV batch (intra-batch deduplication)
  const batchMap = new Map();

  // Accumulators for bulk db operations
  const bulkUpdates = [];
  const newBusinesses = [];

  for (const row of results) {
    const cleanRow = normalizeRow(row);
    const biz = extractBusinessFromRow(cleanRow);

    if (!biz.title || biz.title === 'N/A') {
      errorCount++;
      continue;
    }

    const key = getDeduplicationKey(biz.title, biz.mobileNumber, biz.website, biz.address);

    // 1. Check duplicate within the current CSV batch (intra-batch)
    if (key && batchMap.has(key)) {
      const batchMatch = batchMap.get(key);
      // Duplicate in the batch, skip inserting. Update missing/blank fields of the first batch listing
      const fields = ['email', 'address', 'website', 'brokerName', 'phone', 'state', 'countryCode', 'mobileNumber'];
      fields.forEach(f => {
        if (isBlank(batchMatch[f]) && !isBlank(biz[f])) {
          batchMatch[f] = biz[f];
        }
      });
      duplicateCount++;
      continue;
    }

    // 2. Check duplicate against existing database records
    if (key && dbMap.has(key)) {
      const dbMatch = dbMap.get(key);
      // Duplicate exists in MongoDB. Update blank/missing fields
      const fieldsToUpdate = {};
      const fields = ['email', 'address', 'website', 'brokerName', 'phone', 'state', 'countryCode', 'mobileNumber'];
      
      fields.forEach(f => {
        if (isBlank(dbMatch[f]) && !isBlank(biz[f])) {
          dbMatch[f] = biz[f];
          fieldsToUpdate[f] = biz[f];
        }
      });

      if (Object.keys(fieldsToUpdate).length > 0) {
        bulkUpdates.push({
          updateOne: {
            filter: { _id: dbMatch._id },
            update: { $set: fieldsToUpdate }
          }
        });
      }
      updatedCount++;
      continue;
    }

    // 3. Unique record! Add to batch maps and insertion queue
    newBusinesses.push(biz);
    if (key) {
      batchMap.set(key, biz);
    }
    
    importedCount++;
  }

  // Execute database bulk operations
  if (bulkUpdates.length > 0) {
    await Business.bulkWrite(bulkUpdates);
  }
  if (newBusinesses.length > 0) {
    await Business.insertMany(newBusinesses);
  }

  // Update SystemStats with total duplicates removed (skipped + updated)
  const totalDuplicatesRemoved = duplicateCount + updatedCount;
  if (totalDuplicatesRemoved > 0) {
    await SystemStats.updateOne(
      { key: 'duplicatesRemoved' },
      { $inc: { value: totalDuplicatesRemoved } },
      { upsert: true }
    );
  }

  return { 
    imported: importedCount, 
    duplicates: duplicateCount, 
    updated: updatedCount, 
    errors: errorCount 
  };
}

/**
 * Auto-import sample.csv on server startup.
 * Disabled to comply with the fresh empty website requirement.
 */
exports.autoImportCSV = async (csvPath) => {
  console.log('[Auto-Import] Preloading is disabled. Starting with a fresh empty database.');
};

// @desc    Get agent details with filtering and pagination
// @route   GET /api/business/agents
// @access  Public
exports.getAgents = async (req, res) => {
  try {
    const { searchName, searchState, searchCompany, page = 1, limit = 10 } = req.query;

    const globalUnique = await getGlobalUniqueListings();

    let filteredAgents = [...globalUnique];

    if (searchName && searchName.trim()) {
      const nameStr = searchName.trim().toLowerCase();
      filteredAgents = filteredAgents.filter(doc => doc.brokerName && doc.brokerName.toLowerCase().includes(nameStr));
    }
    if (searchState && searchState.trim()) {
      const stateStr = searchState.trim().toLowerCase();
      filteredAgents = filteredAgents.filter(doc => doc.state && doc.state.toLowerCase() === stateStr);
    }
    if (searchCompany && searchCompany.trim()) {
      const companyStr = searchCompany.trim().toLowerCase();
      filteredAgents = filteredAgents.filter(doc => doc.title && doc.title.toLowerCase().includes(companyStr));
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const paginatedAgents = filteredAgents.slice(skip, skip + limitNum);

    const agents = paginatedAgents.map(agent => ({
      name: agent.brokerName && agent.brokerName.trim() && agent.brokerName.toLowerCase() !== 'n/a' ? agent.brokerName : 'N/A',
      companyName: agent.title && agent.title.trim() && agent.title.toLowerCase() !== 'n/a' ? agent.title : 'N/A',
      website: agent.website && agent.website.trim() && agent.website.toLowerCase() !== 'n/a' ? agent.website : 'N/A',
      address: agent.address && agent.address.trim() && agent.address.toLowerCase() !== 'n/a' ? agent.address : 'N/A',
      email: agent.email && agent.email.trim() && agent.email.toLowerCase() !== 'n/a' ? agent.email : 'N/A',
      state: agent.state && agent.state.trim() && agent.state.toLowerCase() !== 'n/a' ? agent.state : 'N/A',
      country: agent.countryCode && agent.countryCode.trim() && agent.countryCode.toLowerCase() !== 'n/a' ? agent.countryCode : 'N/A'
    }));

    res.status(200).json({
      success: true,
      count: agents.length,
      pagination: {
        total: filteredAgents.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filteredAgents.length / limitNum)
      },
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error fetching agent details',
      error: error.message
    });
  }
};

