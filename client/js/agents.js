/**
 * Business Listing Management - Agent Details logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Configuration ---
  const state = {
    searchName: '',
    searchCompany: '',
    searchState: '',
    page: 1,
    limit: 10,
    totalPages: 1
  };

  // --- DOM References ---
  const searchNameInput = document.getElementById('searchNameInput');
  const searchCompanyInput = document.getElementById('searchCompanyInput');
  const searchStateInput = document.getElementById('searchStateInput');
  const resetAgentsFiltersBtn = document.getElementById('resetAgentsFiltersBtn');
  
  const agentsTableBody = document.getElementById('agentsTableBody');
  const tableSpinner = document.getElementById('tableSpinner');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const toastContainer = document.getElementById('toastContainer');

  // --- Initial Load ---
  loadData();

  // --- Fetch and Render Core ---
  async function loadData() {
    showSpinner(true);
    try {
      const result = await window.BusinessAPI.getAgents({
        searchName: state.searchName,
        searchCompany: state.searchCompany,
        searchState: state.searchState,
        page: state.page,
        limit: state.limit
      });

      if (result.success) {
        renderTable(result.data);
        updatePagination(result.pagination);
      } else {
        showToast('Error', result.message || 'Could not fetch agent details', 'error');
      }
    } catch (error) {
      showToast('Connection Error', error.message || 'Could not fetch agent details', 'error');
    } finally {
      showSpinner(false);
    }
  }

  // --- Render Table rows ---
  function renderTable(agents) {
    if (!agentsTableBody) return;

    if (!agents || agents.length === 0) {
      agentsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5" style="color:var(--text-muted);">
            <div class="mb-2" style="font-size: 2rem;"><i class="fa-solid fa-user-slash"></i></div>
            <strong>No agent records found</strong>
          </td>
        </tr>
      `;
      return;
    }

    agentsTableBody.innerHTML = agents.map(agent => {
      const emailLink = agent.email !== 'N/A' 
        ? `<a href="mailto:${escapeHtml(agent.email)}" class="email-link">${escapeHtml(agent.email)}</a>`
        : '<span class="badge-n-a">N/A</span>';

      const websiteLink = agent.website !== 'N/A'
        ? `<a href="${ensureHttp(agent.website)}" target="_blank" rel="noopener noreferrer" class="website-link">${escapeHtml(agent.website)}</a>`
        : '<span class="badge-n-a">N/A</span>';

      const companyDisplay = agent.companyName !== 'N/A'
        ? `<strong>${escapeHtml(agent.companyName)}</strong>`
        : '<span class="badge-n-a">N/A</span>';

      return `
        <tr>
          <td><strong style="color:var(--text-primary);">${escapeHtml(agent.name)}</strong></td>
          <td>${companyDisplay}</td>
          <td>${websiteLink}</td>
          <td>${escapeHtml(agent.address)}</td>
          <td>${emailLink}</td>
          <td><span class="badge-location">${escapeHtml(agent.state)}</span></td>
          <td><span class="badge-category">${escapeHtml(agent.country)}</span></td>
        </tr>
      `;
    }).join('');
  }

  // --- Update Pagination UI ---
  function updatePagination(pagination) {
    state.totalPages = pagination.totalPages || 1;
    state.page = pagination.page || 1;

    const start = (state.page - 1) * state.limit + 1;
    const end = Math.min(state.page * state.limit, pagination.total);

    if (paginationInfo) {
      if (pagination.total === 0) {
        paginationInfo.textContent = 'Showing 0 of 0';
      } else {
        paginationInfo.textContent = `Showing ${start} - ${end} of ${pagination.total}`;
      }
    }

    if (prevPageBtn) prevPageBtn.disabled = state.page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = state.page >= state.totalPages;
  }

  // --- Input handlers (with debounce) ---
  let debounceTimeout;
  function handleFilterChange() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.searchName = searchNameInput.value.trim();
      state.searchCompany = searchCompanyInput.value.trim();
      state.searchState = searchStateInput.value.trim();
      state.page = 1; // reset page on filter change
      loadData();
    }, 300);
  }

  if (searchNameInput) searchNameInput.addEventListener('input', handleFilterChange);
  if (searchCompanyInput) searchCompanyInput.addEventListener('input', handleFilterChange);
  if (searchStateInput) searchStateInput.addEventListener('input', handleFilterChange);

  // --- Reset Filter Action ---
  if (resetAgentsFiltersBtn) {
    resetAgentsFiltersBtn.addEventListener('click', () => {
      if (searchNameInput) searchNameInput.value = '';
      if (searchCompanyInput) searchCompanyInput.value = '';
      if (searchStateInput) searchStateInput.value = '';
      state.searchName = '';
      state.searchCompany = '';
      state.searchState = '';
      state.page = 1;
      loadData();
    });
  }

  // --- Pagination Action listeners ---
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

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      state.limit = parseInt(pageSizeSelect.value) || 10;
      state.page = 1;
      loadData();
    });
  }

  // --- Helpers ---
  function showSpinner(show) {
    if (tableSpinner) {
      if (show) tableSpinner.classList.add('show');
      else tableSpinner.classList.remove('show');
    }
  }

  function escapeHtml(str) {
    if (!str) return 'N/A';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureHttp(url) {
    if (!url || url.toLowerCase() === 'n/a') return '#';
    if (!/^https?:\/\//i.test(url)) {
      return `http://${url}`;
    }
    return url;
  }

  function showToast(title, message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
      <div class="toast-custom-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="toast-custom-content">
        <div class="toast-custom-title">${title}</div>
        <div class="toast-custom-message">${message}</div>
      </div>
    `;

    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOutCustom 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
