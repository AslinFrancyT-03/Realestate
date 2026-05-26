const assert = require('assert').strict;
const http = require('http');
const path = require('path');
const fs = require('fs');

// We will load local dotenv config
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Business = require('../models/Business');

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

    // 8. Test CSV Upload mock (using a boundary payload or endpoint integration checks)
    console.log('\n[6/7] Testing CSV Import Flow...');
    const testCsvPath = path.join(__dirname, 'test_upload.csv');
    fs.writeFileSync(testCsvPath, 'title,brokerName,phone,website,address,email,totalScore,reviewsCount,street,city,state,countryCode\nBatch Biz 3,Agent Carter,+111222,www.carter.com,12 Park Ave,carter@re.com,4.5,10,12 Park Ave,Chicago,IL,USA\n');
    
    // We will simulate form data upload
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
    assert.equal(res.body.stats.imported, 1);
    
    // Clean up temporary test file
    fs.unlinkSync(testCsvPath);
    console.log('✓ CSV upload and integration verified.');

    // 9. Test Delete Dataset
    console.log('\n[7/7] Testing Delete Dataset Flow...');
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
