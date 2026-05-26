# RealEstate Pro - Business Listing Management System

A premium, responsive, full-stack Real Estate Business and Agent listings management platform. Designed with rich dark-mode aesthetics, glassmorphic layouts, instant validations, and database statistics.

## Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (custom responsive styling), Bootstrap 5, Modern Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js REST API with Multer for upload flows.
- **Database**: MongoDB via Mongoose Schemas.
- **Tools**: CSV Parser for bulk imports.

---

## Folder Architecture

```
business-listing-manager/
├── client/                     # Premium Frontend Interface
│   ├── css/
│   │   └── styles.css          # Styled glassmorphism & responsive layouts
│   ├── js/
│   │   ├── api.js              # Centralised fetch client logic
│   │   ├── app.js              # Dashboard table, filter, sort, pagination, and CSV actions
│   │   └── form.js             # Form controls, blur actions, regex validations
│   ├── index.html              # Main dashboard panel
│   └── form.html               # Add & Edit listings form
├── server/                     # Backend API server
│   └── index.js                # Express app bootstrap, static server, and routing
├── config/                     # Core configs
│   └── db.js                   # Mongoose database integration
├── models/                     # MongoDB models
│   └── Business.js             # Business schema and indexing
├── controllers/                # Request logic
│   └── businessController.js   # CRUD operations, stats aggregator, duplicate logic, and CSV parser
├── routes/                     # Router middleware
│   └── businessRoutes.js       # Business endpoint setup
├── uploads/                    # Temp storage folder for parsing CSVs
├── public/                     # Static media folder
├── package.json                # Dependencies and start triggers
└── README.md                   # Setup guide
```

---

## Getting Started

### Prerequisites

1. Ensure **Node.js** (v16+) is installed on your local computer.
2. Verify that your local **MongoDB** server is running. By default, the application connects to:
   `mongodb://127.0.0.1:27017/business_listings`

### Running the Project

Follow these step-by-step commands to install dependencies and run the server:

1. **Open terminal** and navigate to your project directory:
   ```bash
   cd "C:\Users\This Pc\.gemini\antigravity\scratch\business-listing-manager"
   ```

2. **Install all dependencies** listed in `package.json`:
   ```bash
   npm install
   ```

3. **Start the Express backend and serve client UI**:
   ```bash
   npm start
   ```

4. **Open your browser** and visit:
   [http://localhost:5000](http://localhost:5000)

---

## Backend REST API Endpoints

- `GET /api/business` - List listings (supports paginations, sorting, filtering, searching, dynamic stats, and dropdown lists).
- `GET /api/business/:id` - Fetch single profile details by MongoDB ID.
- `POST /api/business` - Create a business listing (checks for duplicates on phone, website, title).
- `PUT /api/business/:id` - Update a listing profile by ID.
- `DELETE /api/business/:id` - Delete a listing by ID.
- `POST /api/business/upload-csv` - Upload standard CSV spreadsheet and automatically import records.

---

## CSV Upload Schema Guidelines

Your uploaded CSV must feature the following columns. The system automatically handles header validations and strips whitespace.

```csv
title,totalScore,reviewsCo,street,city,state,countryCode,website,phone,categories,categoryName,url,email,address,brokerName,mobileNumber
```

### Sample CSV Row Template
```csv
"Oceanview Estates",4.8,32,"100 Marine Drive","Miami","Florida","US","https://oceanviewestates.com","+1 305-555-0145","real_estate_agency","Real Estate Agency","https://maps.google.com/?cid=111","sales@oceanview.com","100 Marine Drive, Miami, Florida, US","Sarah Jenkins","+1 305-555-0140"
```
