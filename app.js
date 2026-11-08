/**
 * ============================================================================
 * LABORATORIO VIRTUAL DE ESTADÍSTICA APLICADA (100% CLIENT-SIDE)
 * Tema: "Conocimiento y práctica de ciberseguridad en estudiantes universitarios"
 * Persistencia: window.localStorage ('cyber_stats_dataset_v1')
 * Gráficos: HTML5 Canvas 2D nativo autoajustable con ResizeObserver
 * Notación Matemática: HTML nativo (<sub>, <sup>) y entidades Unicode reales
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'cyber_stats_dataset_v1';
  const INITIAL_N = 50;

  // Metadatos y catálogo de variables para etiquetas legibles y orden ordinal
  const VARIABLE_META = {
    id: { label: 'ID Participante', type: 'id', unit: '' },
    facultad: {
      label: 'Facultad Académica',
      type: 'nominal',
      categories: ['Ingeniería', 'Ciencias de la Salud', 'Ciencias Económicas', 'Humanidades']
    },
    nivel_conocimiento: {
      label: 'Nivel de Conocimiento',
      type: 'ordinal',
      categories: ['Bajo', 'Medio', 'Alto']
    },
    uso_2fa: {
      label: 'Uso de Autenticación 2FA',
      type: 'dichotomous',
      categories: ['Sí', 'No']
    },
    sufrio_incidente: {
      label: 'Víctima de Incidente (Último Año)',
      type: 'dichotomous',
      categories: ['Sí', 'No']
    },
    tipo_red_frecuente: {
      label: 'Tipo de Red Frecuente',
      type: 'nominal',
      categories: ['Red Doméstica', 'WiFi Universitario', 'Datos Móviles', 'WiFi Público Abierto']
    },
    edad: { label: 'Edad', type: 'discrete', unit: 'años', decimals: 0 },
    horas_redes: { label: 'Exposición Semanal en Línea', type: 'continuous', unit: 'h/sem', decimals: 1 },
    puntaje_conocimiento: { label: 'Puntaje de Conocimiento', type: 'continuous', unit: 'pts', decimals: 0 },
    puntaje_practica: { label: 'Puntaje de Práctica Segura', type: 'continuous', unit: 'pts', decimals: 0 },
    contrasenas_unicas: { label: 'Contraseñas Únicas', type: 'discrete', unit: 'cuentas', decimals: 0 },
    antiguedad_clave_meses: { label: 'Antigüedad de Clave Principal', type: 'discrete', unit: 'meses', decimals: 0 }
  };

  // Paleta institucional para gráficos Canvas
  const CHART_COLORS = ['#245B70', '#6B9B83', '#F2C66D', '#3B82F6', '#E07A5F', '#81B29A'];

  // Estado reactivo en memoria
  let dataset = [];
  let sortState = { column: 'id', asc: true };

  // ==========================================================================
  // 1. UTILIDADES MATEMÁTICAS Y GENERADOR SINTÉTICO BOX-MULLER
  // ==========================================================================

  /**
   * Transformación Box-Muller para simular variables normales N(0,1)
   */
  function randomNormal() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function weightedChoice(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      if (r < weights[i]) return items[i];
      r -= weights[i];
    }
    return items[items.length - 1];
  }

  /**
   * Genera un registro individual coherente estadísticamente
   */
  function generateSingleRecord(id, targetRho) {
    const facultades = VARIABLE_META.facultad.categories;
    const facWeights = [0.32, 0.26, 0.24, 0.18];
    const facultad = weightedChoice(facultades, facWeights);

    // Dos normales estándar independientes Z1, Z2 para inducir correlación controlada
    const z1 = randomNormal();
    const z2 = randomNormal();

    // Pequeño bono medio según facultad para realismo
    const facShift = facultad === 'Ingeniería' ? 5 : (facultad === 'Ciencias Económicas' ? 1 : -2);

    // Puntaje de conocimiento: media ~ 66, DE ~ 14, acotado [18, 99]
    const rawKnow = 66 + facShift + 14 * z1;
    const puntaje_conocimiento = Math.round(clamp(rawKnow, 18, 99));

    // Puntaje de práctica correlacionado con conocimiento mediante estructura bivariada:
    // Y* = rho * Z1 + sqrt(1 - rho^2) * Z2 => r muestral garantizado en [0.45, 0.75]
    const zPractica = targetRho * z1 + Math.sqrt(1 - targetRho * targetRho) * z2;
    const rawPrac = 63 + (facShift * 0.7) + 14.5 * zPractica;
    const puntaje_practica = Math.round(clamp(rawPrac, 15, 98));

    // Nivel de conocimiento ordinal coherente con puntaje_conocimiento + ligera variabilidad subjetiva
    const perceivedScore = puntaje_conocimiento + randomNormal() * 6;
    let nivel_conocimiento = 'Medio';
    if (perceivedScore < 56) nivel_conocimiento = 'Bajo';
    else if (perceivedScore >= 76) nivel_conocimiento = 'Alto';

    // Probabilidad de usar 2FA aumenta con puntaje_practica
    const prob2FA = clamp(0.22 + (puntaje_practica / 100) * 0.62, 0.15, 0.88);
    const uso_2fa = Math.random() < prob2FA ? 'Sí' : 'No';

    // Tipo de red frecuente
    const redes = VARIABLE_META.tipo_red_frecuente.categories;
    const redWeights = puntaje_practica >= 65
      ? [0.42, 0.34, 0.17, 0.07]
      : [0.28, 0.30, 0.20, 0.22];
    const tipo_red_frecuente = weightedChoice(redes, redWeights);

    // Probabilidad condicional de sufrir incidente: menor cuando uso_2fa === 'Sí'
    let probIncidente = uso_2fa === 'Sí' ? 0.16 : 0.52;
    if (tipo_red_frecuente === 'WiFi Público Abierto') probIncidente += 0.12;
    if (puntaje_practica > 75) probIncidente -= 0.06;
    probIncidente = clamp(probIncidente, 0.06, 0.82);
    const sufrio_incidente = Math.random() < probIncidente ? 'Sí' : 'No';

    // Edad discreta (17 a 30)
    const edad = Math.round(clamp(21.2 + randomNormal() * 2.4, 17, 30));

    // Horas semanales en redes (5.0 a 45.0)
    const horas_redes = Number(clamp(23.5 + randomNormal() * 7.2, 5.0, 45.0).toFixed(1));

    // Contraseñas únicas (1 a 15), correlacionado positivamente con puntaje_practica
    const rawUnicas = 2 + (puntaje_practica / 100) * 8.5 + randomNormal() * 1.8;
    const contrasenas_unicas = Math.round(clamp(rawUnicas, 1, 15));

    // Antigüedad de clave en meses (1 a 24), correlacionado inversamente con práctica
    const rawMeses = 18 - (puntaje_practica / 100) * 11 + randomNormal() * 3.2;
    const antiguedad_clave_meses = Math.round(clamp(rawMeses, 1, 24));

    return {
      id,
      facultad,
      nivel_conocimiento,
      uso_2fa,
      sufrio_incidente,
      tipo_red_frecuente,
      edad,
      horas_redes,
      puntaje_conocimiento,
      puntaje_practica,
      contrasenas_unicas,
      antiguedad_clave_meses
    };
  }

  /**
   * Genera un dataset sintético de tamaño n verificando que la correlación de Pearson
   * entre puntaje_conocimiento y puntaje_practica esté dentro de [0.45, 0.75]
   * y que la tasa de incidentes sea menor cuando uso_2fa === "Sí".
   */
  function generateSyntheticDataset(n) {
    const sampleSize = Number(n) || INITIAL_N;
    let bestSample = [];

    for (let attempt = 0; attempt < 25; attempt++) {
      const targetRho = 0.60;
      const candidate = [];
      for (let i = 1; i <= sampleSize; i++) {
        candidate.push(generateSingleRecord(i, targetRho));
      }

      const xArr = candidate.map(d => d.puntaje_conocimiento);
      const yArr = candidate.map(d => d.puntaje_practica);
      const r = computePearsonR(xArr, yArr);

      const with2fa = candidate.filter(d => d.uso_2fa === 'Sí');
      const no2fa = candidate.filter(d => d.uso_2fa === 'No');
      const incWith2fa = with2fa.length ? with2fa.filter(d => d.sufrio_incidente === 'Sí').length / with2fa.length : 0;
      const incNo2fa = no2fa.length ? no2fa.filter(d => d.sufrio_incidente === 'Sí').length / no2fa.length : 1;

      bestSample = candidate;
      if (r >= 0.45 && r <= 0.75 && incWith2fa < incNo2fa) {
        break;
      }
    }

    return bestSample;
  }

  // ==========================================================================
  // 2. GESTIÓN DE PERSISTENCIA EN LOCALSTORAGE
  // ==========================================================================

  function loadDatasetFromStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id !== undefined) {
          dataset = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('Error leyendo localStorage, se generará muestra inicial:', err);
    }
    dataset = generateSyntheticDataset(INITIAL_N);
    saveDatasetToStorage();
  }

  function saveDatasetToStorage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch (err) {
      console.error('No se pudo guardar en localStorage:', err);
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toastAlert');
    const text = document.getElementById('toastMessage');
    if (!toast || !text) return;
    text.innerHTML = msg;
    toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // ==========================================================================
  // 3. FUNCIONES ESTADÍSTICAS PURAS (DESCRIPTIVA, STURGES, CHI2, OLS)
  // ==========================================================================

  function computeMean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Cuantil muestral mediante interpolación lineal (método R-7 / Excel)
   */
  function computeQuantile(sortedArr, p) {
    const n = sortedArr.length;
    if (n === 0) return 0;
    if (n === 1) return sortedArr[0];
    const pos = (n - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
    }
    return sortedArr[base];
  }

  function computeDescriptiveStats(arr) {
    const n = arr.length;
    if (n === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;
    const mean = computeMean(sorted);
    const median = computeQuantile(sorted, 0.5);

    // Varianza muestral insesgada sobre (n - 1)
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = sorted[i] - mean;
      sumSq += diff * diff;
    }
    const variance = n > 1 ? sumSq / (n - 1) : 0;
    const stdDev = Math.sqrt(variance);
    const cv = Math.abs(mean) > 1e-9 ? (stdDev / Math.abs(mean)) * 100 : 0;

    // Moda(s)
    const freqMap = new Map();
    let maxFreq = 0;
    sorted.forEach(val => {
      const c = (freqMap.get(val) || 0) + 1;
      freqMap.set(val, c);
      if (c > maxFreq) maxFreq = c;
    });

    let modeStr = 'Sin moda (todos únicos)';
    if (maxFreq > 1) {
      const modes = [];
      freqMap.forEach((count, val) => {
        if (count === maxFreq) modes.push(val);
      });
      if (modes.length <= 4) {
        modeStr = `${modes.join(', ')} (f<sub>i</sub>=${maxFreq})`;
      } else {
        modeStr = `Multimodal (${modes.slice(0, 3).join(', ')}..., f<sub>i</sub>=${maxFreq})`;
      }
    }

    return {
      n,
      mean,
      median,
      modeStr,
      min,
      max,
      range,
      variance,
      stdDev,
      cv,
      p10: computeQuantile(sorted, 0.10),
      q1: computeQuantile(sorted, 0.25),
      q2: median,
      q3: computeQuantile(sorted, 0.75),
      p90: computeQuantile(sorted, 0.90)
    };
  }

  /**
   * Distribución de frecuencias agrupadas por Regla de Sturges:
   * k = round(1 + 3.322 * log10(n))
   */
  function computeSturgesGrouped(arr, decimals = 0) {
    const n = arr.length;
    if (n === 0) return null;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;

    const kRaw = 1 + 3.322 * Math.log10(Math.max(1, n));
    const k = Math.max(3, Math.round(kRaw));

    // Amplitud limpia según si la variable admite decimales
    let amplitude;
    if (range === 0) {
      amplitude = 1;
    } else if (decimals > 0) {
      amplitude = Number((Math.ceil((range / k) * 10) / 10).toFixed(1));
      if (amplitude * k <= range) amplitude = Number((amplitude + 0.1).toFixed(1));
    } else {
      amplitude = Math.max(1, Math.ceil(range / k));
      if (amplitude * k < range) amplitude += 1;
    }

    const classes = [];
    let cumF = 0;
    let cumH = 0;

    for (let i = 0; i < k; i++) {
      const li = Number((min + i * amplitude).toFixed(decimals));
      const ls = Number((li + amplitude).toFixed(decimals));
      const xi = Number(((li + ls) / 2).toFixed(decimals + 1));
      const isLast = i === k - 1;

      const fi = arr.filter(v => {
        if (isLast) return v >= li && v <= Math.max(ls, max);
        return v >= li && v < ls;
      }).length;

      cumF += fi;
      const hi = fi / n;
      cumH += hi;
      const pi = hi * 100;
      const Pi = cumH * 100;

      classes.push({
        index: i + 1,
        li,
        ls,
        isLast,
        label: isLast ? `[${li}, ${ls}]` : `[${li}, ${ls})`,
        xi,
        fi,
        Fi: cumF,
        hi,
        Hi: cumH,
        pi,
        Pi
      });
    }

    return { n, min, max, range, kRaw, k, amplitude, classes };
  }

  /**
   * Cálculo exacto del p-valor Chi-Cuadrado en JS puro mediante
   * Función Gamma Incompleta Regularizada P(a, x) y Q(a, x) = 1 - P(a, x)
   */
  function logGamma(z) {
    const c = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.001208650973866179,
      -0.000005395239384953
    ];
    let x = z;
    let y = z;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
      y += 1;
      ser += c[j] / y;
    }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  function regularizedGammaP(a, x) {
    if (x <= 0) return 0;
    if (a <= 0) return 1;
    // Serie de Taylor para x < a + 1
    if (x < a + 1) {
      let ap = a;
      let sum = 1.0 / a;
      let del = sum;
      for (let n = 1; n <= 200; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }
    // Fracción continua de Lentz para x >= a + 1
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1.0) < 1e-12) break;
    }
    const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
    return clamp(1 - q, 0, 1);
  }

  function chiSquarePValue(chiSq, df) {
    if (df <= 0 || chiSq < 0) return 1;
    if (chiSq === 0) return 1;
    const p = regularizedGammaP(df / 2, chiSq / 2);
    return clamp(1 - p, 0, 1);
  }

  function computePearsonR(xArr, yArr) {
    const n = xArr.length;
    if (n < 2) return 0;
    const meanX = computeMean(xArr);
    const meanY = computeMean(yArr);
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xArr[i] - meanX;
      const dy = yArr[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const denom = Math.sqrt(denX * denY);
    return denom > 1e-12 ? num / denom : 0;
  }

  function computeOLSRegression(xArr, yArr) {
    const n = xArr.length;
    if (n < 2) return null;
    const meanX = computeMean(xArr);
    const meanY = computeMean(yArr);
    let ssXY = 0;
    let ssXX = 0;
    let ssYY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xArr[i] - meanX;
      const dy = yArr[i] - meanY;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssYY += dy * dy;
    }
    const b1 = ssXX > 1e-12 ? ssXY / ssXX : 0;
    const b0 = meanY - b1 * meanX;
    const r = Math.sqrt(ssXX * ssYY) > 1e-12 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
    const r2 = r * r;

    const minX = Math.min(...xArr);
    const maxX = Math.max(...xArr);

    return { n, meanX, meanY, b0, b1, r, r2, minX, maxX };
  }

  // ==========================================================================
  // 4. RENDERIZADO DE ENCABEZADO GLOBAL Y MATRIZ DE DATOS
  // ==========================================================================

  function renderGlobalKPIs() {
    const n = dataset.length;
    document.getElementById('sidebarNCount').innerHTML = `${n}`;
    document.getElementById('mobileNCount').innerHTML = `${n}`;
    document.getElementById('kpiSampleN').innerHTML = `${n}`;

    const nextId = n > 0 ? Math.max(...dataset.map(d => d.id)) + 1 : 1;
    const formNextEl = document.getElementById('formNextId');
    if (formNextEl) formNextEl.innerHTML = `${nextId}`;

    const knowArr = dataset.map(d => d.puntaje_conocimiento);
    const knowStats = computeDescriptiveStats(knowArr);
    if (knowStats) {
      document.getElementById('kpiMeanKnow').innerHTML = `${knowStats.mean.toFixed(1)} pts`;
      document.getElementById('kpiSdKnow').innerHTML = `s: &plusmn;${knowStats.stdDev.toFixed(1)} pts (Escala 0-100)`;
    }

    const count2FA = dataset.filter(d => d.uso_2fa === 'Sí').length;
    const rate2FA = n > 0 ? (count2FA / n) * 100 : 0;
    document.getElementById('kpi2faRate').innerHTML = `${rate2FA.toFixed(1)}%`;
    document.getElementById('kpi2faCount').innerHTML = `${count2FA} de ${n} estudiantes`;

    const countInc = dataset.filter(d => d.sufrio_incidente === 'Sí').length;
    const rateInc = n > 0 ? (countInc / n) * 100 : 0;
    document.getElementById('kpiIncidentRate').innerHTML = `${rateInc.toFixed(1)}%`;
    document.getElementById('kpiIncidentCount').innerHTML = `${countInc} casos reportados`;
  }

  function renderDataMatrix() {
    const searchVal = (document.getElementById('matrixSearchInput')?.value || '').trim().toLowerCase();
    const facFilter = document.getElementById('matrixFacultyFilter')?.value || 'ALL';

    let filtered = dataset.filter(row => {
      if (facFilter !== 'ALL' && row.facultad !== facFilter) return false;
      if (!searchVal) return true;
      return Object.values(row).some(val => String(val).toLowerCase().includes(searchVal));
    });

    // Ordenamiento por columna activa
    const col = sortState.column;
    const dir = sortState.asc ? 1 : -1;
    filtered.sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb), 'es') * dir;
    });

    document.getElementById('matrixFilteredCount').innerHTML = `${filtered.length}`;
    document.getElementById('matrixTotalCount').innerHTML = `${dataset.length}`;
    document.getElementById('matrixSortIndicator').innerHTML = `${col} (${sortState.asc ? 'ASC' : 'DESC'})`;

    const tbody = document.getElementById('dataMatrixBody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="py-8 text-center text-muted">
            No se encontraron registros que coincidan con el criterio de filtrado.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const badge2fa = r.uso_2fa === 'Sí'
        ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Sí</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">No</span>';

      const badgeInc = r.sufrio_incidente === 'Sí'
        ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">Sí</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">No</span>';

      return `
        <tr class="hover:bg-slate-50/90 transition">
          <td class="py-2 px-2.5 font-mono font-bold text-petrol">#${r.id}</td>
          <td class="py-2 px-2.5 font-medium">${r.facultad}</td>
          <td class="py-2 px-2.5">${r.nivel_conocimiento}</td>
          <td class="py-2 px-2.5">${badge2fa}</td>
          <td class="py-2 px-2.5">${badgeInc}</td>
          <td class="py-2 px-2.5">${r.tipo_red_frecuente}</td>
          <td class="py-2 px-2.5 text-right">${r.edad}</td>
          <td class="py-2 px-2.5 text-right">${Number(r.horas_redes).toFixed(1)}</td>
          <td class="py-2 px-2.5 text-right font-semibold">${r.puntaje_conocimiento}</td>
          <td class="py-2 px-2.5 text-right font-semibold text-petrol">${r.puntaje_practica}</td>
          <td class="py-2 px-2.5 text-right">${r.contrasenas_unicas}</td>
          <td class="py-2 px-2.5 text-right">${r.antiguedad_clave_meses}</td>
        </tr>`;
    }).join('');
  }

  // ==========================================================================
  // 5. RENDERIZADO DE DISTRIBUCIONES DE FRECUENCIA (CUALITATIVAS Y STURGES)
  // ==========================================================================

  function renderQualitativeFrequencies() {
    const varName = document.getElementById('qualVarSelect')?.value || 'facultad';
    const meta = VARIABLE_META[varName];
    const n = dataset.length;
    const isOrdinal = meta.type === 'ordinal';

    const counts = new Map();
    meta.categories.forEach(c => counts.set(c, 0));
    dataset.forEach(d => {
      const val = d[varName];
      counts.set(val, (counts.get(val) || 0) + 1);
    });

    let cumF = 0;
    let cumH = 0;
    const rows = [];

    counts.forEach((fi, cat) => {
      cumF += fi;
      const hi = n > 0 ? fi / n : 0;
      cumH += hi;
      const pi = hi * 100;
      const Pi = cumH * 100;
      rows.push({ cat, fi, Fi: cumF, hi, Hi: cumH, pi, Pi });
    });

    const headEl = document.getElementById('qualFreqHead');
    const bodyEl = document.getElementById('qualFreqBody');
    const footEl = document.getElementById('qualFreqFoot');

    if (isOrdinal) {
      headEl.innerHTML = `
        <tr>
          <th class="py-2.5 px-3 font-bold">Categoría Ordinal (${meta.label})</th>
          <th class="py-2.5 px-3 font-bold text-right">Frec. Absoluta (f<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Frec. Acumulada (F<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Frec. Relativa (h<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Rel. Acumulada (H<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Porcentaje (p<sub>i</sub>%)</th>
          <th class="py-2.5 px-3 font-bold text-right">Porc. Acumulado (P<sub>i</sub>%)</th>
        </tr>`;
      bodyEl.innerHTML = rows.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="py-2 px-3 font-semibold text-ink">${r.cat}</td>
          <td class="py-2 px-3 text-right">${r.fi}</td>
          <td class="py-2 px-3 text-right text-muted">${r.Fi}</td>
          <td class="py-2 px-3 text-right">${r.hi.toFixed(4)}</td>
          <td class="py-2 px-3 text-right text-muted">${r.Hi.toFixed(4)}</td>
          <td class="py-2 px-3 text-right font-semibold text-petrol">${r.pi.toFixed(2)}%</td>
          <td class="py-2 px-3 text-right font-semibold text-sage">${r.Pi.toFixed(2)}%</td>
        </tr>`).join('');
      footEl.innerHTML = `
        <tr>
          <td class="py-2.5 px-3">Total Muestral (n)</td>
          <td class="py-2.5 px-3 text-right">${n}</td>
          <td class="py-2.5 px-3 text-right">—</td>
          <td class="py-2.5 px-3 text-right">1.0000</td>
          <td class="py-2.5 px-3 text-right">—</td>
          <td class="py-2.5 px-3 text-right">100.00%</td>
          <td class="py-2.5 px-3 text-right">—</td>
        </tr>`;
    } else {
      headEl.innerHTML = `
        <tr>
          <th class="py-2.5 px-3 font-bold">Categoría Nominal (${meta.label})</th>
          <th class="py-2.5 px-3 font-bold text-right">Frecuencia Absoluta (f<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Frecuencia Relativa (h<sub>i</sub>)</th>
          <th class="py-2.5 px-3 font-bold text-right">Frecuencia Porcentual (p<sub>i</sub>%)</th>
        </tr>`;
      bodyEl.innerHTML = rows.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="py-2 px-3 font-semibold text-ink">${r.cat}</td>
          <td class="py-2 px-3 text-right">${r.fi}</td>
          <td class="py-2 px-3 text-right">${r.hi.toFixed(4)}</td>
          <td class="py-2 px-3 text-right font-semibold text-petrol">${r.pi.toFixed(2)}%</td>
        </tr>`).join('');
      footEl.innerHTML = `
        <tr>
          <td class="py-2.5 px-3">Total Muestral (n)</td>
          <td class="py-2.5 px-3 text-right">${n}</td>
          <td class="py-2.5 px-3 text-right">1.0000</td>
          <td class="py-2.5 px-3 text-right">100.00%</td>
        </tr>`;
    }

    // Dibujar gráficos Canvas cualitativos
    drawBarChart('canvasQualBar', rows);
    drawPieChart('canvasQualPie', rows);

    // Interpretación dinámica cualitativa
    const sortedByFreq = [...rows].sort((a, b) => b.fi - a.fi);
    const dominant = sortedByFreq[0];
    const least = sortedByFreq[sortedByFreq.length - 1];

    document.getElementById('interpQualFreq').innerHTML = `
      <h4 class="font-bold text-ink flex items-center gap-1.5">
        <i class="bi bi-lightbulb-fill text-amber-500"></i> ¿Cómo se interpreta? — Distribución de ${meta.label}
      </h4>
      <p class="text-slate-700 leading-relaxed">
        <strong>1. Qué mide el estadístico:</strong> La distribución de frecuencias cualitativas cuantifica cómo se reparte la muestra (n = ${n}) entre categorías mutuamente excluyentes mediante conteos absolutos (f<sub>i</sub>) y proporciones relativas (h<sub>i</sub> = f<sub>i</sub> / n). ${isOrdinal ? 'Al tratarse de una variable <strong>ordinal</strong>, las frecuencias acumuladas (F<sub>i</sub>, P<sub>i</sub>%) son metodológicamente válidas para evaluar umbrales jerárquicos.' : 'Al ser una escala <strong>nominal</strong> sin jerarquía intrínseca, no se reportan frecuencias acumuladas.'}
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>2. Valor actual en el estudio:</strong> La categoría modal predominante es <strong>"${dominant.cat}"</strong> con f<sub>i</sub> = ${dominant.fi} estudiantes (${dominant.pi.toFixed(1)}%), mientras que la menor presencia corresponde a <strong>"${least.cat}"</strong> con f<sub>i</sub> = ${least.fi} (${least.pi.toFixed(1)}%).
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>3. Conclusiones justificadas y limitaciones:</strong> Permite caracterizar la composición demográfica o conductual de los universitarios evaluados en ciberseguridad, pero constituye un análisis descriptivo univariado que no establece relaciones de causa-efecto entre categorías.
      </p>`;
  }

  function renderQuantitativeGroupedFrequencies() {
    const varName = document.getElementById('quantFreqVarSelect')?.value || 'puntaje_conocimiento';
    const meta = VARIABLE_META[varName];
    const arr = dataset.map(d => Number(d[varName]));
    const res = computeSturgesGrouped(arr, meta.decimals);
    if (!res) return;

    document.getElementById('sturgesParamsBadges').innerHTML = `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-[11px] text-muted block">Tamaño (n)</span>
        <strong class="text-ink font-bold">${res.n} obs.</strong>
      </div>
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-[11px] text-muted block">Mínimo / Máximo</span>
        <strong class="text-ink font-bold">${res.min} a ${res.max} ${meta.unit}</strong>
      </div>
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-[11px] text-muted block">Rango (R = X<sub>máx</sub> &minus; X<sub>mín</sub>)</span>
        <strong class="text-ink font-bold">${res.range.toFixed(meta.decimals)} ${meta.unit}</strong>
      </div>
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-[11px] text-muted block">Sturges (k = 1 + 3.322&middot;log<sub>10</sub>(n))</span>
        <strong class="text-petrol font-bold">${res.k} clases (${res.kRaw.toFixed(2)})</strong>
      </div>
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
        <span class="text-[11px] text-muted block">Amplitud (A = R / k)</span>
        <strong class="text-sage font-bold">${res.amplitude} ${meta.unit}</strong>
      </div>`;

    document.getElementById('quantFreqBody').innerHTML = res.classes.map(c => `
      <tr class="hover:bg-slate-50">
        <td class="py-2 px-3 font-semibold text-muted">Clase ${c.index}</td>
        <td class="py-2 px-3 font-mono font-semibold text-ink">${c.label}</td>
        <td class="py-2 px-3 text-right font-mono">${c.xi}</td>
        <td class="py-2 px-3 text-right font-semibold">${c.fi}</td>
        <td class="py-2 px-3 text-right text-muted">${c.Fi}</td>
        <td class="py-2 px-3 text-right">${c.hi.toFixed(4)}</td>
        <td class="py-2 px-3 text-right text-muted">${c.Hi.toFixed(4)}</td>
        <td class="py-2 px-3 text-right font-semibold text-petrol">${c.pi.toFixed(2)}%</td>
        <td class="py-2 px-3 text-right font-semibold text-sage">${c.Pi.toFixed(2)}%</td>
      </tr>`).join('');

    document.getElementById('quantFreqFoot').innerHTML = `
      <tr>
        <td colspan="3" class="py-2.5 px-3">Total Muestral Agrupado (n)</td>
        <td class="py-2.5 px-3 text-right">${res.n}</td>
        <td class="py-2.5 px-3 text-right">—</td>
        <td class="py-2.5 px-3 text-right">1.0000</td>
        <td class="py-2.5 px-3 text-right">—</td>
        <td class="py-2.5 px-3 text-right">100.00%</td>
        <td class="py-2.5 px-3 text-right">—</td>
      </tr>`;

    drawHistogramAndPolygon('canvasHistogram', res.classes, meta.label);

    const modalClass = [...res.classes].sort((a, b) => b.fi - a.fi)[0];
    document.getElementById('interpQuantFreq').innerHTML = `
      <h4 class="font-bold text-ink flex items-center gap-1.5">
        <i class="bi bi-lightbulb-fill text-amber-500"></i> ¿Cómo se interpreta? — Agrupación de Sturges e Histograma (${meta.label})
      </h4>
      <p class="text-slate-700 leading-relaxed">
        <strong>1. Qué mide el procedimiento:</strong> La Regla de Sturges (k = 1 + 3.322&middot;log<sub>10</sub>(${res.n}) &approx; ${res.k} intervalos de amplitud A = ${res.amplitude}) condensa variables cuantitativas en clases contiguas [L<sub>i</sub>, L<sub>s</sub>) con marca de clase X<sub>i</sub>, permitiendo visualizar la forma distribucional, asimetría y concentración mediante el <strong>Histograma</strong> y el <strong>Polígono de Frecuencias</strong>.
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>2. Valor actual en el estudio:</strong> La mayor densidad de estudiantes se concentra en el intervalo modal <strong>${modalClass.label}</strong> (marca de clase X<sub>i</sub> = ${modalClass.xi} ${meta.unit}), que agrupa a f<sub>i</sub> = ${modalClass.fi} universitarios (${modalClass.pi.toFixed(1)}% del total).
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>3. Conclusiones y limitaciones:</strong> El polígono superpuesto facilita identificar dónde se acumula el grueso de la población estudiantil. Como limitación metodológica, al agrupar datos en intervalos se incurre en un <em>error de agrupamiento</em> por pérdida de precisión individual, por lo que los momentos exactos deben consultarse en la pestaña de Estadística Descriptiva.
      </p>`;
  }

  // ==========================================================================
  // 6. RENDERIZADO DE ESTADÍSTICA DESCRIPTIVA
  // ==========================================================================

  function renderDescriptiveSection() {
    const varName = document.getElementById('descVarSelect')?.value || 'puntaje_conocimiento';
    const meta = VARIABLE_META[varName];
    const arr = dataset.map(d => Number(d[varName]));
    const st = computeDescriptiveStats(arr);
    if (!st) return;

    const d = meta.decimals;
    document.getElementById('descMean').innerHTML = `${st.mean.toFixed(2)} ${meta.unit}`;
    document.getElementById('descMedian').innerHTML = `${st.median.toFixed(2)} ${meta.unit}`;
    document.getElementById('descMode').innerHTML = st.modeStr;

    document.getElementById('descMinMax').innerHTML = `${st.min.toFixed(d)} / ${st.max.toFixed(d)} ${meta.unit}`;
    document.getElementById('descRange').innerHTML = `${st.range.toFixed(d)} ${meta.unit}`;
    document.getElementById('descVariance').innerHTML = `${st.variance.toFixed(2)} ${meta.unit}<sup>2</sup>`;
    document.getElementById('descStdDev').innerHTML = `&plusmn;${st.stdDev.toFixed(2)} ${meta.unit}`;
    document.getElementById('descCV').innerHTML = `${st.cv.toFixed(2)}%`;

    document.getElementById('descP10').innerHTML = `${st.p10.toFixed(2)} ${meta.unit}`;
    document.getElementById('descQ1').innerHTML = `${st.q1.toFixed(2)} ${meta.unit}`;
    document.getElementById('descQ2').innerHTML = `${st.q2.toFixed(2)} ${meta.unit}`;
    document.getElementById('descQ3').innerHTML = `${st.q3.toFixed(2)} ${meta.unit}`;
    document.getElementById('descP90').innerHTML = `${st.p90.toFixed(2)} ${meta.unit}`;

    let homogeneityText = 'alta homogeneidad (dispersión baja)';
    if (st.cv >= 15 && st.cv <= 30) homogeneityText = 'variabilidad moderada (heterogeneidad intermedia)';
    else if (st.cv > 30) homogeneityText = 'alta dispersión relativa (muestra heterogénea)';

    const iqr = st.q3 - st.q1;

    document.getElementById('interpDescriptiva').innerHTML = `
      <h4 class="font-bold text-ink flex items-center gap-1.5">
        <i class="bi bi-lightbulb-fill text-amber-500"></i> ¿Cómo se interpreta? — Perfil Descriptivo de ${meta.label}
      </h4>
      <p class="text-slate-700 leading-relaxed">
        <strong>1. Qué miden los estadísticos:</strong> La media (x&#772;) y mediana (Me = Q<sub>2</sub>) resumen el centro de gravedad y el punto medio posicional de la distribución; la varianza muestral s<sup>2</sup> (n &minus; 1), la desviación estándar (s) y el Coeficiente de Variación (CV% = (s / x&#772;) &times; 100) cuantifican la dispersión absoluta y adimensional.
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>2. Valor actual en el estudio:</strong> En los n = ${st.n} universitarios, <strong>${meta.label}</strong> presenta un promedio de x&#772; = ${st.mean.toFixed(2)} ${meta.unit} (s = &plusmn;${st.stdDev.toFixed(2)}) y una mediana de Me = ${st.median.toFixed(2)} ${meta.unit}. El CV% = ${st.cv.toFixed(2)}% indica <strong>${homogeneityText}</strong>, por lo que la media aritmética ${st.cv <= 30 ? 'es altamente representativa' : 'debe complementarse con la mediana y el rango intercuartílico'} (RIC = Q<sub>3</sub> &minus; Q<sub>1</sub> = ${iqr.toFixed(2)} ${meta.unit}).
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>3. Conclusiones y limitaciones:</strong> El 50% central de los estudiantes se ubica entre Q<sub>1</sub> = ${st.q1.toFixed(2)} y Q<sub>3</sub> = ${st.q3.toFixed(2)} ${meta.unit}, mientras que el 10% superior supera P<sub>90</sub> = ${st.p90.toFixed(2)} ${meta.unit}. La limitación principal de x&#772; y s es su sensibilidad a valores extremos (outliers).
      </p>`;
  }

  // ==========================================================================
  // 7. RENDERIZADO DE TABLA DE CONTINGENCIA Y PRUEBA CHI-CUADRADO
  // ==========================================================================

  function renderContingencyAndChiSquare() {
    const rowVar = document.getElementById('chiRowSelect')?.value || 'uso_2fa';
    const colVar = document.getElementById('chiColSelect')?.value || 'sufrio_incidente';
    const rowMeta = VARIABLE_META[rowVar];
    const colMeta = VARIABLE_META[colVar];
    const n = dataset.length;

    document.getElementById('chiH0Text').innerHTML =
      `Las variables <strong>${rowMeta.label}</strong> (<code>${rowVar}</code>) y <strong>${colMeta.label}</strong> (<code>${colVar}</code>) son estadísticamente independientes en la población estudiantil (O<sub>ij</sub> &approx; E<sub>ij</sub>).`;
    document.getElementById('chiH1Text').innerHTML =
      `Existe asociación estadísticamente significativa entre <strong>${rowMeta.label}</strong> y <strong>${colMeta.label}</strong> (&alpha; = 0.05).`;

    const rowCats = rowMeta.categories;
    const colCats = colMeta.categories;
    const R = rowCats.length;
    const C = colCats.length;

    // Matriz de observados O_ij
    const obs = Array.from({ length: R }, () => Array(C).fill(0));
    const rowTotals = Array(R).fill(0);
    const colTotals = Array(C).fill(0);

    dataset.forEach(d => {
      const rIdx = rowCats.indexOf(d[rowVar]);
      const cIdx = colCats.indexOf(d[colVar]);
      if (rIdx !== -1 && cIdx !== -1) {
        obs[rIdx][cIdx]++;
        rowTotals[rIdx]++;
        colTotals[cIdx]++;
      }
    });

    // Cálculo de Esperadas E_ij y estadístico Chi-Cuadrado
    let chiSq = 0;
    let lowExpectedCount = 0;
    const totalCells = R * C;
    const exp = Array.from({ length: R }, () => Array(C).fill(0));

    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        const eij = n > 0 ? (rowTotals[i] * colTotals[j]) / n : 0;
        exp[i][j] = eij;
        if (eij < 5) lowExpectedCount++;
        if (eij > 0) {
          const diff = obs[i][j] - eij;
          chiSq += (diff * diff) / eij;
        }
      }
    }

    const df = (R - 1) * (C - 1);
    const pVal = chiSquarePValue(chiSq, df);
    const rejectH0 = pVal < 0.05;

    // Renderizar Tabla Cruzada
    document.getElementById('chiTableHead').innerHTML = `
      <tr>
        <th class="py-2.5 px-3 font-bold">${rowMeta.label} \\ ${colMeta.label}</th>
        ${colCats.map(c => `<th class="py-2.5 px-3 font-bold text-right">${c}</th>`).join('')}
        <th class="py-2.5 px-3 font-bold text-right bg-slate-200/60">Total Fila (R<sub>i</sub>)</th>
      </tr>`;

    document.getElementById('chiTableBody').innerHTML = rowCats.map((rCat, i) => {
      const cellsHtml = colCats.map((_, j) => {
        const oij = obs[i][j];
        const eij = exp[i][j];
        const rowPct = rowTotals[i] > 0 ? (oij / rowTotals[i]) * 100 : 0;
        const warnClass = eij < 5 ? 'text-amber-700 font-semibold' : 'text-muted';
        return `
          <td class="py-2.5 px-3 text-right">
            <span class="font-bold text-ink text-sm">O<sub>ij</sub>: ${oij}</span>
            <span class="text-[11px] ${warnClass} block">(E<sub>ij</sub>: ${eij.toFixed(2)})</span>
            <span class="text-[10px] text-petrol font-medium block">${rowPct.toFixed(1)}% fila</span>
          </td>`;
      }).join('');

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-petrol">${rCat}</td>
          ${cellsHtml}
          <td class="py-2.5 px-3 text-right font-bold bg-slate-50">${rowTotals[i]} <span class="text-[10px] text-muted block">(100%)</span></td>
        </tr>`;
    }).join('');

    document.getElementById('chiTableFoot').innerHTML = `
      <tr>
        <td class="py-2.5 px-3">Total Columna (C<sub>j</sub>)</td>
        ${colTotals.map(ct => `<td class="py-2.5 px-3 text-right">${ct} <span class="text-[10px] font-normal text-muted block">(${n > 0 ? ((ct / n) * 100).toFixed(1) : 0}%)</span></td>`).join('')}
        <td class="py-2.5 px-3 text-right bg-slate-200/70">n = ${n}</td>
      </tr>`;

    // Poblar tarjetas de resumen Chi-Cuadrado usando .innerHTML
    document.getElementById('chiStatVal').innerHTML = `${chiSq.toFixed(4)}`;
    document.getElementById('chiDfVal').innerHTML = `${df}`;
    document.getElementById('chiPVal').innerHTML = pVal < 0.0001 ? '&lt; 0.0001' : pVal.toFixed(4);
    document.getElementById('chiLowExpected').innerHTML = `${lowExpectedCount} de ${totalCells} (${((lowExpectedCount / totalCells) * 100).toFixed(0)}%)`;

    const badgeEl = document.getElementById('chiDecisionBadge');
    if (rejectH0) {
      badgeEl.innerHTML = 'Se rechaza H<sub>0</sub> (Significativo)';
      badgeEl.className = 'text-xs font-bold inline-block mt-1 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900';
    } else {
      badgeEl.innerHTML = 'No se rechaza H<sub>0</sub> (No sig.)';
      badgeEl.className = 'text-xs font-bold inline-block mt-1 px-2.5 py-0.5 rounded bg-slate-200 text-slate-800';
    }

    const cochranWarn = lowExpectedCount > 0
      ? `Se detectaron <strong>${lowExpectedCount} celdas con frecuencia esperada E<sub>ij</sub> &lt; 5</strong>; según el criterio de Cochran, cuando más del 20% de celdas tienen E<sub>ij</sub> &lt; 5, la aproximación asintótica &chi;<sup>2</sup> pierde potencia y en investigación formal se recomienda aplicar la corrección de Yates o la Prueba Exacta de Fisher.`
      : `Todas las celdas cumplen la condición de validez asintótica (E<sub>ij</sub> &ge; 5), garantizando plena robustez estadística en el cálculo del valor p.`;

    document.getElementById('interpChiSquare').innerHTML = `
      <h4 class="font-bold text-ink flex items-center gap-1.5">
        <i class="bi bi-lightbulb-fill text-amber-500"></i> ¿Cómo se interpreta? — Prueba &chi;<sup>2</sup> de Independencia (${rowMeta.label} vs. ${colMeta.label})
      </h4>
      <p class="text-slate-700 leading-relaxed">
        <strong>1. Qué mide el estadístico:</strong> El estadístico &chi;<sup>2</sup> = &sum;[(O<sub>ij</sub> &minus; E<sub>ij</sub>)<sup>2</sup> / E<sub>ij</sub>] cuantifica la discrepancia global entre las frecuencias observadas en la muestra (O<sub>ij</sub>) y las frecuencias que esperaríamos por mero azar si ambas variables fueran independientes (E<sub>ij</sub> = (R<sub>i</sub> &middot; C<sub>j</sub>) / n).
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>2. Valor actual y decisión estadística:</strong> Se obtuvo &chi;<sup>2</sup> = ${chiSq.toFixed(4)} con gl = ${df} grados de libertad y un valor p = ${pVal < 0.0001 ? '&lt; 0.0001' : pVal.toFixed(4)}. Al comparar con el nivel de significancia &alpha; = 0.05, <strong>${rejectH0 ? 'se rechaza la hipótesis nula (H<sub>0</sub>) y se concluye que sí existe asociación estadísticamente significativa entre ' + rowMeta.label + ' y ' + colMeta.label + ' (se acepta H<sub>1</sub>)' : 'no existe evidencia suficiente para rechazar H<sub>0</sub>, por lo que las diferencias observadas son compatibles con la fluctuación muestral aleatoria'}</strong>.
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>3. Condiciones de validez y limitaciones:</strong> ${cochranWarn} Asimismo, recuerde que &chi;<sup>2</sup> contrasta existencia de asociación pero no mide su dirección causal.
      </p>`;
  }

  // ==========================================================================
  // 8. RENDERIZADO DE CORRELACIÓN DE PEARSON Y REGRESIÓN LINEAL SIMPLE
  // ==========================================================================

  let activeOLSModel = null;

  function renderRegressionSection() {
    const xVar = document.getElementById('regXSelect')?.value || 'puntaje_conocimiento';
    const yVar = document.getElementById('regYSelect')?.value || 'puntaje_practica';
    const xMeta = VARIABLE_META[xVar];
    const yMeta = VARIABLE_META[yVar];

    const xArr = dataset.map(d => Number(d[xVar]));
    const yArr = dataset.map(d => Number(d[yVar]));
    const ols = computeOLSRegression(xArr, yArr);
    if (!ols) return;
    activeOLSModel = { ...ols, xVar, yVar, xMeta, yMeta };

    const absR = Math.abs(ols.r);
    let rDesc = 'Correlación nula / muy débil';
    if (absR >= 0.80) rDesc = `Correlación ${ols.r >= 0 ? 'positiva' : 'negativa'} muy fuerte`;
    else if (absR >= 0.60) rDesc = `Correlación ${ols.r >= 0 ? 'positiva' : 'negativa'} moderada-alta`;
    else if (absR >= 0.40) rDesc = `Correlación ${ols.r >= 0 ? 'positiva' : 'negativa'} moderada`;
    else if (absR >= 0.20) rDesc = `Correlación ${ols.r >= 0 ? 'positiva' : 'negativa'} baja`;

    document.getElementById('regRVal').innerHTML = `${ols.r.toFixed(4)}`;
    document.getElementById('regRStrength').innerHTML = rDesc;
    document.getElementById('regR2Val').innerHTML = `${ols.r2.toFixed(4)}`;
    document.getElementById('regR2Pct').innerHTML = `${(ols.r2 * 100).toFixed(2)}% varianza explicada`;
    document.getElementById('regSlopeVal').innerHTML = `${ols.b1.toFixed(4)}`;
    document.getElementById('regInterceptVal').innerHTML = `${ols.b0.toFixed(4)}`;

    const sign = ols.b1 >= 0 ? '+' : '&minus;';
    document.getElementById('regEquationVal').innerHTML =
      `Y&#770; = ${ols.b0.toFixed(2)} ${sign} ${Math.abs(ols.b1).toFixed(3)}X`;

    // Actualizar configuración de la calculadora de predicción
    document.getElementById('predXLabel').innerHTML = `${xMeta.label} (${xVar})`;
    document.getElementById('predYLabel').innerHTML = `${yMeta.label} (${yVar})`;
    document.getElementById('predAllowedRange').innerHTML =
      `[${ols.minX.toFixed(xMeta.decimals)} , ${ols.maxX.toFixed(xMeta.decimals)}] ${xMeta.unit}`;

    const predInput = document.getElementById('predXInput');
    if (predInput) {
      predInput.min = ols.minX;
      predInput.max = ols.maxX;
      const curVal = Number(predInput.value);
      if (isNaN(curVal) || curVal < ols.minX || curVal > ols.maxX) {
        predInput.value = Number(ols.meanX.toFixed(xMeta.decimals));
      }
      evaluatePrediction();
    }

    // Tabla de Valores Observados, Estimados y Residuales
    const tbody = document.getElementById('regResidualsBody');
    tbody.innerHTML = dataset.map(d => {
      const xi = Number(d[xVar]);
      const yi = Number(d[yVar]);
      const yHat = ols.b0 + ols.b1 * xi;
      const res = yi - yHat;
      const resSq = res * res;
      const resClass = res >= 0 ? 'text-emerald-700' : 'text-amber-800';
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-1.5 px-3 font-mono font-bold text-petrol">#${d.id}</td>
          <td class="py-1.5 px-3 text-right">${xi.toFixed(xMeta.decimals)}</td>
          <td class="py-1.5 px-3 text-right font-semibold">${yi.toFixed(yMeta.decimals)}</td>
          <td class="py-1.5 px-3 text-right font-semibold text-petrol">${yHat.toFixed(2)}</td>
          <td class="py-1.5 px-3 text-right font-mono ${resClass}">${res >= 0 ? '+' : ''}${res.toFixed(2)}</td>
          <td class="py-1.5 px-3 text-right text-muted">${resSq.toFixed(2)}</td>
        </tr>`;
    }).join('');

    // Dibujar Scatter Plot + Recta de Regresión
    drawScatterPlot('canvasScatter', xArr, yArr, ols, xMeta.label, yMeta.label);

    // Interpretación didáctica de Correlación y Regresión
    document.getElementById('interpRegression').innerHTML = `
      <h4 class="font-bold text-ink flex items-center gap-1.5">
        <i class="bi bi-lightbulb-fill text-amber-500"></i> ¿Cómo se interpreta? — Correlación de Pearson y Regresión Lineal (${xMeta.label} &rarr; ${yMeta.label})
      </h4>
      <p class="text-slate-700 leading-relaxed">
        <strong>1. Qué miden r, R<sup>2</sup> y la recta OLS:</strong> El coeficiente de Pearson (r &isin; [&minus;1, 1]) mide la fuerza y sentido de la asociación lineal bivariada; el coeficiente de determinación (R<sup>2</sup>) expresa la proporción de varianza de Y explicada por el predictor X; y la ecuación Y&#770; = b<sub>0</sub> + b<sub>1</sub>X define la recta de ajuste donde la pendiente (b<sub>1</sub>) indica el cambio marginal esperado en Y&#770; por cada unidad adicional en X.
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>2. Valor actual en el estudio:</strong> Se observa un coeficiente r = ${ols.r.toFixed(4)} (<strong>${rDesc.toLowerCase()}</strong>). El modelo Y&#770; = ${ols.b0.toFixed(2)} ${sign} ${Math.abs(ols.b1).toFixed(3)}X presenta un R<sup>2</sup> = ${ols.r2.toFixed(4)}, explicando el <strong>${(ols.r2 * 100).toFixed(2)}%</strong> de la variabilidad en <em>${yMeta.label}</em>. Por cada aumento de 1 ${xMeta.unit} en <em>${xMeta.label}</em>, se estima que <em>${yMeta.label}</em> varía en promedio <strong>${ols.b1 >= 0 ? '+' : ''}${ols.b1.toFixed(3)} ${yMeta.unit}</strong>.
      </p>
      <p class="text-slate-700 leading-relaxed">
        <strong>3. Conclusiones y limitaciones metodológicas:</strong> Aunque el ajuste lineal permite estimar valores esperados dentro del intervalo observado [${ols.minX}, ${ols.maxX}], el diseño transversal observacional impide inferir causalidad directa (<em>correlación no implica causalidad</em>), existiendo posibles variables confusoras no incluidas en la ecuación bivariada.
      </p>`;
  }

  function evaluatePrediction() {
    if (!activeOLSModel) return;
    const inputEl = document.getElementById('predXInput');
    const errEl = document.getElementById('predErrorMsg');
    const outEl = document.getElementById('predResultVal');
    const x0 = Number(inputEl.value);

    if (isNaN(x0) || inputEl.value === '') {
      errEl.innerHTML = 'Ingrese un valor numérico válido para X<sub>0</sub>.';
      errEl.classList.remove('hidden');
      outEl.innerHTML = '--';
      return;
    }

    if (x0 < activeOLSModel.minX || x0 > activeOLSModel.maxX) {
      errEl.innerHTML = `Extrapolación no permitida: X<sub>0</sub> debe estar dentro del rango observado [${activeOLSModel.minX}, ${activeOLSModel.maxX}].`;
      errEl.classList.remove('hidden');
      outEl.innerHTML = 'Fuera de rango';
      return;
    }

    errEl.classList.add('hidden');
    const yHat = activeOLSModel.b0 + activeOLSModel.b1 * x0;
    outEl.innerHTML = `${yHat.toFixed(2)} ${activeOLSModel.yMeta.unit}`;
  }

  // ==========================================================================
  // 9. MOTOR DE VISUALIZACIÓN NATIVO EN HTML5 CANVAS 2D (ALTA DENSIDAD DPI)
  // ==========================================================================

  function setupHiDPICanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(260, rect.width);
    const height = Math.max(200, rect.height);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  /**
   * 1. Gráfico de Barras para Variables Cualitativas
   */
  function drawBarChart(canvasId, rows) {
    const setup = setupHiDPICanvas(canvasId);
    if (!setup || !rows.length) return;
    const { ctx, width, height } = setup;

    const pad = { top: 26, right: 20, bottom: 48, left: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const maxF = Math.max(...rows.map(r => r.fi), 1);
    const yMax = Math.ceil(maxF * 1.15);

    // Líneas guía horizontales
    ctx.strokeStyle = '#E2E8F0';
    ctx.fillStyle = '#64748B';
    ctx.font = '11px Inter, sans-serif';
    ctx.lineWidth = 1;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((yMax / steps) * i);
      const y = pad.top + plotH - (val / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(val, pad.left - 8, y + 4);
    }

    // Dibujar barras
    const slotW = plotW / rows.length;
    const barW = Math.min(54, slotW * 0.58);

    rows.forEach((r, idx) => {
      const x = pad.left + idx * slotW + (slotW - barW) / 2;
      const barH = (r.fi / yMax) * plotH;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = CHART_COLORS[idx % CHART_COLORS.length];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]) : ctx.rect(x, y, barW, barH);
      ctx.fill();

      // Etiqueta superior (f_i y p_i%)
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.fi} (${r.pi.toFixed(1)}%)`, x + barW / 2, y - 6);

      // Etiqueta eje X
      ctx.fillStyle = '#475569';
      ctx.font = '11px Inter, sans-serif';
      const shortCat = r.cat.length > 16 ? r.cat.slice(0, 14) + '…' : r.cat;
      ctx.fillText(shortCat, x + barW / 2, pad.top + plotH + 18);
    });
  }

  /**
   * 2. Gráfico Circular (Sectores / Dona) para Variables Cualitativas
   */
  function drawPieChart(canvasId, rows) {
    const setup = setupHiDPICanvas(canvasId);
    if (!setup || !rows.length) return;
    const { ctx, width, height } = setup;

    const total = rows.reduce((acc, r) => acc + r.fi, 0) || 1;
    const isCompact = width < 380;
    const cx = isCompact ? width * 0.34 : width * 0.32;
    const cy = height * 0.5;
    const radius = Math.min(cx - 16, cy - 20, 88);

    let startAngle = -Math.PI / 2;

    rows.forEach((r, idx) => {
      const sliceAngle = (r.fi / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const color = CHART_COLORS[idx % CHART_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Etiqueta porcentual dentro del sector si es suficientemente amplio
      if (r.pi >= 8) {
        const midAngle = startAngle + sliceAngle / 2;
        const tx = cx + Math.cos(midAngle) * (radius * 0.64);
        const ty = cy + Math.sin(midAngle) * (radius * 0.64);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${r.pi.toFixed(0)}%`, tx, ty + 3);
      }

      startAngle = endAngle;
    });

    // Leyenda lateral derecha
    const legendX = cx + radius + 22;
    let legendY = Math.max(24, cy - (rows.length * 24) / 2);

    rows.forEach((r, idx) => {
      const color = CHART_COLORS[idx % CHART_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY, 12, 12);

      ctx.fillStyle = '#263238';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      const labelText = `${r.cat}: ${r.fi} (${r.pi.toFixed(1)}%)`;
      ctx.fillText(labelText, legendX + 18, legendY + 10);
      legendY += 24;
    });
  }

  /**
   * 3. Histograma con Polígono de Frecuencias Superpuesto
   */
  function drawHistogramAndPolygon(canvasId, classes, varLabel) {
    const setup = setupHiDPICanvas(canvasId);
    if (!setup || !classes.length) return;
    const { ctx, width, height } = setup;

    const pad = { top: 28, right: 24, bottom: 52, left: 46 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const maxF = Math.max(...classes.map(c => c.fi), 1);
    const yMax = Math.ceil(maxF * 1.18);

    // Rejilla horizontal
    ctx.strokeStyle = '#E2E8F0';
    ctx.fillStyle = '#64748B';
    ctx.font = '11px Inter, sans-serif';
    ctx.lineWidth = 1;

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((yMax / ySteps) * i);
      const y = pad.top + plotH - (val / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(val, pad.left - 8, y + 4);
    }

    const k = classes.length;
    const barW = plotW / k;
    const polygonPoints = [];

    // Barras contiguas del histograma
    classes.forEach((c, idx) => {
      const x = pad.left + idx * barW;
      const barH = (c.fi / yMax) * plotH;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = 'rgba(36, 91, 112, 0.78)';
      ctx.fillRect(x, y, barW, barH);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, barW, barH);

      const midX = x + barW / 2;
      polygonPoints.push({ x: midX, y, fi: c.fi, xi: c.xi });

      // Frecuencia absoluta sobre cada barra
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.fi, midX, y - 7);

      // Etiqueta de intervalo y marca de clase en eje X
      ctx.fillStyle = '#475569';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(c.label, midX, pad.top + plotH + 16);
      ctx.fillStyle = '#64748B';
      ctx.fillText(`Xᵢ=${c.xi}`, midX, pad.top + plotH + 30);
    });

    // Polígono de frecuencias superpuesto
    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.moveTo(pad.left, pad.top + plotH);
    polygonPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.stroke();

    // Nodos en las marcas de clase X_i
    polygonPoints.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#F2C66D';
      ctx.fill();
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Título eje X
    ctx.fillStyle = '#263238';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Intervalos de Clase y Marca de Clase (${varLabel})`, pad.left + plotW / 2, height - 6);
  }

  /**
   * 4. Diagrama de Dispersión (Scatter Plot) + Recta de Regresión Lineal OLS
   */
  function drawScatterPlot(canvasId, xArr, yArr, ols, xLabel, yLabel) {
    const setup = setupHiDPICanvas(canvasId);
    if (!setup || !xArr.length) return;
    const { ctx, width, height } = setup;

    const pad = { top: 24, right: 24, bottom: 44, left: 50 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const xPad = (ols.maxX - ols.minX) * 0.08 || 1;
    const minY = Math.min(...yArr);
    const maxY = Math.max(...yArr);
    const yPad = (maxY - minY) * 0.10 || 1;

    const xMin = ols.minX - xPad;
    const xMax = ols.maxX + xPad;
    const yMin = minY - yPad;
    const yMax = maxY + yPad;

    const toCanvasX = x => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const toCanvasY = y => pad.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // Rejilla cartesiana
    ctx.strokeStyle = '#E2E8F0';
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Inter, sans-serif';
    ctx.lineWidth = 1;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const yVal = yMin + ((yMax - yMin) / steps) * i;
      const cy = toCanvasY(yVal);
      ctx.beginPath();
      ctx.moveTo(pad.left, cy);
      ctx.lineTo(pad.left + plotW, cy);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(yVal.toFixed(1), pad.left - 6, cy + 3);

      const xVal = xMin + ((xMax - xMin) / steps) * i;
      const cx = toCanvasX(xVal);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(xVal.toFixed(1), cx, pad.top + plotH + 15);
    }

    // Recta de Regresión Lineal en el dominio observado [minX, maxX]
    const rx1 = ols.minX;
    const ry1 = ols.b0 + ols.b1 * rx1;
    const rx2 = ols.maxX;
    const ry2 = ols.b0 + ols.b1 * rx2;

    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.6;
    ctx.moveTo(toCanvasX(rx1), toCanvasY(ry1));
    ctx.lineTo(toCanvasX(rx2), toCanvasY(ry2));
    ctx.stroke();

    // Puntos observados (x_i, y_i)
    for (let i = 0; i < xArr.length; i++) {
      const px = toCanvasX(xArr[i]);
      const py = toCanvasY(yArr[i]);
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(36, 91, 112, 0.80)';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Etiquetas de ejes
    ctx.fillStyle = '#263238';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`X: ${xLabel}`, pad.left + plotW / 2, height - 8);

    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Y: ${yLabel}`, 0, 0);
    ctx.restore();
  }

  // ==========================================================================
  // 10. ACTUALIZACIÓN INTEGRAL Y EVENTOS DE INTERFAZ
  // ==========================================================================

  function updateAllCalculationsAndCharts() {
    renderGlobalKPIs();
    renderDataMatrix();
    renderQualitativeFrequencies();
    renderQuantitativeGroupedFrequencies();
    renderDescriptiveSection();
    renderContingencyAndChiSquare();
    renderRegressionSection();
  }

  function exportDatasetToCSV() {
    if (!dataset.length) return;
    const headers = [
      'id',
      'facultad',
      'nivel_conocimiento',
      'uso_2fa',
      'sufrio_incidente',
      'tipo_red_frecuente',
      'edad',
      'horas_redes',
      'puntaje_conocimiento',
      'puntaje_practica',
      'contrasenas_unicas',
      'antiguedad_clave_meses'
    ];
    const csvRows = [headers.join(',')];
    dataset.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(','));
    });

    // BOM UTF-8 para compatibilidad directa con Excel en español
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciberseguridad_universitaria_n${dataset.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Archivo CSV exportado correctamente (n = ${dataset.length})`);
  }

  function initEventListeners() {
    // 1. Navegación por pestañas (Escritorio y Móvil)
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const mobileDrawer = document.getElementById('mobileMenuDrawer');
    const mobileMenuIcon = document.getElementById('mobileMenuIcon');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        navButtons.forEach(b => {
          if (b.getAttribute('data-tab') === targetId) b.classList.add('active-nav');
          else b.classList.remove('active-nav');
        });
        tabPanels.forEach(panel => {
          if (panel.id === targetId) panel.classList.add('active');
          else panel.classList.remove('active');
        });
        if (mobileDrawer && !mobileDrawer.classList.contains('hidden')) {
          mobileDrawer.classList.add('hidden');
          if (mobileMenuIcon) mobileMenuIcon.className = 'bi bi-list text-xl';
        }
        // Redibujar gráficos de la pestaña activa para asegurar dimensiones exactas
        requestAnimationFrame(() => {
          renderQualitativeFrequencies();
          renderQuantitativeGroupedFrequencies();
          renderRegressionSection();
        });
      });
    });

    // Botón menú móvil
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn && mobileDrawer) {
      mobileMenuBtn.addEventListener('click', () => {
        const isHidden = mobileDrawer.classList.toggle('hidden');
        if (mobileMenuIcon) {
          mobileMenuIcon.className = isHidden ? 'bi bi-list text-xl' : 'bi bi-x-lg text-xl';
        }
      });
    }

    // Impresión limpia
    document.getElementById('btnPrintReport')?.addEventListener('click', () => {
      window.print();
    });

    // 2. Formulario para agregar nuevo registro manual
    const surveyForm = document.getElementById('surveyForm');
    if (surveyForm) {
      surveyForm.addEventListener('submit', e => {
        e.preventDefault();
        const nextId = dataset.length > 0 ? Math.max(...dataset.map(d => d.id)) + 1 : 1;
        const newRecord = {
          id: nextId,
          facultad: document.getElementById('f_facultad').value,
          nivel_conocimiento: document.getElementById('f_nivel_conocimiento').value,
          uso_2fa: document.getElementById('f_uso_2fa').value,
          sufrio_incidente: document.getElementById('f_sufrio_incidente').value,
          tipo_red_frecuente: document.getElementById('f_tipo_red_frecuente').value,
          edad: clamp(Math.round(Number(document.getElementById('f_edad').value)), 17, 30),
          horas_redes: Number(clamp(Number(document.getElementById('f_horas_redes').value), 5, 45).toFixed(1)),
          puntaje_conocimiento: clamp(Math.round(Number(document.getElementById('f_puntaje_conocimiento').value)), 0, 100),
          puntaje_practica: clamp(Math.round(Number(document.getElementById('f_puntaje_practica').value)), 0, 100),
          contrasenas_unicas: clamp(Math.round(Number(document.getElementById('f_contrasenas_unicas').value)), 1, 15),
          antiguedad_clave_meses: clamp(Math.round(Number(document.getElementById('f_antiguedad_clave_meses').value)), 1, 24)
        };

        dataset.push(newRecord);
        saveDatasetToStorage();
        updateAllCalculationsAndCharts();
        showToast(`Registro #${nextId} guardado en localStorage (n = ${dataset.length})`);
      });
    }

    // 3. Generación y restauración de muestras
    const syncSampleSelects = val => {
      const gSel = document.getElementById('globalSampleSize');
      const mSel = document.getElementById('matrixSampleSizeSelect');
      if (gSel) gSel.value = String(val);
      if (mSel) mSel.value = String(val);
    };

    document.getElementById('btnGlobalRegenerate')?.addEventListener('click', () => {
      const n = Number(document.getElementById('globalSampleSize')?.value || 50);
      syncSampleSelects(n);
      dataset = generateSyntheticDataset(n);
      saveDatasetToStorage();
      updateAllCalculationsAndCharts();
      showToast(`Nueva muestra sintética generada y almacenada (n = ${n})`);
    });

    document.getElementById('btnMatrixGenerate')?.addEventListener('click', () => {
      const n = Number(document.getElementById('matrixSampleSizeSelect')?.value || 50);
      syncSampleSelects(n);
      dataset = generateSyntheticDataset(n);
      saveDatasetToStorage();
      updateAllCalculationsAndCharts();
      showToast(`Nueva muestra sintética generada y almacenada (n = ${n})`);
    });

    document.getElementById('btnMatrixRestore')?.addEventListener('click', () => {
      syncSampleSelects(INITIAL_N);
      dataset = generateSyntheticDataset(INITIAL_N);
      saveDatasetToStorage();
      updateAllCalculationsAndCharts();
      showToast(`Muestra restaurada a tamaño inicial (n = ${INITIAL_N})`);
    });

    document.getElementById('btnExportCSV')?.addEventListener('click', exportDatasetToCSV);

    // 4. Búsqueda, filtrado y ordenamiento de la matriz
    document.getElementById('matrixSearchInput')?.addEventListener('input', renderDataMatrix);
    document.getElementById('matrixFacultyFilter')?.addEventListener('change', renderDataMatrix);

    document.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (sortState.column === col) {
          sortState.asc = !sortState.asc;
        } else {
          sortState.column = col;
          sortState.asc = true;
        }
        renderDataMatrix();
      });
    });

    // 5. Selectores de procedimientos estadísticos
    document.getElementById('qualVarSelect')?.addEventListener('change', renderQualitativeFrequencies);
    document.getElementById('quantFreqVarSelect')?.addEventListener('change', renderQuantitativeGroupedFrequencies);
    document.getElementById('descVarSelect')?.addEventListener('change', renderDescriptiveSection);
    document.getElementById('chiRowSelect')?.addEventListener('change', renderContingencyAndChiSquare);
    document.getElementById('chiColSelect')?.addEventListener('change', renderContingencyAndChiSquare);
    document.getElementById('regXSelect')?.addEventListener('change', renderRegressionSection);
    document.getElementById('regYSelect')?.addEventListener('change', renderRegressionSection);

    // 6. Calculadora de predicción OLS
    document.getElementById('btnCalcPrediction')?.addEventListener('click', evaluatePrediction);
    document.getElementById('predXInput')?.addEventListener('input', evaluatePrediction);

    // 7. ResizeObserver para hacer los gráficos Canvas 100% responsivos
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => {
        renderQualitativeFrequencies();
        renderQuantitativeGroupedFrequencies();
        renderRegressionSection();
      });
      ['canvasQualBar', 'canvasQualPie', 'canvasHistogram', 'canvasScatter'].forEach(id => {
        const el = document.getElementById(id)?.parentElement;
        if (el) ro.observe(el);
      });
    } else {
      window.addEventListener('resize', () => {
        renderQualitativeFrequencies();
        renderQuantitativeGroupedFrequencies();
        renderRegressionSection();
      });
    }
  }

  // Inicialización al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    loadDatasetFromStorage();
    initEventListeners();
    updateAllCalculationsAndCharts();
  });
})();
