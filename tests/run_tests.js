const assert = require('assert').strict;
const dns = require('dns');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Fix DNS resolution for MongoDB Atlas SRV records on some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

// We will load local dotenv config
require('dotenv').config({ path: path.join(__dirname, '../.env') });
process.env.MONGODB_URI = 'mongodb://localhost:27017/businessListingDB_test';

const connectDB = require('../config/db');
const Business = require('../models/Business');
const SystemStats = require('../models/SystemStats');

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('====================================================');
  console.log('      RUNNING AUTOMATED FULL-STACK TEST SUITE');
  console.log('====================================================');

  // 1. Connect to Database
  await connectDB();

  // 2. Start Express app locally for testing
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/business', require('../routes/businessRoutes'));

  const server = app.listen(PORT);
  console.log(`[Test Server] Listening on ${BASE_URL}`);

  try {
    // 3. Clear Database to start clean
    console.log('\n[1/7] Cleaning Database...');
    await Business.deleteMany({});
    await SystemStats.deleteMany({});
    
    // Verify count is 0
    let res = await fetch(`${BASE_URL}/api/business`);
    let json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 0);
    console.log('✓ Database cleared successfully.');

    // 4. Create Mock data
    console.log('\n[2/7] Creating Mock Listing Data...');
    const mockListing = {
      title: 'Real Estate Pros Ltd',
      brokerName: 'John Doe',
      mobileNumber: '+1234567890',
      email: 'john.doe@repros.com',
      address: '123 Ocean Drive, Miami, FL, USA',
      totalScore: 4.8,
      reviewsCount: 15,
      street: '123 Ocean Drive',
      city: 'Miami',
      state: 'FL',
      countryCode: 'USA',
      website: 'www.repros.com',
      phone: '+1234567890',
      category: 'Real Estate Agency, Brokerage',
      categoryName: 'Agencies',
      url: 'https://maps.google.com/repros'
    };
    
    res = await fetch(`${BASE_URL}/api/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockListing)
    });
    json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.title, 'Real Estate Pros Ltd');
    console.log('✓ Mock listing created.');

    // Create another mock listing with missing email/company to test N/A fallback
    const mockListingNA = {
      title: '  ', // Missing company name
      brokerName: 'Jane Smith',
      mobileNumber: '+9876543210',
      email: '', // Missing email
      address: '456 Mountain Pass, Denver, CO, USA',
      totalScore: 4.2,
      reviewsCount: 8,
      street: '456 Mountain Pass',
      city: 'Denver',
      state: 'CO',
      countryCode: 'USA',
      website: '',
      phone: '+9876543210',
      category: 'Agency',
      categoryName: 'Agency',
      url: 'https://maps.google.com/jane'
    };
    
    // Wait, the title is required in mongoose model, so we need to set a dummy or test validation
    // The schema has title required, so let's set a title but leave other fields empty for Jane Smith
    mockListingNA.title = 'Independent Broker';
    res = await fetch(`${BASE_URL}/api/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockListingNA)
    });
    json = await res.json();
    assert.equal(json.success, true);
    console.log('✓ N/A fallback mock listing created.');
    const mockListingPartial = {
      title: 'Co-Working Spaces LLC',
      brokerName: '  ', // Empty broker name
      mobileNumber: '',
      email: '  ', // Empty email
      address: '',
      totalScore: 3.5,
      reviewsCount: 3,
      street: '789 Tech Road',
      city: 'Austin',
      state: 'TX',
      countryCode: 'USA',
      website: '   ',
      phone: '',
      category: 'Rentals',
      categoryName: 'Offices'
    };
    res = await fetch(`${BASE_URL}/api/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockListingPartial)
    });
    json = await res.json();
    assert.equal(json.success, true);
    console.log('✓ Partial mock listing created.');

    // 5. Test Main Dashboard GET Endpoint
    console.log('\n[3/7] Testing Main Listings API...');
    res = await fetch(`${BASE_URL}/api/business`);
    json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 3);
    assert.equal(json.stats.totalBusinesses, 3);
    assert.equal(json.stats.totalStates, 3); // FL, CO, TX
    console.log('✓ Main listings and stats verified.');

    // 6. Test New Agent Details API
    console.log('\n[4/7] Testing Agent Details API...');
    res = await fetch(`${BASE_URL}/api/business/agents`);
    json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 3);
    
    // Assert required fields exist and prohibited fields are absent
    const agent = json.data[0];
    assert.ok(agent.name);
    assert.ok(agent.companyName);
    assert.ok(agent.website !== undefined);
    assert.ok(agent.address);
    assert.ok(agent.email);
    assert.ok(agent.state);
    assert.ok(agent.country);
    
    assert.equal(agent.score, undefined);
    assert.equal(agent.reviews, undefined);
    assert.equal(agent.category, undefined);
    assert.equal(agent.phone, undefined);
    assert.equal(agent._id, undefined);

    // Verify N/A Fallbacks on the partial agent (brokerName was whitespace-only)
    const partialAgent = json.data.find(a => a.companyName === 'Co-Working Spaces LLC');
    assert.ok(partialAgent);
    assert.equal(partialAgent.name, 'N/A'); // brokerName was '  '
    assert.equal(partialAgent.email, 'N/A'); // email was '  '
    assert.equal(partialAgent.website, 'N/A'); // website was '   '
    console.log('✓ Agent Details projected fields and N/A fallbacks verified.');

    // 7. Test Filtering on Agent Details API
    console.log('\n[5/7] Testing Agent Details Search & Filters...');
    // Filter by name: "John Doe"
    res = await fetch(`${BASE_URL}/api/business/agents?searchName=John`);
    json = await res.json();
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].name, 'John Doe');

    // Filter by state: "TX"
    res = await fetch(`${BASE_URL}/api/business/agents?searchState=TX`);
    json = await res.json();
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].state, 'TX');

    // Filter by company: "Spaces"
    res = await fetch(`${BASE_URL}/api/business/agents?searchCompany=Spaces`);
    json = await res.json();
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].companyName, 'Co-Working Spaces LLC');
    console.log('✓ Agent Details search/filters verified.');

    // 8. Test CSV Upload mock and Deduplication Flow
    console.log('\n[6/8] Testing CSV Import & Deduplication Flow...');
    const testCsvPath = path.join(__dirname, 'test_upload.csv');
    
    // Construct a CSV with 6 rows designed for the new hierarchical rules:
    // - Row 1: Unique Biz 1 (Mobile present) -> Unique Biz 1 (New, unique inserted)
    // - Row 2: Unique Biz 1 (Mobile present) -> Skipped (Duplicate of Row 1 by Name + Mobile)
    // - Row 3: Unique Biz 2 (Mobile missing, Website present) -> Unique Biz 2 (New, unique inserted)
    // - Row 4: Unique Biz 2 (Mobile missing, Website present) -> Skipped (Duplicate of Row 3 by Name + Website), merges email2@test.com
    // - Row 5: Real Estate Pros Ltd -> Matches existing DB record by Name + Mobile. Counts as updated.
    // - Row 6: Independent Broker -> Matches existing DB record by Name + Website (since mobile is empty). Counts as updated.
    const csvContent = 
      'title,brokerName,phone,mobileNumber,website,address,email,totalScore,reviewsCount,street,city,state,countryCode\n' +
      'Unique Biz 1,Broker A,12345,12345,www.unique1.com,Addr 1,email1@test.com,4.5,5,Street 1,City 1,ST,USA\n' +
      'Unique Biz 1,Broker A,12345,12345,www.unique1.com,Addr 1,email1@test.com,4.5,5,Street 1,City 1,ST,USA\n' +
      'Unique Biz 2,Broker B,,,www.unique2.com,Addr 2,,4.0,2,Street 2,City 2,ST,USA\n' +
      'Unique Biz 2,Broker B,,,www.unique2.com,Addr 2,email2@test.com,4.0,2,Street 2,City 2,ST,USA\n' +
      'Real Estate Pros Ltd,John Doe,+1234567890,+1234567890,www.repros.com,123 Ocean Drive Miami FL USA,,4.8,15,123 Ocean Drive,Miami,FL,USA\n' +
      'Independent Broker,Jane Smith,,,"www.jane-website.com","456 Mountain Pass, Denver, CO, USA",,4.2,8,456 Mountain Pass,Denver,CO,USA\n';
      
    fs.writeFileSync(testCsvPath, csvContent);
    
    // Simulate form data upload
    const FormData = require('form-data');
    const form = new FormData();
    form.append('csvFile', fs.createReadStream(testCsvPath));

    res = await new Promise((resolve, reject) => {
      form.submit(`${BASE_URL}/api/business/upload-csv`, (err, res) => {
        if (err) reject(err);
        else {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
        }
      });
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    
    // Assert summary stats:
    // Total rows: 6, Unique imported: 2, Duplicates skipped: 2, Updated existing: 2
    assert.equal(res.body.stats.totalRows, 6);
    assert.equal(res.body.stats.imported, 2);
    assert.equal(res.body.stats.duplicates, 2);
    assert.equal(res.body.stats.updated, 2);
    
    // Clean up temporary test file
    fs.unlinkSync(testCsvPath);
    console.log('✓ CSV upload duplicate report counts verified.');

    // Verify fields merge in MongoDB:
    res = await fetch(`${BASE_URL}/api/business`);
    json = await res.json();
    
    // 1. Verify Unique Biz 2 has its email merged (from Row 4 into Row 3)
    const unique2 = json.data.find(b => b.title === 'Unique Biz 2');
    assert.ok(unique2);
    assert.equal(unique2.email, 'email2@test.com');
    console.log('✓ In-batch duplicate field merging verified.');
    
    // 2. Verify Independent Broker has its website merged from CSV (since it was empty in DB)
    const janeBroker = json.data.find(b => b.title === 'Independent Broker');
    assert.ok(janeBroker);
    assert.equal(janeBroker.website, 'www.jane-website.com');
    console.log('✓ Existing DB record duplicate field merging verified.');

    // 3. Verify that duplicatesRemoved count is now 4 (2 skipped + 2 updated) in global stats
    assert.equal(json.stats.duplicatesRemoved, 4);
    console.log('✓ Global duplicatesRemoved metric card count verified.');

    // 9. Test Permanent "Clean Duplicates" API
    console.log('\n[7/8] Testing Permanent "Clean Duplicates" API...');
    
    // We will bypass the findDuplicate validation by directly bypassing create or inserting duplicates into db
    // Let's create duplicates in the test database using standard create with unique titles so they bypass the checks,
    // or by calling create with different parameters but same mobile number!
    const dup1 = {
      title: 'Duplicate Clean Test',
      mobileNumber: '99999',
      website: 'clean1.com',
      address: 'Test Addr'
    };
    const dup2 = {
      title: 'Duplicate Clean Test',
      mobileNumber: '99999',
      website: 'clean2.com',
      address: 'Test Addr 2'
    };
    
    // Save first
    await Business.create(dup1);
    // Force insert second bypassing findDuplicate by writing directly to mongoose schema or model bypass
    const docBypass = new Business(dup2);
    await docBypass.save({ validateBeforeSave: false }); // bypass any schema validation if any

    // Verify database actually has duplicates matching the same mobile number
    let listBefore = await Business.find({ title: 'Duplicate Clean Test' });
    assert.equal(listBefore.length, 2);

    // Call clean-duplicates API
    res = await fetch(`${BASE_URL}/api/business/clean-duplicates`, { method: 'POST' });
    json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.duplicatesRemoved, 1); // 1 duplicate deleted

    let listAfter = await Business.find({ title: 'Duplicate Clean Test' });
    assert.equal(listAfter.length, 1);
    console.log('✓ Permanent "Clean Duplicates" API verified successfully.');

    // 10. Test Delete Dataset
    console.log('\n[8/8] Testing Delete Dataset Flow...');
    res = await fetch(`${BASE_URL}/api/business/delete-all`, { method: 'DELETE' });
    json = await res.json();
    assert.equal(json.success, true);
    
    res = await fetch(`${BASE_URL}/api/business`);
    json = await res.json();
    assert.equal(json.data.length, 0);
    console.log('✓ Delete dataset verified.');

    console.log('\n====================================================');
    console.log('      ALL AUTOMATED TEST ASSERTIONS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST ASSERTION FAILED:', err);
    process.exit(1);
  } finally {
    server.close();
    console.log('[Test Server] Stopped.');
    process.exit(0);
  }
}

runTests();
