/**
 * Invoice Autocomplete Logic
 * Handles Party Search, Quick Add Drawer, and Product Search
 */

let partyDebounce = null;
let currentPartyIndex = -1;

// --- Walk-in Toggle ---
function toggleCustomerType() {
  const isWalkin = document.querySelector('input[name="customer_type"]:checked').value === 'walkin';
  document.getElementById('field-saved-party').style.display = isWalkin ? 'none' : 'flex';
  document.getElementById('field-walkin-party').style.display = isWalkin ? 'flex' : 'none';

  if (isWalkin) {
    document.getElementById('inv-party-id').value = '';
    document.getElementById('inv-party-search').value = '';
  } else {
    document.getElementById('inv-walkin-name').value = '';
    document.getElementById('inv-walkin-phone').value = '';
  }
}

// --- Party Autocomplete ---
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('inv-party-search');
  if (searchInput) {
    searchInput.addEventListener('input', handlePartyInput);
    searchInput.addEventListener('keydown', handlePartyKeydown);
    // Hide list when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        document.getElementById('party-autocomplete-list').style.display = 'none';
      }
    });
  }
});

function handlePartyInput(e) {
  const q = e.target.value.trim();
  const list = document.getElementById('party-autocomplete-list');
  document.getElementById('inv-party-id').value = ''; // Reset ID on edit

  if (q.length < 3) {
    list.style.display = 'none';
    return;
  }

  if (partyDebounce) clearTimeout(partyDebounce);
  partyDebounce = setTimeout(() => fetchPartySearch(q), 300);
}

async function fetchPartySearch(q) {
  const list = document.getElementById('party-autocomplete-list');
  try {
    const res = await fetch(`${API}/parties_search.php?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();

    list.innerHTML = '';
    currentPartyIndex = -1;

    if (data.length === 0) {
      list.innerHTML = `<li style="color:#888;">No matches found</li>`;
    } else {
      data.forEach((p, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${p.name}</strong> ${p.mobile ? '- ' + p.mobile : ''}`;
        li.dataset.id = p.id;
        li.dataset.name = p.name;
        li.dataset.state = p.state || 'Rajasthan';
        li.onclick = () => selectParty(p.id, p.name, p.state || 'Rajasthan');
        li.addEventListener('mouseover', () => {
          currentPartyIndex = idx;
          highlightPartyItem();
        });
        list.appendChild(li);
      });
    }

    // Add "Add New Party" option
    const addLi = document.createElement('li');
    addLi.className = 'action-row';
    addLi.textContent = `➕ Add '${q}' as New Party`;
    addLi.onclick = () => openPartyDrawer(q);
    list.appendChild(addLi);

    list.style.display = 'block';
  } catch (e) {
    console.error(e);
  }
}

function handlePartyKeydown(e) {
  const list = document.getElementById('party-autocomplete-list');
  if (list.style.display !== 'block') return;
  const items = list.querySelectorAll('li:not(.action-row)');

  if (e.key === 'ArrowDown') {
    currentPartyIndex = Math.min(currentPartyIndex + 1, items.length - 1);
    highlightPartyItem(items);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    currentPartyIndex = Math.max(currentPartyIndex - 1, 0);
    highlightPartyItem(items);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (currentPartyIndex >= 0 && items[currentPartyIndex]) {
      items[currentPartyIndex].click();
    } else {
      // If nothing selected but enter pressed, open drawer
      const addLi = list.querySelector('.action-row');
      if (addLi) addLi.click();
    }
    e.preventDefault();
  }
}

function highlightPartyItem(items) {
  if (!items) items = document.getElementById('party-autocomplete-list').querySelectorAll('li:not(.action-row)');
  items.forEach(li => li.classList.remove('active'));
  if (currentPartyIndex >= 0 && items[currentPartyIndex]) {
    items[currentPartyIndex].classList.add('active');
  }
}

function selectParty(id, name, state) {
  document.getElementById('inv-party-id').value = id;
  document.getElementById('inv-party-search').value = name;
  document.getElementById('party-autocomplete-list').style.display = 'none';

  if (typeof updateTaxType === 'function') {
    updateTaxType(state || 'Rajasthan');
  }
}

// --- Drawer ---
function openPartyDrawer(prefillName = '') {
  document.getElementById('party-autocomplete-list').style.display = 'none';
  document.getElementById('drawer-party-name').value = prefillName;
  document.getElementById('drawer-party-phone').value = '';
  document.getElementById('drawer-party-email').value = '';
  document.getElementById('drawer-party-gstin').value = '';
  document.getElementById('drawer-party-city').value = '';
  document.getElementById('drawer-party-state').value = 'Rajasthan';
  document.getElementById('drawer-party-pincode').value = '';
  document.getElementById('drawer-party-address').value = '';
  document.getElementById('drawer-party-limit').value = '';

  document.getElementById('drawer-add-party').classList.add('open');
  document.getElementById('overlay-drawer').classList.add('open');
}

function closePartyDrawer() {
  document.getElementById('drawer-add-party').classList.remove('open');
  document.getElementById('overlay-drawer').classList.remove('open');
}

async function saveQuickAddParty() {
  const name = document.getElementById('drawer-party-name').value.trim();
  const phone = document.getElementById('drawer-party-phone').value.trim();
  const email = document.getElementById('drawer-party-email').value.trim();
  const gstin = document.getElementById('drawer-party-gstin').value.trim();
  const city = document.getElementById('drawer-party-city').value.trim();
  const state = document.getElementById('drawer-party-state').value;
  const pincode = document.getElementById('drawer-party-pincode').value.trim();
  const address = document.getElementById('drawer-party-address').value.trim();
  const limit = document.getElementById('drawer-party-limit').value.trim();

  if (!name || name.length < 3) return showToast("Enter a valid party name (min 3 chars)");

  const btn = document.querySelector('.drawer-footer .btn-primary');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/parties_quick_add.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, phone, email, gstin, address, city, state, pincode,
        credit_limit: limit
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');

    showToast(data.message);
    selectParty(data.id, data.name, state);
    closePartyDrawer();
  } catch (e) {
    showToast(e.message);
  } finally {
    btn.textContent = 'Save & Select';
    btn.disabled = false;
  }
}

// --- Product Autocomplete ---
let productDebounce = null;
let currentProductIndex = -1;

function handleProductInput(e, inputEl) {
  const q = e.target.value.trim();
  const wrapper = inputEl.closest('.autocomplete-wrapper');
  const list = wrapper.querySelector('.product-autocomplete-list');
  const tr = inputEl.closest('tr');

  tr.querySelector('.item-prod-id').value = '';

  if (q.length < 2) {
    list.style.display = 'none';
    return;
  }

  if (productDebounce) clearTimeout(productDebounce);
  productDebounce = setTimeout(() => fetchProductSearch(q, wrapper, tr), 300);
}

async function fetchProductSearch(q, wrapper, tr) {
  const list = wrapper.querySelector('.product-autocomplete-list');
  try {
    const res = await fetch(`${API}/products_search.php?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();

    list.innerHTML = '';
    currentProductIndex = -1;

    if (data.length === 0) {
      list.style.display = 'none';
    } else {
      data.forEach((p, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${p.name}</strong> <span style="color:#888;font-size:11px;">(₹${p.default_rate})</span>`;
        li.dataset.id = p.id;
        li.onclick = () => selectProduct(p, tr, list);
        li.addEventListener('mouseover', () => {
          currentProductIndex = idx;
          highlightProductItem(list.querySelectorAll('li'));
        });
        list.appendChild(li);
      });
      list.style.display = 'block';
    }
  } catch (e) {
    console.error(e);
  }
}

function handleProductKeydown(e, inputEl) {
  const wrapper = inputEl.closest('.autocomplete-wrapper');
  const list = wrapper.querySelector('.product-autocomplete-list');
  if (list.style.display !== 'block') return;

  const items = list.querySelectorAll('li');

  if (e.key === 'ArrowDown') {
    currentProductIndex = Math.min(currentProductIndex + 1, items.length - 1);
    highlightProductItem(items);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    currentProductIndex = Math.max(currentProductIndex - 1, 0);
    highlightProductItem(items);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (currentProductIndex >= 0 && items[currentProductIndex]) {
      items[currentProductIndex].click();
    }
    e.preventDefault();
  }
}

function highlightProductItem(items) {
  items.forEach(li => li.classList.remove('active'));
  if (currentProductIndex >= 0 && items[currentProductIndex]) {
    items[currentProductIndex].classList.add('active');
  }
}

function selectProduct(p, tr, list) {
  tr.querySelector('.item-prod-id').value = p.id;
  tr.querySelector('.item-desc').value = p.name;
  tr.querySelector('.item-rate').value = p.default_rate;
  tr.querySelector('.item-unit').value = p.unit;
  const gstInput = tr.querySelector('.item-gst');
  if (gstInput && document.getElementById('inv-bill-type').value === 'gst') {
    gstInput.value = p.gst_percent;
  }

  list.style.display = 'none';
  calculateTotals();
}

// Global click handler to close product lists
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrapper')) {
    document.querySelectorAll('.product-autocomplete-list').forEach(l => l.style.display = 'none');
  }
});
