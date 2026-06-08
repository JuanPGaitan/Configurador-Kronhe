// ── Estado global ──────────────────────────────────────────────
const selections = {};   // { path: { code, price } }

// ── Entrada principal ──────────────────────────────────────────
fetch('./data/optiflux_2000_hardrubber_full.json')
  .then(r => r.json())
  .then(data => buildConfigurator(data))
  .catch(err => console.error('Error cargando JSON:', err));

// ── Construye el configurador completo ─────────────────────────
function buildConfigurator(data) {
  const container = document.getElementById('configurator');
  container.innerHTML = '';
  const productKey = Object.keys(data)[0];
  walkNode(data[productKey], productKey, container);
  updateResult();
}

// ── Recorre el JSON recursivamente ─────────────────────────────
function walkNode(node, path, parent) {
  if (Array.isArray(node)) {
    // Filtramos entradas sin code o con code null (son notas)
    const validOptions = node.filter(opt => opt.code != null && 'code' in opt);
    if (validOptions.length > 0) {
      renderSelect(validOptions, path, parent);
    }
    return;
  }

  if (typeof node === 'object' && node !== null) {
    const metaKeys = ['code', 'price_usd', 'price_adder', '_name', 'description', 'dn', 'note', 'status'];
    for (const key of Object.keys(node)) {
      if (metaKeys.includes(key)) continue;

      const child = node[key];
      const childPath = `${path}.${key}`;

      if (Array.isArray(child)) {
        const section = createSection(key);
        parent.appendChild(section);
        const validOptions = child.filter(opt => opt.code != null && 'code' in opt);
        if (validOptions.length > 0) {
          renderSelect(validOptions, childPath, section);
        }
      } else if (typeof child === 'object' && child !== null) {
        // Colectamos hermanos seleccionables (tienen _name o code)
        const siblings = collectSelectableChildren(node);
        if (siblings.length > 0) {
          const section = createSection(key);
          parent.appendChild(section);
          renderSelect(siblings, path + '.__group', section);
          return; // procesamos todos juntos
        }
      }
    }
  }
}

// ── Junta hijos objeto con code en un array ────────────────────
function collectSelectableChildren(node) {
  const metaKeys = ['code', 'price_usd', 'price_adder', '_name', 'description', 'dn', 'note', 'status'];
  const result = [];
  for (const key of Object.keys(node)) {
    if (metaKeys.includes(key)) continue;
    const child = node[key];
    if (typeof child === 'object' && !Array.isArray(child) && child !== null && 'code' in child) {
      result.push({ _name: key, ...child });
    }
  }
  return result;
}

// ── Crea un bloque de sección con título ───────────────────────
function createSection(title) {
  const block = document.createElement('div');
  block.className = 'section-block';
  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = title;
  block.appendChild(titleEl);
  return block;
}

// ── Obtiene el precio de una opción (price_usd o price_adder) ──
function getPrice(opt) {
  if ('price_usd' in opt) return opt.price_usd;
  if ('price_adder' in opt) return opt.price_adder;
  return 0;
}

// ── Renderiza un <select> para un array de opciones ────────────
function renderSelect(options, path, parent) {
  const row = document.createElement('div');
  row.className = 'select-row';

  const labelText = path.split('.').pop().replace('__group', 'Opción');
  const label = document.createElement('label');
  label.textContent = labelText;
  label.htmlFor = `select-${path}`;

  const select = document.createElement('select');
  select.id = `select-${path}`;
  select.dataset.path = path;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Seleccioná una opción —';
  select.appendChild(placeholder);

  options.forEach(opt => {
    const option = document.createElement('option');
    const price = getPrice(opt);
    option.value = JSON.stringify({ code: opt.code, price });

    // Texto visible
    const name = opt._name || opt.description || opt.dn || opt.code;
    let priceText = '';
    if (price === 'on request') {
      priceText = '  |  A consultar';
    } else if (typeof price === 'string' && price !== '' && price !== '0') {
      priceText = `  |  ${price}`;  // ej: "see page 2"
    } else if (typeof price === 'number' && price !== 0) {
      const sign = price > 0 ? '+' : '';
      priceText = `  |  ${sign}USD ${price.toLocaleString()}`;
    }

    option.textContent = `${name}${priceText}`;
    select.appendChild(option);
  });

  select.addEventListener('change', () => onSelectChange(select, options, path, parent));

  row.appendChild(label);
  row.appendChild(select);
  parent.appendChild(row);

  const subContainer = document.createElement('div');
  subContainer.id = `sub-${path}`;
  parent.appendChild(subContainer);
}

// ── Maneja el cambio en un select ──────────────────────────────
function onSelectChange(select, options, path, parent) {
  const subContainer = document.getElementById(`sub-${path}`);
  if (subContainer) subContainer.innerHTML = '';
  clearChildSelections(path);

  if (!select.value) {
    delete selections[path];
    updateResult();
    return;
  }

  const { code, price } = JSON.parse(select.value);
  selections[path] = { code, price };

  // Buscamos si la opción seleccionada tiene sub-propiedades
  const selectedOpt = options.find(o => o.code === code);
  if (selectedOpt && subContainer) {
    const metaKeys = ['code', 'price_usd', 'price_adder', '_name', 'description', 'dn', 'note', 'status'];
    const childKeys = Object.keys(selectedOpt).filter(k => !metaKeys.includes(k));

    childKeys.forEach(k => {
      const child = selectedOpt[k];
      const childPath = `${path}.${code}.${k}`;

      if (Array.isArray(child)) {
        const validOptions = child.filter(opt => opt.code != null && 'code' in opt);
        if (validOptions.length > 0) {
          const section = createSection(k);
          subContainer.appendChild(section);
          renderSelect(validOptions, childPath, section);
        }
      } else if (typeof child === 'object' && child !== null) {
        const section = createSection(k);
        subContainer.appendChild(section);
        walkNode(child, childPath, section);
      }
    });
  }

  updateResult();
}

// ── Limpia selecciones hijas cuando cambia un padre ────────────
function clearChildSelections(path) {
  for (const key of Object.keys(selections)) {
    if (key.startsWith(path + '.')) delete selections[key];
  }
}

// ── Actualiza el panel de resultado ───────────────────────────
function updateResult() {
  const resultEl = document.getElementById('result');
  const codeEl = document.getElementById('equipment-code');
  const priceEl = document.getElementById('total-price');

  const keys = Object.keys(selections);
  if (keys.length === 0) {
    resultEl.classList.add('hidden');
    return;
  }

  resultEl.classList.remove('hidden');

  // Código: concatenación de todos los codes
  const fullCode = keys.map(k => selections[k].code).join('');
  codeEl.textContent = fullCode;

  // Precio: suma price_usd + todos los price_adder numéricos
  let total = 0;
  let hasOnRequest = false;
  let hasSeePageRef = false;

  keys.forEach(k => {
    const p = selections[k].price;
    if (p === 'on request') {
      hasOnRequest = true;
    } else if (typeof p === 'string' && p !== '' && p !== '0') {
      // Valores como "see page 2" — los ignoramos en la suma pero los avisamos
      hasSeePageRef = true;
    } else if (typeof p === 'number' && !isNaN(p)) {
      total += p;
    }
  });

  let priceDisplay = `USD ${total.toLocaleString()}`;
  if (hasOnRequest) priceDisplay += ' + ítems a consultar';
  if (hasSeePageRef) priceDisplay += ' + adicionales a consultar';

  priceEl.textContent = priceDisplay;
}