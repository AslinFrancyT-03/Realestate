const fs = require('fs');
const csv = require('csv-parser');
const Business = require('../models/Business');

// Duplicate checking helper (checks title, phone, website - ignoring empty values)
const findDuplicate = async (title, phone, website, excludeId = null) => {
  const query = { $or: [] };

  if (title && title.trim() && title.toLowerCase() !== 'n/a') {
    query.$or.push({ title: { $regex: new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  }
  
  if (phone && phone.trim() && phone.toLowerCase() !== 'n/a') {
    query.$or.push({ phone: phone.trim() });
  }

  if (website && website.trim() && website.toLowerCase() !== 'n/a') {
    // Normalise website strings to compare (strip protocol and slash)
    const cleanWeb = website.trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    if (cleanWeb) {
      query.$or.push({
        website: { $regex: new RegExp(cleanWeb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });
    }
  }

  if (query.$or.length === 0) return null;

  if (excludeId) {
    return await Business.findOne({
      _id: { $ne: excludeId },
      $or: query.$or
    });
  }

  return await Business.findOne({ $or: query.$or });
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
exports.getBusinesses = async (req, res) => {
  try {
    const { search, state, city, category, minScore, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

    // 1. Build Query for Listings
    const query = {};

    // Search functionality (title, brokerName, city, state, email)
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { brokerName: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { email: searchRegex }
      ];
    }

    // Filters
    if (state) {
      query.state = { $regex: new RegExp(`^${state.trim()}$`, 'i') };
    }
    if (city) {
      query.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
    }
    if (category) {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }
    if (minScore) {
      query.totalScore = { $gte: parseFloat(minScore) };
    }

    // 2. Sorting
    let sort = {};
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'reviewCount' || sortBy === 'reviewsCount') {
        sort.reviewsCount = order;
      } else {
        sort[sortBy] = order;
      }
    } else {
      sort.createdAt = -1; // Default newest first
    }

    // 3. Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Execute paginated search query
    const listings = await Business.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const totalListings = await Business.countDocuments(query);

    // 4. Calculate Global Dashboard Cards Stats
    const totalCount = await Business.countDocuments();
    
    // Distinct states and cities
    const distinctStates = await Business.distinct('state');
    const distinctCities = await Business.distinct('city');
    
    // Filter out empty/null/N/A values for cleaner distinct lists
    const activeStates = distinctStates.filter(s => s && s.trim() && s.toLowerCase() !== 'n/a');
    const activeCities = distinctCities.filter(c => c && c.trim() && c.toLowerCase() !== 'n/a');

    // Average rating (only from items with score > 0)
    const ratingStats = await Business.aggregate([
      { $match: { totalScore: { $gt: 0 } } },
      { $group: { _id: null, avgRating: { $avg: '$totalScore' } } }
    ]);
    const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].avgRating.toFixed(2)) : 0.0;

    // Top 5 rated businesses (sorted by score desc, review count desc)
    const topRated = await Business.find({ totalScore: { $gt: 0 } })
      .sort({ totalScore: -1, reviewsCount: -1 })
      .limit(5);

    // Top 5 categories with most listings
    const categoryStats = await Business.aggregate([
      { $match: { category: { $ne: 'N/A' }, $and: [{ category: { $ne: '' } }] } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const topCategories = categoryStats.map(c => ({
      name: c._id || 'N/A',
      count: c.count
    }));

    // Get dynamic filters list from all records in db (to populate dropdowns in UI)
    const allCategories = await Business.distinct('category');
    const activeCategories = allCategories.filter(cat => cat && cat.trim() && cat.toLowerCase() !== 'n/a');

    res.status(200).json({
      success: true,
      count: listings.length,
      pagination: {
        total: totalListings,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalListings / limitNum)
      },
      data: listings,
      stats: {
        totalBusinesses: totalCount,
        totalStates: activeStates.length,
        totalCities: activeCities.length,
        averageRating,
        topRated,
        topCategories
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
    const duplicate = await findDuplicate(title, phone, website);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A duplicate business listing already exists matching the name, phone, or website (${duplicate.title})`
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
    const duplicate = await findDuplicate(title, phone, website, req.params.id);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A duplicate business listing already exists matching the name, phone, or website (${duplicate.title})`
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
            message: `CSV parsing completed. Imported: ${importResult.imported}, Duplicates skipped: ${importResult.duplicates}, Errors: ${importResult.errors}`,
            stats: {
              totalRows: results.length,
              imported: importResult.imported,
              duplicates: importResult.duplicates,
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

/**
 * Import an array of raw CSV row objects into MongoDB.
 * Returns { imported, duplicates, errors }
 */
async function importCSVRows(results) {
  let importedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  // Batch duplicate tracking within the upload
  const processedTitles = new Set();
  const processedPhones = new Set();
  const processedWebsites = new Set();

  for (const row of results) {
    const cleanRow = normalizeRow(row);
    const biz = extractBusinessFromRow(cleanRow);

    if (!biz.title || biz.title === 'N/A') {
      errorCount++;
      continue;
    }

    // Clean website string for batch duplicate check
    const cleanWeb = biz.website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

    // 1. Check duplicate within the incoming batch
    const lowercaseTitle = biz.title.toLowerCase();
    let isBatchDuplicate = processedTitles.has(lowercaseTitle);
    if (biz.phone && biz.phone !== 'N/A' && processedPhones.has(biz.phone)) {
      isBatchDuplicate = true;
    }
    if (cleanWeb && cleanWeb.toLowerCase() !== 'n/a' && processedWebsites.has(cleanWeb.toLowerCase())) {
      isBatchDuplicate = true;
    }

    if (isBatchDuplicate) {
      duplicateCount++;
      continue;
    }

    // 2. Check duplicate against MongoDB database
    const dbDuplicate = await findDuplicate(biz.title, biz.phone, biz.website);
    if (dbDuplicate) {
      duplicateCount++;
      continue;
    }

    // Add to batch tracking
    processedTitles.add(lowercaseTitle);
    if (biz.phone && biz.phone !== 'N/A') processedPhones.add(biz.phone);
    if (cleanWeb && cleanWeb.toLowerCase() !== 'n/a') processedWebsites.add(cleanWeb.toLowerCase());

    try {
      await Business.create(biz);
      importedCount++;
    } catch (err) {
      console.error(`Error importing row "${biz.title}":`, err.message);
      errorCount++;
    }
  }

  return { imported: importedCount, duplicates: duplicateCount, errors: errorCount };
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

    const query = {};

    if (searchName && searchName.trim()) {
      query.brokerName = { $regex: new RegExp(searchName.trim(), 'i') };
    }
    if (searchState && searchState.trim()) {
      query.state = { $regex: new RegExp(searchState.trim(), 'i') };
    }
    if (searchCompany && searchCompany.trim()) {
      query.title = { $regex: new RegExp(searchCompany.trim(), 'i') };
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Fetch and project only Name, Company Name, Website, Address, Email, State, Country Code
    const rawAgents = await Business.find(query)
      .select('brokerName title website address email state countryCode -_id')
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalAgents = await Business.countDocuments(query);

    // Normalize values safely. Email and Company Name are defaulted to 'N/A' if unavailable
    const agents = rawAgents.map(agent => ({
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
        total: totalAgents,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalAgents / limitNum)
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

