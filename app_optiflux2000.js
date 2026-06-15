const selections = {};
let sectionOrder = [];


// ── Auto-decode from URL param ─────────────────────────────
function autoDecodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('decode');
  if (!code || code.length < 6) return;

  const prefix = code.slice(0, 5).toUpperCase();
  const chars  = code.slice(5).toUpperCase().split('');

  // Wait for first dropdown to appear
  waitForDropdowns(() => {
    // Step 1: select Primary Head by prefix (first dropdown)
    const firstWrapper = document.querySelector('#configurator .custom-select-wrapper');
    if (!firstWrapper) return;
    const rows = firstWrapper.querySelectorAll('.dropdown-table tbody tr');
    let headSelected = false;
    for (const row of rows) {
      const codeCell = row.querySelector('.col-code');
      if (codeCell && codeCell.textContent.trim().toUpperCase() === prefix) {
        row.click();
        headSelected = true;
        break;
      }
    }
    if (!headSelected) return;

    // Step 2: after head selected, apply chars by FIXED POSITION
    // Wait for sub-dropdowns to render, then apply each char to its exact position
    setTimeout(() => applyByPosition(chars), 300);
  });
}

function applyByPosition(chars) {
  // Get ALL dropdowns currently in the configurator (excluding the first "Equipos" one)
  // We apply chars[0] to dropdown index 1, chars[1] to index 2, etc.
  // But dropdowns at deeper levels only appear after parent is selected,
  // so we apply them sequentially with waits.
  applyCharAtIndex(chars, 0);
}

function applyCharAtIndex(chars, charIdx) {
  if (charIdx >= chars.length) return;

  const targetCode = chars[charIdx].toUpperCase();

  // Get all dropdowns in DOM order, skip the first one (Primary Head already selected)
  waitForNthDropdown(charIdx + 1, function(wrapper) {
    // If this dropdown was auto-selected (single option), skip it and move to next
    const triggerText = wrapper.querySelector('.trigger-text');
    const isAutoSelected = triggerText && !triggerText.classList.contains('placeholder');

    if (isAutoSelected) {
      // Check if the auto-selected value matches what we need
      const selectedCode = wrapper.querySelector('.dropdown-table tbody tr.selected .col-code');
      if (selectedCode && selectedCode.textContent.trim().toUpperCase() === targetCode) {
        // Matches — move on
        applyCharAtIndex(chars, charIdx + 1);
        return;
      }
      // Doesn't match — need to override the auto-selection
    }

    // Click the matching row
    const rows = wrapper.querySelectorAll('.dropdown-table tbody tr');
    for (const row of rows) {
      const codeCell = row.querySelector('.col-code');
      if (codeCell && codeCell.textContent.trim().toUpperCase() === targetCode) {
        row.click();
        setTimeout(() => applyCharAtIndex(chars, charIdx + 1), 100);
        return;
      }
    }
    // Code not found in this dropdown — skip and continue
    applyCharAtIndex(chars, charIdx + 1);
  });
}

function waitForNthDropdown(n, callback, attempts) {
  attempts = attempts || 0;
  const wrappers = document.querySelectorAll('#configurator .custom-select-wrapper');
  if (wrappers.length > n) {
    callback(wrappers[n]);
  } else if (attempts < 40) {
    setTimeout(() => waitForNthDropdown(n, callback, attempts + 1), 100);
  }
}

function waitForDropdowns(callback, attempts) {
  attempts = attempts || 0;
  const wrappers = document.querySelectorAll('#configurator .custom-select-wrapper');
  if (wrappers.length > 0) {
    callback();
  } else if (attempts < 50) {
    setTimeout(() => waitForDropdowns(callback, attempts + 1), 100);
  }
}


fetch('./data/optiflux_2000_hardrubber_full.json')
  .then(r => r.json())
  .then(data => { buildConfigurator(data); autoDecodeFromURL(); })
  .catch(err => console.error('Error cargando JSON:', err));

function buildConfigurator(data) {
  const container = document.getElementById('configurator');
  container.innerHTML = '';
  sectionOrder = [];
  const productKey = Object.keys(data)[0];
  walkNode(data[productKey], productKey, container);
  updateSummary();
}

function walkNode(node, path, parent) {
  if (Array.isArray(node)) {
    const valid = node.filter(o => o.code != null && 'code' in o);
    if (valid.length > 0) { registerOrder(path); renderSelect(valid, path, parent); }
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const metaKeys = ['code','price_usd','price_adder','_name','description','dn','note','status'];
  for (const key of Object.keys(node)) {
    if (metaKeys.includes(key)) continue;
    const child = node[key];
    const childPath = `${path}.${key}`;
    if (Array.isArray(child)) {
      const valid = child.filter(o => o.code != null && 'code' in o);
      if (valid.length > 0) {
        registerOrder(childPath);
        const section = createSection(key);
        parent.appendChild(section);
        renderSelect(valid, childPath, section);
      }
    } else if (typeof child === 'object' && child !== null) {
      const siblings = collectSelectableChildren(node);
      if (siblings.length > 0) {
        registerOrder(path + '.__group');
        const section = createSection(key);
        parent.appendChild(section);
        renderSelect(siblings, path + '.__group', section);
        return;
      }
    }
  }
}

function registerOrder(path) { if (!sectionOrder.includes(path)) sectionOrder.push(path); }

function collectSelectableChildren(node) {
  const metaKeys = ['code','price_usd','price_adder','_name','description','dn','note','status'];
  const keys = Object.keys(node).filter(k => !metaKeys.includes(k));
  return keys.map(k => node[k])
    .filter(c => typeof c === 'object' && !Array.isArray(c) && c !== null && 'code' in c)
    .map((c, i) => ({ _name: keys[i], ...c }));
}

function createSection(title) {
  const block = document.createElement('div');
  block.className = 'section-block';
  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = title;
  block.appendChild(titleEl);
  return block;
}

function getPrice(opt) {
  if ('price_usd' in opt) return opt.price_usd;
  if ('price_adder' in opt) return opt.price_adder;
  return 0;
}

function formatPriceDisplay(price) {
  if (price === null || price === undefined || price === 0 || price === '0') return { text: '', cls: '' };
  if (price === 'on request' || price === 'On request') return { text: 'A consultar', cls: 'muted' };
  if (typeof price === 'string') return { text: price, cls: 'muted' };
  if (typeof price === 'number') {
    const sign = price > 0 ? '+' : '';
    const cls = price < 0 ? 'negative' : '';
    return { text: `${sign}USD ${price.toLocaleString()}`, cls };
  }
  return { text: String(price), cls: 'muted' };
}

function buildTriggerHTML(opt) {
  const desc = opt._name || opt.description || opt.dn || opt.code;
  const pd = formatPriceDisplay(getPrice(opt));
  const priceStr = pd.text ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>` : '';
  return `<span class="trigger-code">${opt.code}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
}


// ── Cable helpers ──────────────────────────────────────────
const CABLE_METERS_MAP = { '0':0, '1':10, '2':15, '3':20, '4':25, '5':30, '6':40, '7':50, '8':100 };
const CABLE_PRICE_PER_METER_MAP = { '0': 22, '1': 33 };

function getCableCode() {
  const entry = Object.values(selections).find(s => s.section.toLowerCase().trim() === 'cable');
  return entry ? entry.code : '0';
}

function calcCableLengthPrice(lengthCode) {
  const meters = CABLE_METERS_MAP[lengthCode] ?? 0;
  const ppm    = CABLE_PRICE_PER_METER_MAP[getCableCode()] ?? 22;
  return meters * ppm;
}

function isCableLengthSection(title) {
  const t = title.toLowerCase();
  return t.includes('cable length') || t.includes('cable lenght');
}

function refreshCableLengthDropdownRows() {
  // Only update unselected rows — don't touch the trigger
  document.querySelectorAll('#configurator .custom-select-wrapper').forEach(wrapper => {
    const lbl = wrapper.closest('.select-row')?.querySelector('label');
    if (!lbl || !isCableLengthSection(lbl.textContent)) return;
    wrapper.querySelectorAll('.dropdown-table tbody tr').forEach(row => {
      const codeCell  = row.querySelector('.col-code');
      const priceCell = row.querySelector('.col-price');
      if (!codeCell || !priceCell) return;
      const calcPrice = calcCableLengthPrice(codeCell.textContent.trim());
      const pd = formatPriceDisplay(calcPrice);
      priceCell.textContent = pd.text;
      priceCell.className = `col-price ${pd.cls}`;
    });
    // Also update trigger if a row is already selected
    const selectedRow = wrapper.querySelector('.dropdown-table tbody tr.selected');
    if (selectedRow) {
      const trigger = wrapper.querySelector('.trigger-text');
      if (trigger && !trigger.classList.contains('placeholder')) {
        const codeCell = selectedRow.querySelector('.col-code');
        const desc = selectedRow.querySelector('.col-desc')?.textContent || '';
        const calcPrice = calcCableLengthPrice(codeCell.textContent.trim());
        const pd = formatPriceDisplay(calcPrice);
        const priceStr = pd.text ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>` : '';
        trigger.innerHTML = `<span class="trigger-code">${codeCell.textContent.trim()}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
      }
    }
  });
}


// ── Grounding ring / Ring material helpers ─────────────────
const GROUNDING_PRICES = {
  '2': {'Y': 79,  'Z': 168},
  '3': {'Y': 101, 'Z': 214},
  '4': {'Y': 101, 'Z': 214},
  '5': {'Y': 258, 'Z': 513},
  '6': {'Y': 135, 'Z': 270},
  '7': {'Y': 944, 'Z': 1885},
  'N': {'Y': 101, 'Z': 214},
  'P': {'Y': 79,  'Z': 168},
  'H': {'Y': 101, 'Z': 214},
};

function getElectrodeCode() {
  const entry = Object.values(selections).find(s => s.section.toLowerCase().trim() === 'electrodes');
  return entry ? entry.code : '2';
}

function isGroundingSection(title) {
  const t = title.toLowerCase().trim();
  return t === 'ring / material' || t === 'grounding ring material';
}

function calcGroundingPrice(ringCode) {
  const eCode = getElectrodeCode();
  const prices = GROUNDING_PRICES[eCode] || GROUNDING_PRICES['2'];
  if (ringCode === 'Y') return prices['Y'];
  if (ringCode === 'Z') return prices['Z'];
  return null; // other codes keep their original price
}

function refreshGroundingRows() {
  document.querySelectorAll('#configurator .custom-select-wrapper').forEach(wrapper => {
    const lbl = wrapper.closest('.select-row')?.querySelector('label');
    if (!lbl || !isGroundingSection(lbl.textContent)) return;
    wrapper.querySelectorAll('.dropdown-table tbody tr').forEach(row => {
      const codeCell  = row.querySelector('.col-code');
      const priceCell = row.querySelector('.col-price');
      if (!codeCell || !priceCell) return;
      const code = codeCell.textContent.trim();
      const calcPrice = calcGroundingPrice(code);
      if (calcPrice === null) return; // not Y or Z, keep original
      const pd = formatPriceDisplay(calcPrice);
      priceCell.textContent = pd.text;
      priceCell.className = `col-price ${pd.cls}`;
      // Update trigger if selected
      if (row.classList.contains('selected')) {
        const trigger = wrapper.querySelector('.trigger-text');
        if (trigger && !trigger.classList.contains('placeholder')) {
          const desc = row.querySelector('.col-desc')?.textContent || '';
          const priceStr = pd.text ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>` : '';
          trigger.innerHTML = `<span class="trigger-code">${code}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
        }
      }
    });
  });
}

function renderSelect(options, path, parent) {
  const sectionTitle = path.split('.').slice(-1)[0].replace('__group','Opción');
  const row = document.createElement('div');
  row.className = 'select-row';
  const label = document.createElement('label');
  label.textContent = sectionTitle;
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.tabIndex = 0;
  trigger.innerHTML = `<span class="trigger-text placeholder">— Seleccioná una opción —</span><span class="trigger-arrow"></span>`;
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-dropdown';
  const table = document.createElement('table');
  table.className = 'dropdown-table';
  table.innerHTML = `<thead><tr><th class="col-code">Código</th><th class="col-desc">Descripción</th><th class="col-price">Precio</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  options.forEach(opt => {
    const pd = formatPriceDisplay(getPrice(opt));
    const desc = opt._name || opt.description || opt.dn || opt.code;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="col-code">${opt.code}</td><td class="col-desc">${desc}</td><td class="col-price ${pd.cls}">${pd.text}</td>`;
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      const t = trigger.querySelector('.trigger-text');
      if (isCableLengthSection(sectionTitle)) {
        const calcPrice = calcCableLengthPrice(opt.code);
        const pd = formatPriceDisplay(calcPrice);
        const desc = opt._name || opt.description || opt.dn || opt.code;
        const priceStr = pd.text ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>` : '';
        t.innerHTML = `<span class="trigger-code">${opt.code}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
      } else if (isGroundingSection(sectionTitle)) {
        const calcPrice = calcGroundingPrice(opt.code);
        const pd = calcPrice !== null ? formatPriceDisplay(calcPrice) : formatPriceDisplay(getPrice(opt));
        const desc = opt._name || opt.description || opt.dn || opt.code;
        const priceStr = pd.text ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>` : '';
        t.innerHTML = `<span class="trigger-code">${opt.code}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
      } else {
        t.innerHTML = buildTriggerHTML(opt);
      }
      t.classList.remove('placeholder');
      closeAllDropdowns();
      onOptionSelected(opt, path, sectionTitle, parent);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  dropdown.appendChild(table);
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) { dropdown.classList.add('open'); trigger.classList.add('open'); }
  });
  trigger.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); trigger.click(); } });
  row.appendChild(label);
  row.appendChild(wrapper);
  parent.appendChild(row);
  const subContainer = document.createElement('div');
  subContainer.id = `sub-${path}`;
  parent.appendChild(subContainer);
  if (options.length === 1) {
    const only = options[0];
    tbody.querySelector('tr').classList.add('selected');
    const t = trigger.querySelector('.trigger-text');
    t.innerHTML = buildTriggerHTML(only);
    t.classList.remove('placeholder');
    onOptionSelected(only, path, sectionTitle, parent);
  }

  // Auto-select code "0" for Cable and other default-zero sections
  const autoZeroSections = ['cable', 'calibration', 'construction requirements', 'qa / qc requirements', 'qa/qc requirements'];
  if (autoZeroSections.includes(sectionTitle.toLowerCase().trim())) {
    const defaultRow = Array.from(tbody.querySelectorAll('tr')).find(r => {
      const c = r.querySelector('.col-code');
      return c && c.textContent.trim() === '0';
    });
    if (defaultRow) defaultRow.click();
  }

  // Auto-select code "2" for Electrodes
  if (sectionTitle.toLowerCase().trim() === 'electrodes') {
    const defaultRow = Array.from(tbody.querySelectorAll('tr')).find(r => {
      const c = r.querySelector('.col-code');
      return c && c.textContent.trim() === '2';
    });
    if (defaultRow) defaultRow.click();
  }

  // When Cable length renders, update row prices
  if (isCableLengthSection(sectionTitle)) {
    setTimeout(refreshCableLengthDropdownRows, 50);
  }

  // When grounding section renders, update Y/Z prices
  if (isGroundingSection(sectionTitle)) {
    setTimeout(refreshGroundingRows, 50);
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.custom-select-trigger.open').forEach(t => t.classList.remove('open'));
}
document.addEventListener('click', closeAllDropdowns);

function onOptionSelected(opt, path, sectionTitle, parent) {
  const subContainer = document.getElementById(`sub-${path}`);
  if (subContainer) subContainer.innerHTML = '';
  clearChildSelections(path);
  const price = getPrice(opt);
  const desc = opt._name || opt.description || opt.dn || opt.code;
  selections[path] = { code: opt.code, price, section: sectionTitle, description: desc };
  if (subContainer) {
    const metaKeys = ['code','price_usd','price_adder','_name','description','dn','note','status'];
    Object.keys(opt).filter(k => !metaKeys.includes(k)).forEach(k => {
      const child = opt[k];
      const childPath = `${path}.${opt.code}.${k}`;
      if (Array.isArray(child)) {
        const valid = child.filter(o => o.code != null && 'code' in o);
        if (valid.length > 0) {
          registerOrder(childPath);
          const section = createSection(k);
          subContainer.appendChild(section);
          renderSelect(valid, childPath, section);
        }
      } else if (typeof child === 'object' && child !== null) {
        const section = createSection(k);
        subContainer.appendChild(section);
        walkNode(child, childPath, section);
      }
    });
  }
  // If Cable type changed, refresh Cable length rows and trigger
  if (sectionTitle.toLowerCase().trim() === 'cable') {
    setTimeout(refreshCableLengthDropdownRows, 50);
  }
  // If Electrodes changed, refresh grounding ring prices
  if (sectionTitle.toLowerCase().trim() === 'electrodes') {
    setTimeout(refreshGroundingRows, 50);
  }
  updateSummary();
}

function clearChildSelections(path) {
  for (const key of Object.keys(selections)) { if (key.startsWith(path + '.')) delete selections[key]; }
}

function updateSummary() {
  const codeEl  = document.getElementById('equipment-code');
  const priceEl = document.getElementById('total-price');
  const saleEl  = document.getElementById('sale-price');
  const listEl  = document.getElementById('selections-list');
  const noteEl  = document.getElementById('on-request-note');
  const dlBtn   = document.getElementById('download-btn');
  const keys = Object.keys(selections);
  if (keys.length === 0) {
    codeEl.textContent = '—'; priceEl.textContent = '—'; saleEl.textContent = '—';
    listEl.innerHTML = '<p class="no-selections">Ninguna selección aún.</p>';
    noteEl.classList.add('hidden'); dlBtn.classList.add('hidden');
    return;
  }
  // Recalculate Cable length price
  const clKey = Object.keys(selections).find(k => {
    const s = selections[k].section.toLowerCase();
    return s.includes('cable length') || s.includes('cable lenght');
  });
  if (clKey) selections[clKey].price = calcCableLengthPrice(selections[clKey].code);

  // Recalculate grounding ring price
  const grKey = Object.keys(selections).find(k => isGroundingSection(selections[k].section));
  if (grKey) {
    const calcGr = calcGroundingPrice(selections[grKey].code);
    if (calcGr !== null) selections[grKey].price = calcGr;
  }

  const sorted = keys.slice().sort((a,b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b));
  codeEl.textContent = sorted.map(k => selections[k].code).join('');
  listEl.innerHTML = '';
  let total = 0, hasOnRequest = false, hasRef = false;
  sorted.forEach(k => {
    const { code, price, section, description } = selections[k];
    const pd = formatPriceDisplay(price);
    if (typeof price === 'number' && !isNaN(price)) total += price;
    else if (price === 'on request' || price === 'On request') hasOnRequest = true;
    else if (typeof price === 'string' && price) hasRef = true;
    const item = document.createElement('div');
    item.className = 'selection-item';
    item.innerHTML = `<span class="sel-section" title="${section}">${section}</span><span class="sel-code">${code}</span><span class="sel-price ${pd.cls}">${pd.text}</span>`;
    listEl.appendChild(item);
  });
  const allFilled = Array.from(document.querySelectorAll('#configurator .custom-select-wrapper'))
    .every(w => { const t = w.querySelector('.trigger-text'); return t && !t.classList.contains('placeholder'); });
  const extraCostEl = document.getElementById('extra-cost');
  const discountEl  = document.getElementById('discount');
  const extraCost   = parseFloat(extraCostEl?.value) || 0;
  const discount    = parseFloat(discountEl?.value)  || 0;

  if (allFilled) {
    const totalWithExtra = total + extraCost;
    priceEl.textContent = `USD ${totalWithExtra.toLocaleString()}`;
    const saleBase = totalWithExtra * 0.5 * 1.4 * 1.8;
    const saleAfterDiscount = saleBase * (1 - discount / 100);
    saleEl.textContent = `USD ${Math.round(saleAfterDiscount).toLocaleString()}`;
    if (hasOnRequest || hasRef) noteEl.classList.remove('hidden'); else noteEl.classList.add('hidden');
    dlBtn.classList.remove('hidden');
  } else {
    priceEl.textContent = '—'; saleEl.textContent = '—';
    noteEl.classList.add('hidden'); dlBtn.classList.add('hidden');
  }
}

function downloadExcel() {
  const sorted = Object.keys(selections).slice().sort((a,b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b));
  const equipCode = sorted.map(k => selections[k].code).join('');
  const rows = [['Código','Característica','Descripción']];
  sorted.forEach(k => { const { code, section, description } = selections[k]; rows.push([code, section, description]); });
  rows.push([]); rows.push(['Código completo del equipo','',equipCode]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:35},{wch:60}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Configuración');
  XLSX.writeFile(wb, `OPTIFLUX_2000_${equipCode}.xlsx`);
}