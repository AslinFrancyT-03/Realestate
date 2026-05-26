/**
 * Business Listing Management - Dashboard App logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Configuration ---
  const state = {
    search: '',
    state: '',
    city: '',
    category: '',
    minScore: '',
    sortBy: '',
    sortOrder: 'desc',
    page: 1,
    limit: 10,
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
  
  const statTotal = document.getElementById('statTotal');
  const statStates = document.getElementById('statStates');
  const statCities = document.getElementById('statCities');
  const statRating = document.getElementById('statRating');
  const topRatedContainer = document.getElementById('topRatedContainer');

  // CSV elements
  const csvUploadForm = document.getElementById('csvUploadForm');
  const csvFileInput = document.getElementById('csvFileInput');
  const uploadDropzone = document.getElementById('uploadDropzone');
  const selectFileBtn = document.getElementById('selectFileBtn');
  const selectedFileName = document.getElementById('selectedFileName');
  const csvSubmitBtn = document.getElementById('csvSubmitBtn');

  // Delete modal
  const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');
  const deleteListingName = document.getElementById('deleteListingName');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
  let deleteModalObj = null;
  if (deleteConfirmModalEl) {
    deleteModalObj = new bootstrap.Modal(deleteConfirmModalEl);
  }

  // Delete All Modal
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  const deleteAllModalEl = document.getElementById('deleteAllModal');
  const confirmDeleteAllBtn = document.getElementById('confirmDeleteAllBtn');

  let deleteAllModalObj = null;
  if (deleteAllModalEl) {
    deleteAllModalObj = new bootstrap.Modal(deleteAllModalEl);
  }

  // Duplicates Removed & CSV Upload Summary elements
  const statDuplicates = document.getElementById('statDuplicates');
  const summaryTotalRows = document.getElementById('summaryTotalRows');
  const summaryInserted = document.getElementById('summaryInserted');
  const summarySkipped = document.getElementById('summarySkipped');
  const summaryUpdated = document.getElementById('summaryUpdated');

  const uploadSummaryModalEl = document.getElementById('uploadSummaryModal');
  let uploadSummaryModalObj = null;
  if (uploadSummaryModalEl) {
    uploadSummaryModalObj = new bootstrap.Modal(uploadSummaryModalEl);
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
        renderTopRated(result.stats.topRated);
        renderTable(result.data);
        updatePagination(result.pagination);
        
        // Dynamic filters population (only fill once or refresh on reset)
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

  // --- Render Metrics Cards ---
  function renderStats(stats) {
    if (statTotal) statTotal.textContent = stats.totalBusinesses.toLocaleString();
    if (statStates) statStates.textContent = stats.totalStates.toLocaleString();
    if (statCities) statCities.textContent = stats.totalCities.toLocaleString();
    if (statRating) statRating.textContent = stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0';
    if (statDuplicates) statDuplicates.textContent = (stats.duplicatesRemoved || 0).toLocaleString();
  }

  // --- Render Top Rated Widget ---
  function renderTopRated(topRated) {
    if (!topRatedContainer) return;
    
    if (!topRated || topRated.length === 0) {
      topRatedContainer.innerHTML = '<p class="text-muted fs-8 text-center py-4">No rated listings</p>';
      return;
    }

    topRatedContainer.innerHTML = topRated.map(item => {
      const scoreVal = item.totalScore !== undefined && item.totalScore !== null ? item.totalScore.toFixed(1) : '0.0';
      const reviewsVal = item.reviewsCount || 0;
      return `
        <div class="top-rated-item">
          <div class="top-rated-content">
            <h6 class="top-rated-title fw-bold fs-7 mb-0" title="${item.title}">${item.title}</h6>
            <small class="text-secondary fs-8"><i class="fa-solid fa-city me-1"></i>${item.city || 'N/A'}</small>
          </div>
          <div class="d-flex flex-column align-items-end">
            <span class="rating-badge"><i class="fa-solid fa-star me-1 text-warning"></i>${scoreVal}</span>
            <small class="text-muted fs-8" style="font-size: 0.7rem; font-weight: 600;">${reviewsVal} reviews</small>
          </div>
        </div>
      `;
    }).join('');
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
            No business listings found. Add a new listing or upload a CSV file!
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
        ? `<a href="${item.website.startsWith('http') ? item.website : 'http://' + item.website}" target="_blank" class="btn-action btn-action-edit" title="${item.website}"><i class="fa-solid fa-globe"></i></a>` 
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      // Google Maps link formatting
      const mapsLink = (item.url && item.url.trim() && item.url.toLowerCase() !== 'n/a') 
        ? `<a href="${item.url}" target="_blank" class="btn-action btn-action-edit" title="Google Maps link"><i class="fa-solid fa-map-location-dot"></i></a>` 
        : '<span class="text-muted font-monospace fs-8">N/A</span>';

      const scoreHtml = `
        <div class="d-flex align-items-center">
          ${getRatingStarsHtml(item.totalScore)}
          <span class="rating-badge ms-1">${item.totalScore.toFixed(1)}</span>
        </div>
      `;

      // Category badge
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
          <td class="text-center">${webLink}</td>
          <td style="min-width: 120px;">${cleanVal(item.phone)}</td>
          <td>${categoryBadge}</td>
          <td style="min-width: 140px;">${cleanVal(item.categoryName)}</td>
          <td class="text-center">${mapsLink}</td>
          <td class="fs-8 text-muted" style="min-width: 100px;">${new Date(item.createdAt).toLocaleDateString()}</td>
          <td class="text-end">
            <div class="d-flex gap-1 justify-content-end">
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
          showToast('Deleted Successful', 'The listing was permanently deleted.', 'success');
          // Reload everything
          state.page = 1;
          state.filtersInitialized = false; // Refresh select options to account for removals
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
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', () => {
      if (deleteAllModalObj) deleteAllModalObj.show();
    });
  }

  // --- Confirm Global Delete All handler ---
  if (confirmDeleteAllBtn) {
    confirmDeleteAllBtn.addEventListener('click', async () => {
      try {
        if (deleteAllModalObj) deleteAllModalObj.hide();
        showSpinner(true, 'Wiping full database...');
        const result = await window.BusinessAPI.deleteAllBusinesses();
        
        if (result.success) {
          showToast('Database Wiped', `All ${result.deletedCount || 0} business listing(s) have been deleted.`, 'success');
          // Reset filters and data
          state.page = 1;
          state.search = '';
          state.state = '';
          state.city = '';
          state.category = '';
          state.minScore = '';
          state.sortBy = '';
          state.sortOrder = 'desc';
          state.filtersInitialized = false;

          if (searchInput) searchInput.value = '';
          if (filterState) filterState.value = '';
          if (filterCity) filterCity.value = '';
          if (filterCategory) filterCategory.value = '';
          if (filterScore) filterScore.value = '';

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

    // Preserve selections
    const activeState = state.state;
    const activeCity = state.city;
    const activeCategory = state.category;

    // Populate States
    if (filterState) {
      filterState.innerHTML = '<option value="">All States</option>' + 
        filterOptions.states.map(s => `<option value="${s}" ${s === activeState ? 'selected' : ''}>${s}</option>`).join('');
    }

    // Populate Cities
    if (filterCity) {
      filterCity.innerHTML = '<option value="">All Cities</option>' + 
        filterOptions.cities.map(c => `<option value="${c}" ${c === activeCity ? 'selected' : ''}>${c}</option>`).join('');
    }

    // Populate Categories
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
      paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${pagination.total} listings`;
    }

    if (prevPageBtn) prevPageBtn.disabled = pagination.page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = pagination.page >= pagination.totalPages;
  }

  // --- Event Listeners: Filtering, Search, Pagination ---

  // Debounced Search Functionality
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

  // Filter Changes
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

  // Reset Filters Button
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterState) filterState.value = '';
      if (filterCity) filterCity.value = '';
      if (filterCategory) filterCategory.value = '';
      if (filterScore) filterScore.value = '';

      state.search = '';
      state.state = '';
      state.city = '';
      state.category = '';
      state.minScore = '';
      state.sortBy = '';
      state.sortOrder = 'desc';
      state.page = 1;
      
      // Reset headers sort icons
      document.querySelectorAll('.table-premium th i').forEach(icon => {
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
        // Toggle sort order
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = field;
        state.sortOrder = 'desc'; // default high to low
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

  // Pagination buttons click
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

  // --- Drag and Drop CSV Section ---

  if (selectFileBtn && csvFileInput) {
    selectFileBtn.addEventListener('click', () => csvFileInput.click());
  }

  if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
      handleSelectedFile(e.target.files[0]);
    });
  }

  if (uploadDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.remove('dragover');
      }, false);
    });

    uploadDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      handleSelectedFile(file);
    });
  }

  function handleSelectedFile(file) {
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('Invalid File Type', 'Please drop a standard .CSV spreadsheet file!', 'error');
      clearFileSelection();
      return;
    }

    if (selectedFileName) {
      selectedFileName.textContent = `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      selectedFileName.classList.remove('d-none');
    }

    if (csvSubmitBtn) csvSubmitBtn.disabled = false;
  }

  function clearFileSelection() {
    if (csvFileInput) csvFileInput.value = '';
    if (selectedFileName) {
      selectedFileName.textContent = '';
      selectedFileName.classList.add('d-none');
    }
    if (csvSubmitBtn) csvSubmitBtn.disabled = true;
  }

  // CSV Submit Form import Action
  if (csvUploadForm) {
    csvUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const file = csvFileInput.files[0];
      if (!file) {
        showToast('No File Selected', 'Please select or drop a CSV file first.', 'error');
        return;
      }

      showSpinner(true, 'Parsing & importing CSV data...');
      try {
        const result = await window.BusinessAPI.uploadCSV(file);
        if (result.success) {
          showToast(
            'Import Successful', 
            `CSV has been successfully parsed and verified!`, 
            'success'
          );
          clearFileSelection();
          
          // Populate the summary report modal
          if (summaryTotalRows) summaryTotalRows.textContent = result.stats.totalRows.toLocaleString();
          if (summaryInserted) summaryInserted.textContent = result.stats.imported.toLocaleString();
          if (summarySkipped) summarySkipped.textContent = result.stats.duplicates.toLocaleString();
          if (summaryUpdated) summaryUpdated.textContent = (result.stats.updated || 0).toLocaleString();
          
          // Launch the summary modal
          if (uploadSummaryModalObj) {
            uploadSummaryModalObj.show();
          }
          
          // Refresh table and stats
          state.page = 1;
          state.filtersInitialized = false; // refresh select box items
          await loadData();
        }
      } catch (err) {
        showToast('Import Failed', err.message || 'Failed to process CSV file', 'error');
      } finally {
        showSpinner(false);
      }
    });
  }

  // --- Helper: Loading spinner visibility ---
  function showSpinner(show, msg = 'Loading listings...') {
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

    // Auto fadeout after 4 seconds
    setTimeout(() => {
      const toastEl = document.getElementById(toastId);
      if (toastEl) {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(10px)';
        setTimeout(() => toastEl.remove(), 300);
      }
    }, 4500);
  }
  
  // Bind toast global helper to window in case other scripts need alerts
  window.showToast = showToast;
});
