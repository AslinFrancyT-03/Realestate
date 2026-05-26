/* ============================================================
   RealEstatePro — Form Logic (form.js)
   ============================================================ */

(function () {
  'use strict';

  // ─── DOM ─────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  const els = {
    form: $('#listingForm'),
    pageTitle: $('#formPageTitle'),
    clearBtn: $('#clearFormBtn'),
    toastContainer: $('#toastContainer'),
    // Fields
    name: $('#name'),
    broker: $('#broker'),
    mobile: $('#mobile'),
    phone: $('#phone'),
    email: $('#email'),
    website: $('#website'),
    totalScore: $('#totalScore'),
    reviewsCount: $('#reviewsCount'),
    category: $('#category'),
    categoryName: $('#categoryName'),
    address: $('#address'),
    street: $('#street'),
    city: $('#city'),
    state: $('#state'),
    country: $('#country'),
    googleMaps: $('#googleMaps'),
  };

  const fieldNames = [
    'name', 'broker', 'mobile', 'phone', 'email', 'website',
    'totalScore', 'reviewsCount', 'category', 'categoryName',
    'address', 'street', 'city', 'state', 'country', 'googleMaps',
  ];

  let editId = null;

  // ─── Utility ─────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Toast ───────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const iconMap = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-xmark',
      info: 'fa-solid fa-circle-info',
    };

    const toast = document.createElement('div');
    toast.className = `toast-custom toast-${type}`;
    toast.innerHTML = `
      <i class="${iconMap[type] || iconMap.info} toast-icon"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─── Load for Edit ───────────────────────────────────────
  async function loadForEdit(id) {
    try {
      const res = await BusinessAPI.getBusiness(id);
      const data = res.data || res;

      editId = data._id;
      els.pageTitle.innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-accent-blue"></i>Edit Listing';

      fieldNames.forEach((field) => {
        if (els[field] && data[field] !== undefined && data[field] !== null) {
          els[field].value = data[field];
        }
      });
    } catch (err) {
      showToast('Failed to load listing: ' + err.message, 'error');
    }
  }

  // ─── Form Validation ────────────────────────────────────
  function validateForm() {
    let valid = true;

    // Required: name
    if (!els.name.value.trim()) {
      els.name.classList.add('is-invalid');
      valid = false;
    } else {
      els.name.classList.remove('is-invalid');
    }

    // Optional: email format
    if (els.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(els.email.value.trim())) {
      els.email.classList.add('is-invalid');
      valid = false;
    } else {
      els.email.classList.remove('is-invalid');
    }

    // Optional: totalScore range
    const score = parseFloat(els.totalScore.value);
    if (els.totalScore.value.trim() && (isNaN(score) || score < 0 || score > 5)) {
      els.totalScore.classList.add('is-invalid');
      valid = false;
    } else {
      els.totalScore.classList.remove('is-invalid');
    }

    return valid;
  }

  // ─── Collect Form Data ──────────────────────────────────
  function collectFormData() {
    const data = {};
    fieldNames.forEach((field) => {
      if (els[field]) {
        let val = els[field].value.trim();
        if (field === 'totalScore' && val) val = parseFloat(val);
        if (field === 'reviewsCount' && val) val = parseInt(val, 10);
        if (val !== '' && val !== null && !isNaN(val) || typeof val === 'string' && val !== '') {
          data[field] = val;
        }
      }
    });
    return data;
  }

  // ─── Submit Handler ──────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    const data = collectFormData();
    const submitBtn = els.form.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

      if (editId) {
        await BusinessAPI.updateBusiness(editId, data);
        showToast('Listing updated successfully!', 'success');
      } else {
        await BusinessAPI.createBusiness(data);
        showToast('Listing created successfully!', 'success');
        clearForm();
      }
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Listing';
    }
  }

  // ─── Clear Form ──────────────────────────────────────────
  function clearForm() {
    els.form.reset();
    fieldNames.forEach((field) => {
      if (els[field]) els[field].classList.remove('is-invalid');
    });
  }

  // ─── Event Binding ───────────────────────────────────────
  function bindEvents() {
    els.form.addEventListener('submit', handleSubmit);

    if (els.clearBtn) {
      els.clearBtn.addEventListener('click', () => {
        clearForm();
        showToast('Form cleared', 'info');
      });
    }

    // Remove validation styling on input
    fieldNames.forEach((field) => {
      if (els[field]) {
        els[field].addEventListener('input', () => {
          els[field].classList.remove('is-invalid');
        });
      }
    });
  }

  // ─── Init ────────────────────────────────────────────────
  function init() {
    bindEvents();

    // Check for edit mode
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      loadForEdit(id);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
