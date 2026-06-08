// ── Estado global ──────────────────────────────────────────
// selections: { path: { code, price, section, description, order } }
const selections = {};
let sectionOrder = [];   // array de paths en el orden exacto del JSON

// ── Entrada principal ──────────────────────────────────────
fetch('./data/optiflux_2000_hardrubber_full.json')
  .then(r => r.json())
  .then(data => buildConfigurator(data))
  .catch(err => console.error('Error cargando JSON:', err));

// ── Construye el configurador ──────────────────────────────
function buildConfigurator(data) {
  const container = document.getElementById('configurator');
  container.innerHTML = '';
  sectionOrder = [];
  const productKey = Object.keys(data)[0];
  walkNode(data[productKey], productKey, container);
  updateSummary();
}

// ── Recorre el JSON recursivamente ─────────────────────────
function walkNode(node, path, parent) {
  if (Array.isArray(node)) {
    const valid = node.filter(o => o.code != null && 'code' in o);
    if (valid.length > 0) {
      registerOrder(path);
      renderSelect(valid, path, parent);
    }
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

// ── Registra el orden de cada sección ─────────────────────
function registerOrder(path) {
  if (!sectionOrder.includes(path)) sectionOrder.push(path);
}

function collectSelectableChildren(node) {
  const metaKeys = ['code','price_usd','price_adder','_name','description','dn','note','status'];
  const keys = Object.keys(node).filter(k => !metaKeys.includes(k));
  return keys
    .map(k => node[k])
    .filter(c => typeof c === 'object' && !Array.isArray(c) && c !== null && 'code' in c)
    .map((c, i) => ({ _name: keys[i], ...c }));
}

// ── Crea sección ───────────────────────────────────────────
function createSection(title) {
  const block = document.createElement('div');
  block.className = 'section-block';
  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = title;
  block.appendChild(titleEl);
  return block;
}

// ── Obtiene precio de una opción ───────────────────────────
function getPrice(opt) {
  if ('price_usd' in opt) return opt.price_usd;
  if ('price_adder' in opt) return opt.price_adder;
  return 0;
}

// ── Formatea precio para mostrar en tabla ──────────────────
// Retorna { text, cls } donde text='' significa celda vacía
function formatPriceDisplay(price) {
  if (price === null || price === undefined || price === 0 || price === '0') 
    return { text: '', cls: '' };
  if (price === 'on request' || price === 'On request') 
    return { text: 'A consultar', cls: 'muted' };
  if (typeof price === 'string') 
    return { text: price, cls: 'muted' };
  if (typeof price === 'number') {
    const sign = price > 0 ? '+' : '';
    const cls = price < 0 ? 'negative' : '';
    return { text: `${sign}USD ${price.toLocaleString()}`, cls };
  }
  return { text: String(price), cls: 'muted' };
}

// ── HTML del trigger (mismo estilo que la fila de la tabla) ──
function buildTriggerHTML(opt) {
  const desc = opt._name || opt.description || opt.dn || opt.code;
  const price = getPrice(opt);
  const pd = formatPriceDisplay(price);
  const priceStr = pd.text
    ? `<span class="trigger-price ${pd.cls}">${pd.text}</span>`
    : '';
  return `<span class="trigger-code">${opt.code}</span><span class="trigger-sep">—</span><span class="trigger-desc">${desc}</span>${priceStr}`;
}

// ── Renderiza select con dropdown custom de 3 columnas ──────
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
  table.innerHTML = `<thead><tr>
    <th class="col-code">Código</th>
    <th class="col-desc">Descripción</th>
    <th class="col-price">Precio</th>
  </tr></thead>`;

  const tbody = document.createElement('tbody');

  options.forEach(opt => {
    const price = getPrice(opt);
    const pd = formatPriceDisplay(price);
    const desc = opt._name || opt.description || opt.dn || opt.code;

    const tr = document.createElement('tr');
    tr.dataset.code = opt.code;

    tr.innerHTML = `
      <td class="col-code">${opt.code}</td>
      <td class="col-desc">${desc}</td>
      <td class="col-price ${pd.cls}">${pd.text}</td>
    `;

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');

      const triggerTextEl = trigger.querySelector('.trigger-text');
      triggerTextEl.innerHTML = buildTriggerHTML(opt);
      triggerTextEl.classList.remove('placeholder');

      closeAllDropdowns();
      onOptionSelected(opt, path, sectionTitle, parent);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  dropdown.appendChild(table);
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      dropdown.classList.add('open');
      trigger.classList.add('open');
    }
  });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
  });

  row.appendChild(label);
  row.appendChild(wrapper);
  parent.appendChild(row);

  const subContainer = document.createElement('div');
  subContainer.id = `sub-${path}`;
  parent.appendChild(subContainer);

  // Auto-select if only one option available
  if (options.length === 1) {
    const onlyOpt = options[0];
    const onlyRow = tbody.querySelector('tr');
    if (onlyRow) {
      onlyRow.classList.add('selected');
      const triggerTextEl = trigger.querySelector('.trigger-text');
      triggerTextEl.innerHTML = buildTriggerHTML(onlyOpt);
      triggerTextEl.classList.remove('placeholder');
      onOptionSelected(onlyOpt, path, sectionTitle, parent);
    }
  }
}

// ── Cierra todos los dropdowns ─────────────────────────────
function closeAllDropdowns() {
  document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.custom-select-trigger.open').forEach(t => t.classList.remove('open'));
}
document.addEventListener('click', closeAllDropdowns);

// ── Maneja selección de opción ─────────────────────────────
function onOptionSelected(opt, path, sectionTitle, parent) {
  const subContainer = document.getElementById(`sub-${path}`);
  if (subContainer) subContainer.innerHTML = '';
  clearChildSelections(path);

  const price = getPrice(opt);
  const desc = opt._name || opt.description || opt.dn || opt.code;

  // Guardamos el índice de orden para concatenar correctamente
  const orderIndex = sectionOrder.indexOf(path);
  selections[path] = { code: opt.code, price, section: sectionTitle, description: desc, order: orderIndex };

  // Renderizar hijos si los hay
  if (subContainer) {
    const metaKeys = ['code','price_usd','price_adder','_name','description','dn','note','status'];
    const childKeys = Object.keys(opt).filter(k => !metaKeys.includes(k));
    childKeys.forEach(k => {
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

  updateSummary();
}

function clearChildSelections(path) {
  for (const key of Object.keys(selections)) {
    if (key.startsWith(path + '.')) delete selections[key];
  }
}

// ── Actualiza panel de resumen ─────────────────────────────
function updateSummary() {
  const codeEl  = document.getElementById('equipment-code');
  const priceEl = document.getElementById('total-price');
  const listEl  = document.getElementById('selections-list');
  const noteEl  = document.getElementById('on-request-note');

  const keys = Object.keys(selections);

  if (keys.length === 0) {
    codeEl.textContent = '—';
    priceEl.textContent = '—';
    listEl.innerHTML = '<p class="no-selections">Ninguna selección aún.</p>';
    noteEl.classList.add('hidden');
    return;
  }

  // ── Ordenar por posición en el JSON ──────────────────────
  const sorted = keys.slice().sort((a, b) => {
    const oa = sectionOrder.indexOf(a);
    const ob = sectionOrder.indexOf(b);
    return oa - ob;
  });

  // Código concatenado EN ORDEN
  codeEl.textContent = sorted.map(k => selections[k].code).join('');

  // Lista y precio
  listEl.innerHTML = '';
  let total = 0;
  let hasOnRequest = false;
  let hasRef = false;

  sorted.forEach(k => {
    const { code, price, section, description } = selections[k];
    const pd = formatPriceDisplay(price);

    if (typeof price === 'number' && !isNaN(price)) total += price;
    else if (price === 'on request' || price === 'On request') hasOnRequest = true;
    else if (typeof price === 'string' && price) hasRef = true;

    const item = document.createElement('div');
    item.className = 'selection-item';
    item.innerHTML = `
      <span class="sel-section" title="${section}">${section}</span>
      <span class="sel-code">${code}</span>
      <span class="sel-price ${pd.cls}">${pd.text}</span>
    `;
    listEl.appendChild(item);
  });

  // Only show price if every visible dropdown has a selection
  const allSelects = document.querySelectorAll('.custom-select-wrapper');
  const allFilled = Array.from(allSelects).every(wrapper => {
    const triggerText = wrapper.querySelector('.trigger-text');
    return triggerText && !triggerText.classList.contains('placeholder');
  });

  const dlBtn = document.getElementById('download-btn');
  const salePriceEl = document.getElementById('sale-price');
  if (allFilled) {
    priceEl.textContent = `USD ${total.toLocaleString()}`;
    // Sale price = cost * 0.5 * 1.4 * 1.8
    const saleTotal = total * 0.5 * 1.4 * 1.8;
    salePriceEl.textContent = `USD ${Math.round(saleTotal).toLocaleString()}`;
    if (hasOnRequest || hasRef) {
      noteEl.classList.remove('hidden');
    } else {
      noteEl.classList.add('hidden');
    }
    if (dlBtn) dlBtn.classList.remove('hidden');
  } else {
    priceEl.textContent = '—';
    salePriceEl.textContent = '—';
    noteEl.classList.add('hidden');
    if (dlBtn) dlBtn.classList.add('hidden');
  }
}

// ── Genera y descarga el Excel de configuración ────────────
function downloadExcel() {
  const keys = Object.keys(selections).slice().sort((a, b) => {
    return sectionOrder.indexOf(a) - sectionOrder.indexOf(b);
  });

  const equipCode = keys.map(k => selections[k].code).join('');

  // Encabezados
  const rows = [
    ['Código', 'Característica', 'Descripción']
  ];

  keys.forEach(k => {
    const { code, section, description } = selections[k];
    rows.push([code, section, description]);
  });

  // Fila de total
  rows.push([]);
  rows.push(['Código completo del equipo', '', equipCode]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Anchos de columna
  ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Configuración');

  XLSX.writeFile(wb, `OPTIFLUX_2000_${equipCode}.xlsx`);
}