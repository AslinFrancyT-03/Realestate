/* ============================================================
   RealEstatePro — API Client
   ============================================================ */

const BusinessAPI = (() => {
  const BASE_URL = 'http://localhost:5000/api/business';

  async function request(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${url}`, err);
      throw err;
    }
  }

  /**
   * GET /api/business?page=&limit=&state=&city=&category=&minScore=&search=&sortBy=&sortOrder=
   */
  function getBusinesses(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const qs = query.toString();
    return request(`${BASE_URL}${qs ? '?' + qs : ''}`);
  }

  /**
   * GET /api/business/:id
   */
  function getBusiness(id) {
    return request(`${BASE_URL}/${id}`);
  }

  /**
   * POST /api/business
   */
  function createBusiness(data) {
    return request(BASE_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT /api/business/:id
   */
  function updateBusiness(id, data) {
    return request(`${BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE /api/business/:id
   */
  function deleteBusiness(id) {
    return request(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * DELETE /api/business/delete-all
   */
  function deleteAllBusinesses() {
    return request(`${BASE_URL}/delete-all`, {
      method: 'DELETE',
    });
  }

  /**
   * POST /api/business/upload-csv  (multipart/form-data)
   */
  function uploadCSV(file) {
    const formData = new FormData();
    formData.append('csvFile', file); // Mapped to 'csvFile' to match backend middleware

    return fetch(`${BASE_URL}/upload-csv`, {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    });
  }

  return {
    getBusinesses,
    getBusiness,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    deleteAllBusinesses,
    uploadCSV,
  };
})();

// Bind to window
window.BusinessAPI = BusinessAPI;
