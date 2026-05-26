/**
 * Business Listing Management - Database Grid logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Configuration ---
  const state = {
    search: '',
    state: '',
    city: '',
    category: '',
    minScore: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 25,
    totalPages: 1,
    filtersInitialized: false,
    selectedDeleteId: null
  };

  // --- DOM References ---
  const searchInput = document.getElementById('searchInput');
  const filterState = document.getElementById('filterState');
  const filterCity = document.getElementById('filterCity');
  const filterCategory = document.getElementById('filterCategory');
  const filterScore = document.getElementById('filterScore');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  
  const listingsTableBody = document.getElementById('listingsTableBody');
  const tableSpinner = document.getElementById('tableSpinner');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  
  const statTotal = document.getElementById('statTotal');
  const statStates = document.getElementById('statStates');
  const statCities = document.getElementById('statCities');
  const statRating = document.getElementById('statRating');
  const topCategoriesContainer = document.getElementById('topCategoriesContainer');

  // Exports
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  // Modals
  const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');
  const deleteListingName = document.getElementById('deleteListingName');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
  const viewDetailsModalEl = document.getElementById('viewDetailsModal');
  const detailsModalBody = document.getElementById('detailsModalBody');
  const editDetailsModalBtn = document.getElementById('editDetailsModalBtn');

  const deleteAllDbBtn = document.getElementById('deleteAllDbBtn');
  const deleteAllDbModalEl = document.getElementById('deleteAllDbModal');
  const confirmDeleteAllDbBtn = document.getElementById('confirmDeleteAllDbBtn');
  
  let deleteModalObj = null;
  if (deleteConfirmModalEl) {
    deleteModalObj = new bootstrap.Modal(deleteConfirmModalEl);
  }
  
  let detailsModalObj = null;
  if (viewDetailsModalEl) {
    detailsModalObj = new bootstrap.Modal(viewDetailsModalEl);
  }

  let deleteAllDbModalObj = null;
  if (deleteAllDbModalEl) {
    deleteAllDbModalObj = new bootstrap.Modal(deleteAllDbModalEl);
  }

  // --- Initial Load ---
  loadData();

  // --- Fetch and Render Core ---
  async function loadData() {
    showSpinner(true);
    try {
      const result = await window.BusinessAPI.getBusinesses({
        search: state.search,
        state: state.state,
        city: state.city,
        category: state.category,
        minScore: state.minScore,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        page: state.page,
        limit: state.limit
      });

      if (result.success) {
        renderStats(result.stats);
        renderTable(result.data);
        updatePagination(result.pagination);
        
        // Dynamic filters population
        if (!state.filtersInitialized) {
          populateFilters(result.filterOptions);
          state.filtersInitialized = true;
        }
      }
    } catch (error) {
      showToast('Connection Error', error.message || 'Could not fetch listings', 'error');
    } finally {
      showSpinner(false);
    }
  }

  // --- Render Metrics Cards & Top Categories ---
  function renderStats(stats) {
    if (statTotal) statTotal.textContent = stats.totalBusinesses.toLocaleString();
    if (statStates) statStates.textContent = stats.totalStates.toLocaleString();
    if (statCities) statCities.textContent = stats.totalCities.toLocaleString();
    if (statRating) statRating.textContent = stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0';

    if (topCategoriesContainer) {
      if (!stats.topCategories || stats.topCategories.length === 0) {
        topCategoriesContainer.innerHTML = '<span class="text-muted fs-8">No records available</span>';
        return;
      }
      topCategoriesContainer.innerHTML = stats.topCategories.map(cat => {
        return `
          <div class="category-pill-sm">
            <i class="fa-solid fa-tags text-accent-purple"></i> ${cat.name} <span>${cat.count}</span>
          </div>
        `;
      }).join('');
    }
  }

  // --- Helper: Render Rating Stars ---
  function getRatingStarsHtml(score) {
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    
    let starsHtml = '<span class="rating-stars">';
    for (let i = 0; i < fullStars; i++) {
      starsHtml += '<i class="fa-solid fa-star"></i>';
    }
    if (hasHalf) {
      starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
      starsHtml += '<i class="fa-regular fa-star"></i>';
    }
    starsHtml += '</span>';
    return starsHtml;
  }

  // --- Render Listings Table ---
  function renderTable(listings) {
    if (!listings || listings.length === 0) {
      listingsTableBody.innerHTML = `
        <tr>
          <td colspan="18" class="text-center py-5 text-muted">
            <div class="mb-2"><i class="fa-solid fa-folder-open fs-2 text-secondary"></i></div>
            No business listings found in database. Add a new listing or try clearing active filters!
          </td>
        </tr>
      `;
      return;
    }

    const cleanVal = (val) => {
      if (val === undefined || val === null) return '<span class="text-muted font-monospace fs-8">N/A</span>';
      const str = String(val).trim();
      return str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'n/a'
        ? '<span class="text-muted font-monospace fs-8">N/A</span>' 
        : str;
    };

    listingsTableBody.innerHTML = listings.map(item => {
      const reviewsCount = item.reviewsCount || 0;

      // Email link formatting
      const emailLink = (item.email && item.email.trim() && item.email.toLowerCase() !== 'not available' && item.email.toLowerCase() !== 'n/a') 
        ? `<a href="mailto:${item.email}" class="text-cyan text-decoration-none" title="${item.email}">${item.email}</a>` 
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      // Website link formatting
      const webLink = (item.website && item.website.trim() && item.website.toLowerCase() !== 'n/a') 
        ? `<a href="${item.website.startsWith('http') ? item.website : 'http://' + item.website}" target="_blank" class="text-cyan text-decoration-none" title="${item.website}"><i class="fa-solid fa-globe me-1"></i>Visit</a>` 
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      // Google Maps link formatting
      const mapsLink = (item.url && item.url.trim() && item.url.toLowerCase() !== 'n/a') 
        ? `<a href="${item.url}" target="_blank" class="text-cyan text-decoration-none" title="Google Maps link"><i class="fa-solid fa-map-location-dot me-1"></i>Maps</a>` 
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      const scoreHtml = `
        <div class="d-flex align-items-center">
          ${getRatingStarsHtml(item.totalScore)}
          <span class="rating-badge ms-1">${item.totalScore.toFixed(1)}</span>
        </div>
      `;

      // Category element
      const categoryBadge = (item.category && item.category.trim() && item.category.toLowerCase() !== 'n/a')
        ? `<span class="badge-category" title="${item.category}">${item.category}</span>`
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      // City and State elements
      const cityBadge = (item.city && item.city.trim() && item.city.toLowerCase() !== 'n/a')
        ? `<span class="badge-location">${item.city}</span>`
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      const stateBadge = (item.state && item.state.trim() && item.state.toLowerCase() !== 'n/a')
        ? `<span class="badge-location">${item.state}</span>`
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      return `
        <tr>
          <td class="fw-bold" style="min-width: 180px;">${cleanVal(item.title)}</td>
          <td style="min-width: 140px;">${cleanVal(item.brokerName)}</td>
          <td style="min-width: 120px;">${cleanVal(item.mobileNumber)}</td>
          <td>${emailLink}</td>
          <td style="min-width: 250px;">${cleanVal(item.address)}</td>
          <td style="min-width: 140px;">${scoreHtml}</td>
          <td class="font-monospace text-center fw-bold" style="font-size: 14px;">${reviewsCount}</td>
          <td style="min-width: 150px;">${cleanVal(item.street)}</td>
          <td>${cityBadge}</td>
          <td>${stateBadge}</td>
          <td class="text-center font-monospace">${cleanVal(item.countryCode)}</td>
          <td>${webLink}</td>
          <td style="min-width: 120px;">${cleanVal(item.phone)}</td>
          <td>${categoryBadge}</td>
          <td style="min-width: 140px;">${cleanVal(item.categoryName)}</td>
          <td>${mapsLink}</td>
          <td class="fs-8 text-muted" style="min-width: 100px;">${new Date(item.createdAt).toLocaleDateString()}</td>
          <td class="text-end">
            <div class="d-flex gap-1 justify-content-end">
              <button class="btn-action btn-action-view view-trigger-btn" data-id="${item._id}" title="View Complete Profile">
                <i class="fa-solid fa-eye"></i>
              </button>
              <a href="form.html?id=${item._id}" class="btn-action btn-action-edit" title="Edit Listing">
                <i class="fa-solid fa-pen-to-square"></i>
              </a>
              <button class="btn-action btn-action-delete delete-trigger-btn" data-id="${item._id}" data-title="${item.title}" title="Delete Listing">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach delete trigger actions
    document.querySelectorAll('.delete-trigger-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        
        state.selectedDeleteId = id;
        if (deleteListingName) deleteListingName.textContent = title;
        if (deleteModalObj) deleteModalObj.show();
      });
    });

    // Attach view details trigger actions
    document.querySelectorAll('.view-trigger-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        showListingDetails(id);
      });
    });
  }

  // --- Fetch and Display Single Business Details Profile ---
  async function showListingDetails(id) {
    showSpinner(true, 'Fetching detailed profile...');
    try {
      const result = await window.BusinessAPI.getBusiness(id);
      if (result.success) {
        const business = result.data;
        const reviewsCount = business.reviewsCount || 0;
        const scoreVal = business.totalScore !== undefined && business.totalScore !== null ? business.totalScore.toFixed(1) : '0.0';
        
        let detailsHtml = `
          <div class="row g-3">
            <div class="col-12 text-center pb-3 border-bottom border-secondary border-opacity-25">
              <h3 class="fw-bold text-brand-primary mb-2">${business.title}</h3>
              <span class="badge-category fs-7 mb-2 d-inline-block">${business.category || 'N/A'}</span>
              <div class="d-flex align-items-center justify-content-center mt-2">
                ${getRatingStarsHtml(business.totalScore)}
                <span class="rating-badge ms-2 fs-7">${scoreVal} / 5.0</span>
                <span class="text-secondary ms-3 fs-8 font-monospace">(${reviewsCount} verified reviews)</span>
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="modal-detail-row">
                <div class="modal-detail-label">Broker Name</div>
                <div class="modal-detail-value">${business.brokerName || 'N/A'}</div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Mobile Number</div>
                <div class="modal-detail-value">${business.mobileNumber || 'N/A'}</div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Phone Number</div>
                <div class="modal-detail-value">${business.phone || 'N/A'}</div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Email Address</div>
                <div class="modal-detail-value">
                  ${business.email && business.email.trim() && business.email !== 'Not Available' && business.email !== 'N/A' ? `<a href="mailto:${business.email}" class="text-cyan text-decoration-none">${business.email}</a>` : 'N/A'}
                </div>
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="modal-detail-row">
                <div class="modal-detail-label">Category Name</div>
                <div class="modal-detail-value">${business.categoryName || 'N/A'}</div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Website URL</div>
                <div class="modal-detail-value">
                  ${business.website && business.website.trim() && business.website !== 'N/A' ? `<a href="${business.website.startsWith('http') ? business.website : 'http://' + business.website}" target="_blank" class="text-cyan text-decoration-none"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i>${business.website}</a>` : 'N/A'}
                </div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Google Maps URL</div>
                <div class="modal-detail-value">
                  ${business.url && business.url.trim() && business.url !== 'N/A' ? `<a href="${business.url}" target="_blank" class="text-cyan text-decoration-none"><i class="fa-solid fa-map-location-dot me-1"></i>Open Google Maps</a>` : 'N/A'}
                </div>
              </div>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Date Created</div>
                <div class="modal-detail-value">${new Date(business.createdAt).toLocaleString()}</div>
              </div>
            </div>
            
            <div class="col-12 mt-3 pt-3 border-top border-secondary border-opacity-25">
              <h5 class="fw-bold text-accent-purple fs-7 mb-2 font-monospace text-uppercase" style="letter-spacing: 0.5px;">Address Coordinates</h5>
              <div class="modal-detail-row">
                <div class="modal-detail-label">Full Stated Address</div>
                <div class="modal-detail-value fw-medium">${business.address || 'N/A'}</div>
              </div>
              <div class="row g-2 mt-1">
                <div class="col-sm-4">
                  <div class="modal-detail-label">Street</div>
                  <div class="modal-detail-value fs-8">${business.street || 'N/A'}</div>
                </div>
                <div class="col-sm-3">
                  <div class="modal-detail-label">City</div>
                  <div class="modal-detail-value fs-8">${business.city || 'N/A'}</div>
                </div>
                <div class="col-sm-3">
                  <div class="modal-detail-label">State</div>
                  <div class="modal-detail-value fs-8">${business.state || 'N/A'}</div>
                </div>
                <div class="col-sm-2">
                  <div class="modal-detail-label">Country</div>
                  <div class="modal-detail-value fs-8">${business.countryCode || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        `;
        
        if (detailsModalBody) detailsModalBody.innerHTML = detailsHtml;
        if (editDetailsModalBtn) editDetailsModalBtn.setAttribute('href', `form.html?id=${business._id}`);
        if (detailsModalObj) detailsModalObj.show();
      }
    } catch (err) {
      showToast('Fetch Failed', err.message || 'Could not retrieve listing details', 'error');
    } finally {
      showSpinner(false);
    }
  }

  // --- Confirm Delete handler ---
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!state.selectedDeleteId) return;

      try {
        if (deleteModalObj) deleteModalObj.hide();
        showSpinner(true);
        const result = await window.BusinessAPI.deleteBusiness(state.selectedDeleteId);
        
        if (result.success) {
          showToast('Deleted Successful', 'The listing was permanently deleted from MongoDB.', 'success');
          // Reload everything
          state.page = 1;
          state.filtersInitialized = false; // Refresh select options
          loadData();
        }
      } catch (err) {
        showToast('Delete Failed', err.message || 'Could not delete entry', 'error');
      } finally {
        showSpinner(false);
        state.selectedDeleteId = null;
      }
    });
  }

  // --- Global Delete Button listener ---
  if (deleteAllDbBtn) {
    deleteAllDbBtn.addEventListener('click', () => {
      if (deleteAllDbModalObj) deleteAllDbModalObj.show();
    });
  }

  // --- Confirm Global Delete All handler ---
  if (confirmDeleteAllDbBtn) {
    confirmDeleteAllDbBtn.addEventListener('click', async () => {
      try {
        if (deleteAllDbModalObj) deleteAllDbModalObj.hide();
        showSpinner(true, 'Wiping full database...');
        const result = await window.BusinessAPI.deleteAllBusinesses();
        
        if (result.success) {
          showToast('Database Wiped', `All ${result.deletedCount || 0} business listing(s) have been deleted.`, 'success');
          // Reset state
          state.page = 1;
          state.search = '';
          state.state = '';
          state.city = '';
          state.category = '';
          state.minScore = '';
          state.sortBy = 'createdAt';
          state.sortOrder = 'desc';
          state.filtersInitialized = false;

          if (searchInput) searchInput.value = '';
          if (filterState) filterState.value = '';
          if (filterCity) filterCity.value = '';
          if (filterCategory) filterCategory.value = '';
          if (filterScore) filterScore.value = '';
          if (pageSizeSelect) pageSizeSelect.value = '25';

          await loadData();
        }
      } catch (err) {
        showToast('Operation Failed', err.message || 'Could not delete dataset', 'error');
      } finally {
        showSpinner(false);
      }
    });
  }

  // --- Populate Dropdown Filter Options ---
  function populateFilters(filterOptions) {
    if (!filterOptions) return;

    const activeState = state.state;
    const activeCity = state.city;
    const activeCategory = state.category;

    // States
    if (filterState) {
      filterState.innerHTML = '<option value="">All States</option>' + 
        filterOptions.states.map(s => `<option value="${s}" ${s === activeState ? 'selected' : ''}>${s}</option>`).join('');
    }

    // Cities
    if (filterCity) {
      filterCity.innerHTML = '<option value="">All Cities</option>' + 
        filterOptions.cities.map(c => `<option value="${c}" ${c === activeCity ? 'selected' : ''}>${c}</option>`).join('');
    }

    // Categories
    if (filterCategory) {
      filterCategory.innerHTML = '<option value="">All Categories</option>' + 
        filterOptions.categories.map(cat => `<option value="${cat}" ${cat === activeCategory ? 'selected' : ''}>${cat}</option>`).join('');
    }
  }

  // --- Update Pagination Controls ---
  function updatePagination(pagination) {
    state.page = pagination.page;
    state.totalPages = pagination.totalPages;

    const startIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const endIdx = Math.min(pagination.page * pagination.limit, pagination.total);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${pagination.total} entries`;
    }

    if (prevPageBtn) prevPageBtn.disabled = pagination.page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = pagination.page >= pagination.totalPages;
  }

  // --- CSV and Excel EXPORTS ---

  async function fetchAllFilteredData() {
    showSpinner(true, 'Fetching full dataset for export...');
    try {
      // Fetch data without pagination limits (use limit=100000)
      const result = await window.BusinessAPI.getBusinesses({
        search: state.search,
        state: state.state,
        city: state.city,
        category: state.category,
        minScore: state.minScore,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        page: 1,
        limit: 100000
      });
      if (result.success) {
        return result.data;
      }
      throw new Error('API reported failure');
    } catch (err) {
      showToast('Export Failed', 'Unable to fetch the complete data for export', 'error');
      return null;
    } finally {
      showSpinner(false);
    }
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', async () => {
      const data = await fetchAllFilteredData();
      if (!data || data.length === 0) {
        showToast('No Data', 'There is no data matching the current criteria to export!', 'error');
        return;
      }

      const headers = [
        'Business Name', 'Broker Name', 'Mobile Number', 'Email', 'Address',
        'Total Score', 'Review Count', 'Street', 'City', 'State', 'Country Code',
        'Website', 'Phone Number', 'Category', 'Category Name', 'Google Maps URL', 'Created Date'
      ];
      
      const rows = data.map(item => [
        item.title, item.brokerName, item.mobileNumber, item.email, item.address,
        item.totalScore, item.reviewsCount || 0, 
        item.street, item.city, item.state, item.countryCode,
        item.website, item.phone, item.category, item.categoryName, item.url, 
        new Date(item.createdAt).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','), 
        ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `business_listings_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Export Finished', `Successfully exported ${data.length} records as CSV.`, 'success');
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', async () => {
      const data = await fetchAllFilteredData();
      if (!data || data.length === 0) {
        showToast('No Data', 'There is no data matching the current criteria to export!', 'error');
        return;
      }

      let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Business Database</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <meta charset="utf-8">
        </head>
        <body>
          <table border="1">
            <thead>
              <tr style="background-color: #1e3a8a; color: #ffffff; font-weight: bold;">
                <th>Business Name</th>
                <th>Broker Name</th>
                <th>Mobile Number</th>
                <th>Email</th>
                <th>Address</th>
                <th>Total Score</th>
                <th>Review Count</th>
                <th>Street</th>
                <th>City</th>
                <th>State</th>
                <th>Country Code</th>
                <th>Website</th>
                <th>Phone Number</th>
                <th>Category</th>
                <th>Category Name</th>
                <th>Google Maps URL</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>`;

      data.forEach(item => {
        const reviewsCount = item.reviewsCount || 0;
        tableHtml += `<tr>
          <td>${item.title || ''}</td>
          <td>${item.brokerName || ''}</td>
          <td>${item.mobileNumber || ''}</td>
          <td>${item.email || ''}</td>
          <td>${item.address || ''}</td>
          <td>${item.totalScore || 0}</td>
          <td>${reviewsCount}</td>
          <td>${item.street || ''}</td>
          <td>${item.city || ''}</td>
          <td>${item.state || ''}</td>
          <td>${item.countryCode || ''}</td>
          <td>${item.website || ''}</td>
          <td>${item.phone || ''}</td>
          <td>${item.category || ''}</td>
          <td>${item.categoryName || ''}</td>
          <td>${item.url || ''}</td>
          <td>${new Date(item.createdAt).toLocaleDateString()}</td>
        </tr>`;
      });
      tableHtml += '</tbody></table></body></html>';
      
      const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `business_listings_${Date.now()}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Export Finished', `Successfully exported ${data.length} records as Excel XLS.`, 'success');
    });
  }

  // --- Event Listeners: Filtering, Search, Pagination ---

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        loadData();
      }, 300);
    });
  }

  if (filterState) {
    filterState.addEventListener('change', (e) => {
      state.state = e.target.value;
      state.page = 1;
      loadData();
    });
  }

  if (filterCity) {
    filterCity.addEventListener('change', (e) => {
      state.city = e.target.value;
      state.page = 1;
      loadData();
    });
  }

  if (filterCategory) {
    filterCategory.addEventListener('change', (e) => {
      state.category = e.target.value;
      state.page = 1;
      loadData();
    });
  }

  if (filterScore) {
    filterScore.addEventListener('change', (e) => {
      state.minScore = e.target.value;
      state.page = 1;
      loadData();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      state.limit = parseInt(e.target.value) || 25;
      state.page = 1;
      loadData();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterState) filterState.value = '';
      if (filterCity) filterCity.value = '';
      if (filterCategory) filterCategory.value = '';
      if (filterScore) filterScore.value = '';
      if (pageSizeSelect) pageSizeSelect.value = '25';

      state.search = '';
      state.state = '';
      state.city = '';
      state.category = '';
      state.minScore = '';
      state.sortBy = 'createdAt';
      state.sortOrder = 'desc';
      state.page = 1;
      state.limit = 25;
      
      // Reset headers sort icons
      document.querySelectorAll('.table-premium th.sortable i').forEach(icon => {
        icon.className = 'fa-solid fa-sort';
      });

      loadData();
    });
  }

  // Sorting columns
  document.querySelectorAll('.table-premium th.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort');
      
      if (state.sortBy === field) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = field;
        state.sortOrder = 'desc';
      }

      // Update header icons
      document.querySelectorAll('.table-premium th.sortable').forEach(h => {
        const icon = h.querySelector('i');
        if (h === header) {
          icon.className = state.sortOrder === 'asc' 
            ? 'fa-solid fa-sort-up text-cyan' 
            : 'fa-solid fa-sort-down text-cyan';
        } else {
          icon.className = 'fa-solid fa-sort';
        }
      });

      state.page = 1;
      loadData();
    });
  });

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        loadData();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (state.page < state.totalPages) {
        state.page++;
        loadData();
      }
    });
  }

  // --- Helper: Loading spinner visibility ---
  function showSpinner(show, msg = 'Loading database...') {
    if (!tableSpinner) return;
    const msgEl = tableSpinner.querySelector('span');
    if (msgEl) msgEl.textContent = msg;

    if (show) {
      tableSpinner.classList.add('show');
    } else {
      tableSpinner.classList.remove('show');
    }
  }

  // --- Helper: Premium Toast Notifications ---
  function showToast(title, desc, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const isSuccess = type === 'success';
    const iconClass = isSuccess ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
    const typeClass = isSuccess ? 'toast-custom-success' : 'toast-custom-error';

    const toastHtml = `
      <div id="${toastId}" class="toast-custom ${typeClass}">
        <div class="toast-custom-icon">
          <i class="${iconClass}"></i>
        </div>
        <div class="toast-custom-content">
          <div class="toast-custom-title">${title}</div>
          <div class="toast-custom-desc">${desc}</div>
        </div>
        <button class="toast-custom-close" onclick="this.parentElement.remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    setTimeout(() => {
      const toastEl = document.getElementById(toastId);
      if (toastEl) {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(10px)';
        setTimeout(() => toastEl.remove(), 300);
      }
    }, 4500);
  }
});
