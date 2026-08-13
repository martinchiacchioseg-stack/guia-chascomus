// ==========================================================================
// GUÍA CHASCOMÚS - CLIENT APPLICATION LOGIC (v15.0 - TOP MENU & REFINED UI)
// Branding: Desarrollado por rolϕ
// WhatsApp: 5492241527357
// ==========================================================================

const state = {
  rubros: [],
  farmacias: [],
  popups: [],
  activePopup: null,
  listings: [],
  eventosMunicipales: [],
  selectedRubro: 'todos',
  searchQuery: '',
  showSubmitModal: false,
  showAdModal: false,
  showAdminModal: false,
  showListingFormModal: false,
  showPharmacyFormModal: false,
  showPopupFormModal: false,
  showRubroFormModal: false,
  showEventFormModal: false,
  showEventDetailModal: false,
  activeEvent: null,
  editingItem: null,
  isAdmin: false,
  adminToken: null,
  adminTab: 'pending',
  pendingSubmissions: [],
  whatsappAdmin: '5492241527357',
  
  // AI Assistant State - ROLFI
  showAiChat: false,
  aiInputText: '',
  aiMessages: [
    {
      sender: 'bot',
      text: '¡Hola! 👋 Soy **Rolfi**, tu Asistente Virtual en Guía Chascomús. Pregúntame lo que quieras y te guiaré (ej: "necesito un plomero urgente", "farmacia de guardia", "eventos del municipio").'
    }
  ]
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const SYNONYMS_MAP = {
  agua: ['plomeria', 'plomero', 'canilla', 'caño', 'humedad', 'tanque', 'termo', 'bomba', 'perdida'],
  gas: ['plomeria', 'gasista', 'garrafa', 'cocina', 'estufa', 'calefaccion'],
  luz: ['electricidad', 'electricista', 'térmica', 'cable', 'enchufe', 'corto', 'lámpara', 'luces'],
  comida: ['gastronomia', 'pizzeria', 'pizza', 'empanada', 'hamburguesa', 'resto', 'almuerzo', 'cena', 'delivery', 'comidas', 'rotiseria'],
  viaje: ['remises', 'remis', 'taxi', 'traslado', 'chofer', 'flete', 'comisionista'],
  mueble: ['carpinteria', 'carpintero', 'placard', 'madera', 'mesa', 'silla', 'abertura'],
  pared: ['albanileria', 'albañil', 'reforma', 'cemento', 'ladrillo', 'pintura', 'construccion'],
  remedio: ['farmacias', 'farmacia', 'medicamento', 'receta', 'guardia', 'salud', 'remedios'],
  perro: ['veterinarias', 'veterinaria', 'mascota', 'gato', 'vacuna', 'alimento'],
  casa: ['inmobiliarias', 'alquiler', 'departamento', 'terreno', 'venta', 'propiedad', 'cabañas', 'hotel', 'turismo']
};

function performSmartSearch(query) {
  if (!query || !query.trim()) return state.listings;
  
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  return state.listings.filter(l => {
    const textToMatch = `${l.nombre} ${l.descripcion} ${l.rubroNombre} ${l.direccion}`.toLowerCase();
    
    if (textToMatch.includes(q)) return true;
    
    const matchesWord = words.some(w => w.length > 2 && textToMatch.includes(w));
    if (matchesWord) return true;

    for (const [key, synonyms] of Object.entries(SYNONYMS_MAP)) {
      const userAskedConcept = words.some(w => w.includes(key) || synonyms.includes(w));
      if (userAskedConcept) {
        const listingMatchesConcept = textToMatch.includes(key) || synonyms.some(s => textToMatch.includes(s));
        if (listingMatchesConcept) return true;
      }
    }

    return false;
  });
}

function getPharmDutyDateInfo() {
  const now = new Date();
  const hours = now.getHours();

  let targetDate = new Date(now);
  if (hours < 8) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dayNum = targetDate.getDate();
  const monthNum = targetDate.getMonth() + 1;
  const yearNum = targetDate.getFullYear();

  const d = String(dayNum).padStart(2, '0');
  const m = String(monthNum).padStart(2, '0');

  return {
    dayNum,
    monthNum,
    yearNum,
    fullDate: `${d}/${m}/${yearNum}`,
    shortDate: `${d}/${m}`,
    altShortDate: `${dayNum}/${monthNum}`,
    dayName: DIAS_SEMANA[targetDate.getDay()]
  };
}

function isPharmDeTurnoToday(f) {
  if (f.deTurno) return true;

  const dutyInfo = getPharmDutyDateInfo();

  if (f.fechasTurno && Array.isArray(f.fechasTurno) && f.fechasTurno.length > 0) {
    const isMatch = f.fechasTurno.some(raw => {
      if (!raw) return false;
      const str = String(raw).trim();
      
      if (/^\d{1,2}$/.test(str)) {
        return parseInt(str, 10) === dutyInfo.dayNum;
      }
      
      const parts = str.split(/[\/\.\-]/).map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
      if (parts.length >= 2) {
        const pDay = parts[0];
        const pMonth = parts[1];
        return pDay === dutyInfo.dayNum && pMonth === dutyInfo.monthNum;
      }

      return (
        str === dutyInfo.fullDate ||
        str === dutyInfo.shortDate ||
        str === dutyInfo.altShortDate ||
        str.includes(dutyInfo.shortDate) ||
        str.includes(dutyInfo.altShortDate)
      );
    });

    if (isMatch) return true;
  }

  if (f.diasTurno && Array.isArray(f.diasTurno) && f.diasTurno.length > 0) {
    const hoyNombre = dutyInfo.dayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return f.diasTurno.some(d => {
      const dNorm = String(d).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return dNorm === hoyNombre;
    });
  }

  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAppData();
  renderApp();
  checkInitialPopup();
});

async function loadAppData() {
  try {
    const [rubrosRes, farmaciasRes, popupsRes, listingsRes, eventsRes] = await Promise.all([
      fetch('/api/rubros'),
      fetch('/api/pharmacies'),
      fetch('/api/popups'),
      fetch('/api/listings'),
      fetch('/api/events')
    ]);

    state.rubros = await rubrosRes.json();
    state.farmacias = await farmaciasRes.json();
    state.popups = await popupsRes.json();
    state.listings = await listingsRes.json();
    state.eventosMunicipales = await eventsRes.json();

    if (state.isAdmin && state.adminToken) {
      await fetchPendingSubmissions();
    }
  } catch (err) {
    console.error('Error cargando datos de la API:', err);
  }
}

function checkInitialPopup() {
  const mainPopup = state.popups.find(p => p.ubicacion === 'portada' && p.activo);
  if (mainPopup && !sessionStorage.getItem('ad_closed_portada')) {
    state.activePopup = mainPopup;
    state.showAdModal = true;
    renderApp();
  }
}

function checkCategoryPopup(rubroId) {
  const categoryPopup = state.popups.find(p => p.ubicacion === rubroId && p.activo);
  if (categoryPopup && !sessionStorage.getItem(`ad_closed_${rubroId}`)) {
    state.activePopup = categoryPopup;
    state.showAdModal = true;
    renderApp();
  }
}

window.checkPharmacyPopup = function(pharmacyId) {
  const targetKey = 'pharmacy_' + pharmacyId;
  const pharmPopup = state.popups.find(p => (p.ubicacion === targetKey || p.ubicacion === pharmacyId) && p.activo);
  if (pharmPopup && !sessionStorage.getItem(`ad_closed_${targetKey}`)) {
    state.activePopup = pharmPopup;
    state.showAdModal = true;
    renderApp();
  }
};

window.closeAdModal = function() {
  state.showAdModal = false;
  if (state.activePopup) {
    sessionStorage.setItem(`ad_closed_${state.activePopup.ubicacion}`, 'true');
  }
  state.activePopup = null;
  renderApp();
};

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    ${renderNavbar()}
    ${renderHero()}
    
    <main class="main-container">
      ${renderFarmaciasSection()}
      ${renderMunicipalEventsSection()}
      ${renderRubrosSection()}
      ${renderListingsSection()}
    </main>

    ${renderFooter()}
    
    ${renderAiAssistantWidget()}

    ${state.showAdModal ? renderAdModal() : ''}
    ${state.showSubmitModal ? renderSubmitModal() : ''}
    ${state.showAdminModal ? renderAdminModal() : ''}
    ${state.showListingFormModal ? renderListingFormModal() : ''}
    ${state.showPharmacyFormModal ? renderPharmacyFormModal() : ''}
    ${state.showPopupFormModal ? renderPopupFormModal() : ''}
    ${state.showRubroFormModal ? renderRubroFormModal() : ''}
    ${state.showEventFormModal ? renderEventFormModal() : ''}
    ${state.showEventDetailModal ? renderEventDetailModal() : ''}
  `;
}

function renderNavbar() {
  return `
    <header class="navbar">
      <div class="navbar-container">
        <div class="brand" onclick="window.resetFilters()">
          <div class="brand-icon">🏛️</div>
          <div class="brand-text">
            <h1>Guía Chascomús</h1>
            <span class="dev-badge">Desarrollado por <span class="phi">rolϕ</span></span>
          </div>
        </div>

        <nav class="top-menu-links">
          <a href="#hero-section" onclick="window.resetFilters()">🏠 Inicio</a>
          <a href="#pharmacies-section">❇️ Farmacia de Guardia</a>
          <a href="#rubros-section">🏷️ Categorías</a>
          <a href="#muni-section">🏛️ Novedades Municipales</a>
          <a href="javascript:void(0)" onclick="window.toggleAiChat()">🤖 Rolfi</a>
        </nav>
        
        <div class="nav-actions">
          <button class="btn btn-whatsapp" onclick="window.openWhatsAppAdmin()">
            💬 WhatsApp
          </button>
          <button class="btn btn-primary" onclick="window.openSubmitModal()">
            ➕ Publicá Gratis
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderHero() {
  return `
    <section class="hero" id="hero-section">
      <div class="hero-bg-pattern"></div>
      <div class="hero-content">
        <div class="hero-badge">📍 Chascomús, Buenos Aires</div>
        <h2>Directorio Digital de Comercios & Servicios</h2>
        <p style="font-size: 1.05rem; font-weight: 500; margin-bottom: 12px; opacity: 0.95;">
          🤖 <strong>Rolfi:</strong> <em>Pregúntale lo que quieras y te guiará</em>
        </p>
        
        <form onsubmit="window.handleHeroAiSubmit(event)" class="search-box" style="border: 2px solid #8b5cf6;">
          <input 
            type="text" 
            id="heroAiInput" 
            placeholder="Pregúntale a Rolfi lo que querés encontrar en Chascomús..."
            value="${state.searchQuery}"
          />
          <button type="submit" class="btn btn-ai">✨ Preguntar a Rolfi</button>
        </form>
      </div>
    </section>
  `;
}

function renderPharmCard(f, isDeTurno) {
  const dutyInfo = getPharmDutyDateInfo();
  const hasAd = state.popups.some(p => (p.ubicacion === 'pharmacy_' + f.id || p.ubicacion === f.id) && p.activo);
  const mapLink = f.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(f.nombre)}+Chascomus`;

  return `
    <div class="pharmacy-card" onclick="window.checkPharmacyPopup('${f.id}')" style="cursor: pointer; border-color: #10b981; background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div class="pharmacy-badge-guardia">❇️ DE GUARDIA</div>
          ${hasAd ? '<span style="font-size: 0.7rem; background: var(--accent-gold); color: white; padding: 2px 6px; border-radius: 99px; font-weight: 700;">📢 PROMO</span>' : ''}
        </div>
        
        <h4>${f.nombre}</h4>
        <div class="pharmacy-info">
          <span>📍 ${f.direccion}</span>
          ${f.telefono ? `<span>📞 <strong>${f.telefono}</strong></span>` : ''}
          
          ${f.fechasTurno && f.fechasTurno.length > 0 ? `
            <div style="margin-top: 4px;">
              <strong style="font-size: 0.75rem; color: var(--text-main);">Fechas:</strong>
              ${f.fechasTurno.map(fecha => {
                const isToday = isPharmDeTurnoToday(f) && (fecha.includes(dutyInfo.shortDate) || fecha.includes(dutyInfo.altShortDate));
                return `<span class="day-badge" style="${isToday ? 'background: #10b981; color: white; font-weight: 800;' : ''}">${fecha}</span>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="pharmacy-actions">
        ${f.telefono ? `<a href="tel:${f.telefono}" class="btn btn-outline" style="flex:1;" onclick="event.stopPropagation(); window.checkPharmacyPopup('${f.id}');">📞 Llamar</a>` : ''}
        <a href="${mapLink}" target="_blank" class="btn btn-primary" style="background: linear-gradient(135deg, #10b981, #059669); flex:1;" onclick="event.stopPropagation(); window.checkPharmacyPopup('${f.id}');">📍 Mapa</a>
      </div>
    </div>
  `;
}

function renderFarmaciasSection() {
  if (!state.farmacias || state.farmacias.length === 0) return '';

  const dutyInfo = getPharmDutyDateInfo();
  const deTurno = state.farmacias.filter(f => isPharmDeTurnoToday(f));

  if (deTurno.length === 0) {
    return `
      <section id="pharmacies-section" style="margin-bottom: 24px; scroll-margin-top: 70px;">
        <div class="section-title">
          <h3>❇️ Farmacia de Guardia hoy en Chascomús</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Hoy ${dutyInfo.dayName} ${dutyInfo.shortDate} — Guardia 08:00 a 08:00 hs</span>
        </div>
        <div style="background: white; padding: 14px 18px; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.9rem; color: var(--text-muted); text-align: center;">
          No hay farmacias de guardia configuradas para la fecha de hoy. Podés asignarlas desde el Panel de Administración.
        </div>
      </section>
    `;
  }

  return `
    <section id="pharmacies-section" style="margin-bottom: 24px; scroll-margin-top: 70px;">
      <div class="section-title">
        <h3>❇️ Farmacia de Guardia activa hoy en Chascomús</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Hoy ${dutyInfo.dayName} ${dutyInfo.shortDate} — Guardia 08:00 a 08:00 hs</span>
      </div>
      
      <div class="pharmacy-card-grid">
        ${deTurno.map(f => renderPharmCard(f, true)).join('')}
      </div>
    </section>
  `;
}

function renderMunicipalEventsSection() {
  if (!state.eventosMunicipales || state.eventosMunicipales.length === 0) return '';

  return `
    <section id="muni-section" style="margin-bottom: 24px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid #bae6fd; scroll-margin-top: 70px;">
      <div style="margin-bottom: 8px;">
        <h3 style="font-size: 1.05rem; color: #0369a1; font-weight: 800; display: flex; align-items: center; gap: 6px; margin: 0;">
          🏛️ Novedades & Eventos Municipales
        </h3>
        <span style="font-size: 0.78rem; color: #0284c7;">
          Hacé clic en cualquier comunicado para ver la información completa.
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
        ${state.eventosMunicipales.map(evt => `
          <div 
            onclick="window.openEventDetailModal('${evt.id}')"
            style="background: white; border-radius: var(--radius-sm); border: 1px solid #bae6fd; padding: 8px 10px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.15s ease;"
            onmouseover="this.style.transform='translateY(-2px)'"
            onmouseout="this.style.transform='none'"
          >
            <span style="background: #e0f2fe; color: #0369a1; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 99px; text-transform: uppercase;">
              ${evt.categoria || 'Municipal'}
            </span>
            <h4 style="font-size: 0.88rem; font-weight: 700; margin: 4px 0 2px; color: var(--text-main); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${evt.titulo}
            </h4>
            <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">
              📅 ${evt.fecha}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderEventDetailModal() {
  const evt = state.activeEvent;
  if (!evt) return '';

  return `
    <div class="modal-overlay">
      <div class="form-modal-content" style="max-width: 550px;">
        <button class="modal-close-btn" onclick="window.closeEventDetailModal()">✕</button>
        ${evt.imagen ? `<img src="${evt.imagen}" style="width:100%; max-height:220px; object-fit:cover; border-radius:var(--radius-md); margin-bottom:14px;" />` : ''}
        <span style="background: #e0f2fe; color: #0369a1; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-transform: uppercase;">
          ${evt.categoria || 'Municipal'}
        </span>
        <h3 style="font-size: 1.25rem; margin: 10px 0 6px; color: var(--text-main);">${evt.titulo}</h3>
        <div style="font-size: 0.85rem; color: #0284c7; font-weight: 600; margin-bottom: 12px;">
          📅 ${evt.fecha} — 📍 ${evt.lugar}
        </div>
        <div style="font-size: 0.92rem; color: var(--text-main); line-height: 1.5; white-space: pre-line; margin-bottom: 20px;">
          ${evt.descripcion}
        </div>
        ${evt.oficialLink ? `
          <a href="${evt.oficialLink}" target="_blank" class="btn btn-primary" style="width:100%;">
            🔗 Ver en Sitio Oficial
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

function renderRubrosSection() {
  return `
    <section style="margin-bottom: 26px;" id="rubros-section">
      <div class="section-title">
        <h3>Categorías & Rubros</h3>
      </div>
      
      <div class="rubros-grid">
        <div 
          class="rubro-pill ${state.selectedRubro === 'todos' ? 'active' : ''}"
          onclick="window.filterRubro('todos')"
        >
          <span class="rubro-icono">✨</span>
          <span class="rubro-nombre">Todos</span>
        </div>

        ${state.rubros.map(r => `
          <div 
            class="rubro-pill ${state.selectedRubro === r.id ? 'active' : ''}"
            onclick="window.filterRubro('${r.id}')"
          >
            <span class="rubro-icono">${r.icono}</span>
            <span class="rubro-nombre">${r.nombre}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderListingsSection() {
  let filtered = performSmartSearch(state.searchQuery);
  let rubroObj = state.rubros.find(r => r.id === state.selectedRubro);

  if (state.selectedRubro === 'farmacias') {
    return `
      <section id="listings-section" style="scroll-margin-top: 80px;">
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <h3>💊 Todas las Farmacias en Chascomús (${state.farmacias.length})</h3>
          <button class="btn btn-outline" style="font-size: 0.82rem; padding: 6px 14px;" onclick="window.resetFilters()">
            ✕ Ver Todos los Rubros
          </button>
        </div>

        <div class="listings-grid">
          ${state.farmacias.map(f => {
            const deTurno = isPharmDeTurnoToday(f);
            return `
              <div class="card-free" style="${deTurno ? 'border-color: #10b981; background: #f0fdf4;' : ''}">
                <span class="card-category">${deTurno ? '❇️ DE GUARDIA HOY' : 'ATENCIÓN REGULAR'}</span>
                <h4>${f.nombre}</h4>
                <p class="card-description">📍 ${f.direccion}<br>${f.horario || ''}</p>
                <div class="card-actions">
                  ${f.telefono ? `<a href="tel:${f.telefono}" class="btn btn-outline">📞 Llamar</a>` : ''}
                  <a href="${f.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(f.nombre)}+Chascomus`}" target="_blank" class="btn btn-primary">📍 Mapa</a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  if (state.selectedRubro !== 'todos') {
    filtered = filtered.filter(l => l.rubroId === state.selectedRubro);
  }

  const tituloSeccion = state.selectedRubro === 'todos' 
    ? `Publicaciones y Clasificados (${filtered.length})` 
    : `${rubroObj ? rubroObj.icono + ' ' + rubroObj.nombre : 'Categoría'} (${filtered.length})`;

  return `
    <section id="listings-section" style="scroll-margin-top: 80px;">
      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <h3>${tituloSeccion}</h3>
        ${(state.selectedRubro !== 'todos' || state.searchQuery) ? `
          <button class="btn btn-outline" style="font-size: 0.82rem; padding: 6px 14px;" onclick="window.resetFilters()">
            ✕ Ver Todos los Rubros
          </button>
        ` : ''}
      </div>

      ${filtered.length === 0 ? `
        <div style="text-align: center; padding: 50px 20px; background: white; border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
          <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 12px;">
            Rolfi no encontró resultados para <strong>"${state.searchQuery}"</strong>.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-ai" onclick="window.toggleAiChat()">🤖 Consultarle de nuevo a Rolfi</button>
            <button class="btn btn-outline" onclick="window.resetFilters()">Ver todos los rubros</button>
          </div>
        </div>
      ` : `
        <div class="listings-grid">
          ${filtered.map(l => (l.plan === 'oro' || l.plan === 'destacado' || l.plan === 'plata') ? renderVipCard(l) : renderFreeCard(l)).join('')}
        </div>
      `}
    </section>
  `;
}

function renderVipCard(l) {
  const isOro = l.plan === 'oro' || l.plan === 'destacado';
  const mainFoto = (l.fotos && l.fotos.length > 0) ? l.fotos[0] : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=600&auto=format&fit=crop&q=80';
  const customStyle = l.colorPersonalizado ? `border-color: ${l.colorPersonalizado}; box-shadow: 0 10px 25px ${l.colorPersonalizado}40;` : '';

  return `
    <div class="card-vip" style="${isOro ? '' : 'border-color: var(--primary); box-shadow: var(--shadow-md);'} ${customStyle}">
      <div class="vip-badge-ribbon" style="${isOro ? '' : 'background: linear-gradient(135deg, var(--primary), var(--primary-dark));'}">
        ${l.posicionTop ? '📌 TOP VIP' : isOro ? '⭐ VIP ORO' : '🔹 DESTACADO'}
      </div>
      
      <img src="${mainFoto}" alt="${l.nombre}" class="card-vip-image" />
      
      ${l.fotos && l.fotos.length > 1 ? `
        <div style="display: flex; gap: 4px; padding: 6px 12px; background: #f8fafc; overflow-x: auto;">
          ${l.fotos.map(f => `<img src="${f}" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);" />`).join('')}
        </div>
      ` : ''}

      <div class="card-vip-body">
        <span class="card-category" style="${isOro ? '' : 'color: var(--primary-dark);'}">${l.rubroNombre}</span>
        <h4>${l.nombre}</h4>
        <p class="card-description">${l.descripcion}</p>
        
        <div class="card-meta">
          <span>📍 ${l.direccion}</span>
          ${l.horarios ? `<span>⏰ ${l.horarios}</span>` : ''}
          ${l.redes ? `<span>🌐 ${l.redes}</span>` : ''}
        </div>

        <div class="card-actions">
          <a href="tel:${l.telefono}" class="btn btn-outline">📞 Llamar</a>
          <a href="https://wa.me/${l.whatsapp}?text=Hola,%20vi%20tu%20publicacion%20en%20la%20Guia%20Chascomus" target="_blank" class="btn btn-whatsapp">
            💬 WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderFreeCard(l) {
  return `
    <div class="card-free">
      <span class="card-category">${l.rubroNombre}</span>
      <h4>${l.nombre}</h4>
      <p class="card-description">${l.descripcion}</p>
      
      <div class="card-meta">
        <span>📍 ${l.direccion}</span>
        <span>📞 ${l.telefono}</span>
      </div>

      <div class="card-actions">
        <a href="tel:${l.telefono}" class="btn btn-outline">📞 Llamar</a>
        <a href="https://wa.me/${l.whatsapp}?text=Hola,%20vi%20tu%20anuncio%20en%20la%20Guia%20Chascomus" target="_blank" class="btn btn-whatsapp">
          💬 WhatsApp
        </a>
      </div>
    </div>
  `;
}

// ---------------- WIDGET DE ASISTENTE ROLFI ---------------- //
function renderAiAssistantWidget() {
  if (!state.showAiChat) {
    return `
      <button class="ai-floating-trigger" onclick="window.toggleAiChat()">
        🤖 Pregúntale a Rolfi
      </button>
    `;
  }

  return `
    <div class="ai-chat-window">
      <div class="ai-chat-header">
        <h4>🤖 Rolfi — Asistente Virtual</h4>
        <button style="background:transparent; border:none; color:white; font-size:18px; cursor:pointer;" onclick="window.toggleAiChat()">✕</button>
      </div>

      <div class="ai-chat-messages" id="aiChatScroll">
        ${state.aiMessages.map(msg => `
          <div class="ai-msg ${msg.sender === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}">
            ${msg.text}
          </div>
        `).join('')}
      </div>

      <div style="padding: 6px 12px; background: #f1f5f9; border-top: 1px solid var(--border);">
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">Sugerencias para Rolfi:</div>
        <div class="ai-quick-prompts">
          <button class="ai-prompt-chip" onclick="window.askAiPrompt('¿Qué farmacia está de guardia hoy?')">💊 Farmacia de guardia</button>
          <button class="ai-prompt-chip" onclick="window.askAiPrompt('¿Qué eventos hay en Chascomús?')">🏛️ Eventos municipales</button>
          <button class="ai-prompt-chip" onclick="window.askAiPrompt('Necesito un plomero o gasista')">🔧 Plomero o Gasista</button>
          <button class="ai-prompt-chip" onclick="window.askAiPrompt('Quiero pedir pizza o comida')">🍕 Comida a domicilio</button>
        </div>
      </div>

      <form onsubmit="window.handleAiMessageSubmit(event)" class="ai-chat-input-area">
        <input 
          type="text" 
          id="aiInput" 
          placeholder="Pregúntale lo que quieras a Rolfi..." 
          value="${state.aiInputText}"
          oninput="state.aiInputText = this.value"
        />
        <button type="submit">➔</button>
      </form>
    </div>
  `;
}

window.handleHeroAiSubmit = function(e) {
  e.preventDefault();
  const inputEl = document.getElementById('heroAiInput');
  const inputVal = inputEl ? inputEl.value : '';
  if (!inputVal.trim()) return;

  state.aiInputText = inputVal;
  state.showAiChat = true;
  window.handleAiMessageSubmit(e);
};

window.toggleAiChat = function() {
  state.showAiChat = !state.showAiChat;
  renderApp();
  if (state.showAiChat) {
    setTimeout(() => {
      const scroll = document.getElementById('aiChatScroll');
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
      const inputEl = document.getElementById('aiInput');
      if (inputEl) inputEl.focus();
    }, 50);
  }
};

window.askAiPrompt = function(promptText) {
  state.aiInputText = promptText;
  window.handleAiMessageSubmit(new Event('submit'));
};

window.handleAiMessageSubmit = function(e) {
  if (e) e.preventDefault();

  const aiInput = document.getElementById('aiInput');
  const heroInput = document.getElementById('heroAiInput');

  let text = '';
  if (aiInput && aiInput.value.trim()) {
    text = aiInput.value.trim();
  } else if (heroInput && heroInput.value.trim()) {
    text = heroInput.value.trim();
  } else if (state.aiInputText && state.aiInputText.trim()) {
    text = state.aiInputText.trim();
  }

  if (!text) return;

  state.aiMessages.push({ sender: 'user', text });
  state.aiInputText = '';

  if (aiInput) aiInput.value = '';
  if (heroInput) heroInput.value = '';

  const textLower = text.toLowerCase();
  let botReply = '';

  if (textLower.includes('evento') || textLower.includes('municip') || textLower.includes('cultura') || textLower.includes('teatro') || textLower.includes('maraton')) {
    if (state.eventosMunicipales.length > 0) {
      const topEvt = state.eventosMunicipales[0];
      botReply = `🏛️ ¡Sí! En Novedades Municipales tenés los últimos eventos. El destacado es: **${topEvt.titulo}** (${topEvt.fecha} en ${topEvt.lugar}). Podés hacer clic en la tarjeta para leer más.`;
    } else {
      botReply = `🏛️ Podés consultar todos los informes e iniciativas del municipio en el bloque de Novedades Municipales.`;
    }
  } else if (textLower.includes('farmacia') || textLower.includes('guardia') || textLower.includes('remedio') || textLower.includes('medicamento')) {
    const dutyInfo = getPharmDutyDateInfo();
    const deTurno = state.farmacias.filter(f => isPharmDeTurnoToday(f));
    if (deTurno.length > 0) {
      botReply = `❇️ ¡Hola! Hoy ${dutyInfo.dayName} ${dutyInfo.shortDate} la farmacia de guardia activa es **${deTurno[0].nombre}** en ${deTurno[0].direccion}. Está destacada arriba de todo con la cruz verde.`;
    } else {
      botReply = `💊 Podés ver las farmacias de guardia arriba de todo o consultar el listado en la categoría Farmacias.`;
    }
    state.searchQuery = 'farmacia';
  } else if (textLower.includes('plomero') || textLower.includes('agua') || textLower.includes('canilla') || textLower.includes('caño') || textLower.includes('gas')) {
    botReply = `🚰 ¡Con gusto! Encontré profesionales de Plomería & Gas Matriculado en Chascomús. Filtré la lista abajo para que puedas llamarlos o enviarles un WhatsApp.`;
    state.searchQuery = 'plomeria';
  } else if (textLower.includes('electricista') || textLower.includes('luz') || textLower.includes('cable') || textLower.includes('térmica')) {
    botReply = `⚡ ¡Excelente! Te filtré los electricistas y especialistas en iluminación en Chascomús listados abajo.`;
    state.searchQuery = 'electricidad';
  } else if (textLower.includes('pizza') || textLower.includes('comida') || textLower.includes('hamburguesa') || textLower.includes('delivery')) {
    botReply = `🍕 ¡Mmmm qué rico! Te filtré las pizzerías y opciones de gastronomía en Chascomús con envío a domicilio.`;
    state.searchQuery = 'gastronomia';
  } else if (textLower.includes('remis') || textLower.includes('viaje') || textLower.includes('taxi') || textLower.includes('traslado')) {
    botReply = `🚕 Te encontré las mejores opciones de remises y traslados en Chascomús.`;
    state.searchQuery = 'remises';
  } else {
    const results = performSmartSearch(text);
    if (results.length > 0) {
      botReply = `🔍 ¡Encontré ${results.length} opciones en Chascomús para "${text}"! Filtré los resultados abajo para vos.`;
      state.searchQuery = text;
    } else {
      botReply = `🤔 No encontré un comercio exacto para "${text}", pero te sugiero consultar nuestras categorías o contactar al administrador por WhatsApp.`;
    }
  }

  state.aiMessages.push({ sender: 'bot', text: botReply });
  renderApp();

  setTimeout(() => {
    const scroll = document.getElementById('aiChatScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    
    const listingsSection = document.getElementById('listings-section');
    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
};

window.openEventDetailModal = function(id) {
  state.activeEvent = state.eventosMunicipales.find(e => e.id === id);
  state.showEventDetailModal = true;
  renderApp();
};

window.closeEventDetailModal = function() {
  state.showEventDetailModal = false;
  state.activeEvent = null;
  renderApp();
};

function renderAdModal() {
  const ad = state.activePopup;
  if (!ad) return '';

  return `
    <div class="modal-overlay">
      <div class="ad-modal-content">
        <button class="modal-close-btn" onclick="window.closeAdModal()">✕</button>
        <img src="${ad.imagen}" alt="Publicidad" class="ad-img" />
        <div class="ad-body">
          <h3>${ad.titulo}</h3>
          <h4>${ad.subtitulo}</h4>
          <p>${ad.descripcion}</p>
          <a href="${ad.link || 'https://wa.me/5492241527357'}" target="_blank" class="btn btn-primary" style="width:100%;">
            ${ad.botonTexto || 'Saber Más'}
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderSubmitModal() {
  return `
    <div class="modal-overlay">
      <div class="form-modal-content">
        <button class="modal-close-btn" onclick="window.closeSubmitModal()">✕</button>
        <h3>Publicá tu Comercio o Servicio</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
          Completá el formulario para sumarte a la Guía Digital de Chascomús. El administrador revisará tu solicitud y la publicará a la brevedad.
        </p>

        <form onsubmit="window.handlePublicSubmit(event)">
          <div class="form-group">
            <label>Nombre del Comercio o Prestador *</label>
            <input type="text" id="subNombre" required placeholder="Ej: Carpintería El Sol / Remises Chascomús" />
          </div>

          <div class="form-group">
            <label>Rubro o Categoría *</label>
            <select id="subRubroId" required>
              ${state.rubros.map(r => `<option value="${r.id}" ${state.selectedRubro === r.id ? 'selected' : ''}>${r.icono} ${r.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Plan Solicitado *</label>
            <select id="subPlanDeseado" required>
              <option value="gratuito">Plan Gratuito (Básico)</option>
              <option value="plata">Plan Plata Destacado (Borde Azul y Prioridad)</option>
              <option value="oro">Plan Oro VIP (Borde Dorado, Fotos y Posición Superior)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Dirección en Chascomús *</label>
            <input type="text" id="subDireccion" required placeholder="Ej: Calle Libres del Sur 234 / Atiendo a domicilio" />
          </div>

          <div class="form-group">
            <label>Teléfono de Contacto *</label>
            <input type="tel" id="subTelefono" required placeholder="Ej: 2241-551122" />
          </div>

          <div class="form-group">
            <label>Número de WhatsApp (opcional)</label>
            <input type="text" id="subWhatsapp" placeholder="Ej: 5492241527357" />
          </div>

          <div class="form-group">
            <label>Descripción de tus productos o servicios *</label>
            <textarea id="subDescripcion" rows="3" required placeholder="Contanos qué hacés, tus servicios principales, horarios de atención, etc."></textarea>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closeSubmitModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">Enviar Solicitud</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// DASHBOARD PANTALLA COMPLETA 100% PANTALLA
function renderAdminModal() {
  if (!state.isAdmin) {
    return `
      <div class="modal-overlay">
        <div class="form-modal-content" style="max-width: 400px;">
          <button class="modal-close-btn" onclick="window.closeAdminModal()">✕</button>
          <h3 style="text-align: center;">Ingreso Administrador</h3>
          <p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
            Ingresá la contraseña para gestionar las publicaciones, solicitudes y farmacias.
          </p>
          
          <form onsubmit="window.handleAdminLogin(event)">
            <div class="form-group">
              <label>Contraseña de Acceso</label>
              <input type="password" id="adminPassword" required placeholder="Ingresá tu clave" />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Ingresar al Dashboard</button>
          </form>
        </div>
      </div>
    `;
  }

  const dutyInfo = getPharmDutyDateInfo();

  return `
    <div class="admin-fullscreen-modal">
      <div class="admin-fullscreen-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 1.6rem;">🏛️</div>
          <div>
            <h2 style="color: white; margin: 0; font-size: 1.3rem;">Panel de Administración — Guía Chascomús</h2>
            <span style="font-size: 0.8rem; color: var(--accent-gold);">Turno Activo Hoy: <strong>${dutyInfo.dayName} ${dutyInfo.shortDate}</strong></span>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-outline" style="color: white; border-color: rgba(255,255,255,0.4);" onclick="window.closeAdminModal()">Ver Sitio Web 👁️</button>
          <button class="btn btn-primary" style="background: var(--danger);" onclick="window.adminLogout()">Cerrar Sesión 🚪</button>
        </div>
      </div>

      <div class="admin-fullscreen-tabs">
        <button class="tab-btn ${state.adminTab === 'pending' ? 'active' : ''}" onclick="window.setAdminTab('pending')">
          📩 Solicitudes Pendientes (${state.pendingSubmissions.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'events' ? 'active' : ''}" onclick="window.setAdminTab('events')">
          🏛️ Eventos Municipales (${state.eventosMunicipales.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'rubros' ? 'active' : ''}" onclick="window.setAdminTab('rubros')">
          🏷️ Categorías / Rubros (${state.rubros.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'listings' ? 'active' : ''}" onclick="window.setAdminTab('listings')">
          📖 Publicaciones (${state.listings.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'pharmacies' ? 'active' : ''}" onclick="window.setAdminTab('pharmacies')">
          💊 Farmacias (${state.farmacias.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'ads' ? 'active' : ''}" onclick="window.setAdminTab('ads')">
          📢 Pop-ups (${state.popups.length})
        </button>
        <button class="tab-btn ${state.adminTab === 'security' ? 'active' : ''}" onclick="window.setAdminTab('security')">
          🔒 Clave Admin
        </button>
      </div>

      <div class="admin-fullscreen-body">
        ${state.adminTab === 'pending' ? renderAdminPendingTab() : ''}
        ${state.adminTab === 'events' ? renderAdminEventsTab() : ''}
        ${state.adminTab === 'rubros' ? renderAdminRubrosTab() : ''}
        ${state.adminTab === 'listings' ? renderAdminListingsTab() : ''}
        ${state.adminTab === 'pharmacies' ? renderAdminPharmaciesTab() : ''}
        ${state.adminTab === 'ads' ? renderAdminAdsTab() : ''}
        ${state.adminTab === 'security' ? renderAdminSecurityTab() : ''}
      </div>
    </div>
  `;
}

function renderAdminPendingTab() {
  if (state.pendingSubmissions.length === 0) {
    return `<div style="text-align: center; padding: 40px; color: var(--text-muted); background: white; border-radius: var(--radius-md); border: 1px solid var(--border);">No hay solicitudes pendientes en este momento.</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Comercio / Nombre</th>
            <th>Rubro</th>
            <th>Plan Solicitado</th>
            <th>Contacto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${state.pendingSubmissions.map(s => `
            <tr>
              <td><strong>${s.nombre}</strong><br><small>${s.direccion}</small></td>
              <td>${s.rubroNombre}</td>
              <td>
                <span style="font-weight: 700; color: ${s.planDeseado === 'oro' ? 'var(--accent-gold)' : s.planDeseado === 'plata' ? 'var(--primary)' : 'var(--text-muted)'}">
                  ${s.planDeseado === 'oro' ? '⭐ ORO VIP' : s.planDeseado === 'plata' ? '🔹 PLATA' : 'GRATUITO'}
                </span>
              </td>
              <td>📞 ${s.telefono}</td>
              <td>
                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.approveSubmission('${s.id}', 'gratuito')">Aprobar Gratis</button>
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; border-color: var(--primary);" onclick="window.approveSubmission('${s.id}', 'plata')">Aprobar Plata</button>
                <button class="btn btn-whatsapp" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.approveSubmission('${s.id}', 'oro')">Aprobar Oro VIP</button>
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; color: red;" onclick="window.rejectSubmission('${s.id}')">Rechazar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminEventsTab() {
  return `
    <div>
      <div style="background: #e0f2fe; border: 1px solid #bae6fd; padding: 18px; border-radius: var(--radius-md); margin-bottom: 20px;">
        <h4 style="color: #0369a1; margin-bottom: 6px;">⚡ Importador Automático del Canal de WhatsApp Municipal</h4>
        <p style="font-size: 0.85rem; color: #0284c7; margin-bottom: 12px;">
          Ingresá el link del canal o copiá y pegá directamente el texto publicado en WhatsApp para que aparezca publicado en la web sin que nadie tenga que salir de la página.
        </p>

        <form onsubmit="window.handleWhatsAppImport(event)" style="display: flex; flex-direction: column; gap: 10px;">
          <input type="text" id="importChannelUrl" placeholder="Ej: https://whatsapp.com/channel/0029Va... (Link del canal)" />
          <textarea id="importRawText" rows="2" placeholder="O pegá aquí el texto del comunicado publicado en WhatsApp..."></textarea>
          <button type="submit" class="btn btn-primary" style="align-self: flex-start;">⚡ Importar e Publicar Automáticamente</button>
        </form>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Publicaciones Municipales Activas (${state.eventosMunicipales.length})</h4>
        <button class="btn btn-outline" onclick="window.openEventFormModal(null)">+ Cargar Manualmente</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Título / Evento</th>
              <th>Categoría</th>
              <th>Fecha & Lugar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.eventosMunicipales.map(e => `
              <tr>
                <td><strong>${e.titulo}</strong><br><small>${(e.descripcion || '').substring(0, 70)}...</small></td>
                <td><span class="day-badge">${e.categoria || 'Municipal'}</span></td>
                <td>📅 ${e.fecha}<br>📍 ${e.lugar}</td>
                <td>
                  <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.openEventFormModal('${e.id}')">✏️ Editar</button>
                  <button class="btn btn-outline" style="font-size: 0.8rem; color: red;" onclick="window.deleteEvent('${e.id}')">🗑️ Borrar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminRubrosTab() {
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Gestión de Categorías / Rubros (${state.rubros.length})</h4>
        <button class="btn btn-primary" onclick="window.openRubroFormModal(null)">+ Nueva Categoría</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Ícono</th>
              <th>Nombre de Categoría</th>
              <th>ID Interno</th>
              <th>Color</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.rubros.map(r => `
              <tr>
                <td style="font-size: 1.4rem;">${r.icono}</td>
                <td><strong>${r.nombre}</strong></td>
                <td><code>${r.id}</code></td>
                <td>
                  <span style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: ${r.color || '#0284c7'}; margin-right: 6px;"></span>
                  ${r.color || '#0284c7'}
                </td>
                <td>
                  <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.openRubroFormModal('${r.id}')">✏️ Editar</button>
                  <button class="btn btn-outline" style="font-size: 0.8rem; color: red;" onclick="window.deleteRubro('${r.id}')">🗑️ Borrar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminListingsTab() {
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Todas las Publicaciones Activas (${state.listings.length})</h4>
        <button class="btn btn-primary" onclick="window.openListingFormModal(null)">+ Nueva Publicación</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rubro</th>
              <th>Plan</th>
              <th>Posición</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.listings.map(l => `
              <tr>
                <td><strong>${l.nombre}</strong><br><small>📍 ${l.direccion}</small></td>
                <td>${l.rubroNombre}</td>
                <td>
                  <span style="padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; background: ${l.plan === 'oro' || l.plan === 'destacado' ? 'var(--accent-gold-light)' : l.plan === 'plata' ? 'var(--primary-light)' : '#f1f5f9'}; color: ${l.plan === 'oro' || l.plan === 'destacado' ? 'var(--accent-gold)' : l.plan === 'plata' ? 'var(--primary-dark)' : 'var(--text-muted)'}">
                    ${l.plan === 'oro' || l.plan === 'destacado' ? '⭐ ORO VIP' : l.plan === 'plata' ? '🔹 PLATA' : 'GRATIS'}
                  </span>
                </td>
                <td>
                  ${l.posicionTop ? '<span style="color: purple; font-weight: 800;">📌 FIJADO TOP</span>' : 'Normal'}
                </td>
                <td>
                  <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.openListingFormModal('${l.id}')">✏️ Editar</button>
                  <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: red;" onclick="window.deleteListing('${l.id}')">🗑️ Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminPharmaciesTab() {
  const dutyInfo = getPharmDutyDateInfo();

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Gestión Completa de Farmacias (${state.farmacias.length})</h4>
        <button class="btn btn-primary" onclick="window.openPharmacyFormModal(null)">+ Agregar Nueva Farmacia</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Farmacia</th>
              <th>Dirección & Teléfono</th>
              <th>Fechas del Mes / Días</th>
              <th>Estado Ahora (${dutyInfo.shortDate})</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.farmacias.map(f => {
              const deTurnoHoy = isPharmDeTurnoToday(f);
              const fechasStr = (f.fechasTurno || []).join(', ');
              return `
                <tr>
                  <td><strong>${f.nombre}</strong></td>
                  <td>📍 ${f.direccion}<br>${f.telefono ? '📞 ' + f.telefono : '<small style="color:var(--text-muted);">(Sin teléfono)</small>'}</td>
                  <td>
                    ${fechasStr ? `<div>📅 <strong>Fechas:</strong> ${fechasStr}</div>` : ''}
                    ${(f.diasTurno || []).map(d => `<span class="day-badge" style="${d === dutyInfo.dayName ? 'background: #10b981; color: white;' : ''}">${d}</span>`).join('')}
                    ${!fechasStr && (!f.diasTurno || f.diasTurno.length === 0) ? '<em>Sin fechas asignadas</em>' : ''}
                  </td>
                  <td>
                    <span style="color: ${deTurnoHoy ? '#10b981' : 'gray'}; font-weight: 700;">
                      ${deTurnoHoy ? `❇️ DE GUARDIA (Hoy ${dutyInfo.shortDate})` : '⚪ ATENCIÓN REGULAR'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.togglePharmacyTurn('${f.id}')">
                      ${f.deTurno ? 'Quitar Fuerza Guardia' : 'Forzar Guardia'}
                    </button>
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.openPharmacyFormModal('${f.id}')">✏️ Editar Fechas</button>
                    <button class="btn btn-outline" style="font-size: 0.8rem; color: red;" onclick="window.deletePharmacy('${f.id}')">🗑️ Borrar</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminAdsTab() {
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Gestión de Pop-ups y Anuncios por Ubicación (Ilimitados)</h4>
        <button class="btn btn-primary" onclick="window.openPopupFormModal(null)">+ Crear Nuevo Pop-up</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Título del Anuncio</th>
              <th>Ubicación exactas / Dónde aparece</th>
              <th>Estado</th>
              <th>Imagen</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.popups.map(p => {
              let nombreUbicacion = '🏠 Portada Principal';
              if (p.ubicacion.startsWith('pharmacy_')) {
                const pId = p.ubicacion.replace('pharmacy_', '');
                const farm = state.farmacias.find(f => f.id === pId);
                nombreUbicacion = `💊 Farmacia: ${farm ? farm.nombre : pId}`;
              } else if (p.ubicacion !== 'portada') {
                const rubroObj = state.rubros.find(r => r.id === p.ubicacion);
                nombreUbicacion = `📁 Rubro: ${rubroObj ? rubroObj.nombre : p.ubicacion}`;
              }

              return `
                <tr>
                  <td><strong>${p.titulo}</strong><br><small>${p.subtitulo || ''}</small></td>
                  <td><span style="font-weight: 700; color: var(--primary);">${nombreUbicacion}</span></td>
                  <td>
                    <span style="color: ${p.activo ? 'green' : 'gray'}; font-weight: 700;">
                      ${p.activo ? '🟢 ACTIVO' : '⚪ PAUSADO'}
                    </span>
                  </td>
                  <td>
                    ${p.imagen ? `<img src="${p.imagen}" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;" />` : 'Sin foto'}
                  </td>
                  <td>
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.togglePopupActive('${p.id}')">
                      ${p.activo ? 'Pausar' : 'Activar'}
                    </button>
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.openPopupFormModal('${p.id}')">
                      ✏️ Editar
                    </button>
                    <button class="btn btn-outline" style="font-size: 0.8rem; color: red;" onclick="window.deletePopup('${p.id}')">
                      🗑️ Borrar
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminSecurityTab() {
  return `
    <div style="max-width: 450px;">
      <h4 style="margin-bottom: 12px;">Cambiar Contraseña del Administrador</h4>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
        Podés cambiar la clave de acceso al panel en cualquier momento. La nueva clave se guardará de forma segura en tu base de datos local.
      </p>

      <form onsubmit="window.handlePasswordChange(event)">
        <div class="form-group">
          <label>Nueva Contraseña *</label>
          <input type="password" id="newAdminPassword" required minlength="4" placeholder="Ingresá la nueva clave" />
        </div>

        <div class="form-group">
          <label>Confirmar Nueva Contraseña *</label>
          <input type="password" id="confirmAdminPassword" required minlength="4" placeholder="Repetía la nueva clave" />
        </div>

        <button type="submit" class="btn btn-primary">Actualizar Contraseña</button>
      </form>
    </div>
  `;
}

// ---------------- MODALES DE FORMULARIOS ADMIN ---------------- //

function renderEventFormModal() {
  const e = state.editingItem || {};
  const isEdit = !!e.id;

  return `
    <div class="modal-overlay">
      <div class="form-modal-content">
        <button class="modal-close-btn" onclick="window.closeEventFormModal()">✕</button>
        <h3>${isEdit ? 'Editar Evento Municipal' : 'Nuevo Evento / Informe Municipal'}</h3>

        <form onsubmit="window.saveEventForm(event)">
          <div class="form-group">
            <label>Título del Evento o Comunicado *</label>
            <input type="text" id="editEvtTitulo" value="${e.titulo || ''}" required placeholder="Ej: 🎭 Noche de los Teatros en el Brazzola" />
          </div>

          <div class="form-group">
            <label>Categoría *</label>
            <input type="text" id="editEvtCategoria" value="${e.categoria || 'Cultura & Espectáculos'}" required placeholder="Ej: Cultura / Deportes / Turismo" />
          </div>

          <div class="form-group">
            <label>Fecha y Hora *</label>
            <input type="text" id="editEvtFecha" value="${e.fecha || ''}" required placeholder="Ej: Sábado 15 de Agosto - 20:00 hs" />
          </div>

          <div class="form-group">
            <label>Lugar en Chascomús *</label>
            <input type="text" id="editEvtLugar" value="${e.lugar || ''}" required placeholder="Ej: Teatro Municipal Brazzola / Parque Libres del Sur" />
          </div>

          <div class="form-group">
            <label>Descripción *</label>
            <textarea id="editEvtDescripcion" rows="3" required>${e.descripcion || ''}</textarea>
          </div>

          <div class="form-group">
            <label>Imagen Promocional (URL o subir)</label>
            <input type="text" id="editEvtImagen" value="${e.imagen || ''}" placeholder="URL de la foto del evento" />
          </div>

          <div class="form-group">
            <label>Enlace Oficial o Canal de WhatsApp Municipal</label>
            <input type="text" id="editEvtOficialLink" value="${e.oficialLink || 'https://chascomus.gob.ar'}" />
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closeEventFormModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Guardar Cambios' : 'Publicar Evento'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderListingFormModal() {
  const l = state.editingItem || {};
  const isEdit = !!l.id;

  return `
    <div class="modal-overlay">
      <div class="form-modal-content">
        <button class="modal-close-btn" onclick="window.closeListingFormModal()">✕</button>
        <h3>${isEdit ? 'Editar Publicación' : 'Nueva Publicación'}</h3>

        <form onsubmit="window.saveListingForm(event)">
          <div class="form-group">
            <label>Nombre del Comercio o Servicio *</label>
            <input type="text" id="editListNombre" value="${l.nombre || ''}" required />
          </div>

          <div class="form-group">
            <label>Rubro o Categoría *</label>
            <select id="editListRubroId" required>
              ${state.rubros.map(r => `<option value="${r.id}" ${l.rubroId === r.id ? 'selected' : ''}>${r.icono} ${r.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Nivel de Plan (Pago / Gratuito) *</label>
            <select id="editListPlan" required>
              <option value="gratuito" ${l.plan === 'gratuito' ? 'selected' : ''}>Plan Gratuito (Básico)</option>
              <option value="plata" ${l.plan === 'plata' ? 'selected' : ''}>Plan Plata Destacado (Borde Azul y Prioridad)</option>
              <option value="oro" ${l.plan === 'oro' || l.plan === 'destacado' ? 'selected' : ''}>Plan Oro VIP (Borde Dorado Radiante y Galería de Fotos)</option>
            </select>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="editListPosicionTop" ${l.posicionTop ? 'checked' : ''} />
              <strong>📌 Fijar ARRIBA DE TODO (Prioridad Superior de Aparición)</strong>
            </label>
          </div>

          <div class="form-group">
            <label>Color Personalizado de Borde/Accent (Opcional, ej: #f59e0b, #0284c7, #8e44ad)</label>
            <input type="text" id="editListColor" value="${l.colorPersonalizado || ''}" placeholder="Ej: #f59e0b" />
          </div>

          <div class="form-group">
            <label>Dirección en Chascomús *</label>
            <input type="text" id="editListDireccion" value="${l.direccion || ''}" required />
          </div>

          <div class="form-group">
            <label>Teléfono *</label>
            <input type="tel" id="editListTelefono" value="${l.telefono || ''}" required />
          </div>

          <div class="form-group">
            <label>WhatsApp (ej: 5492241527357)</label>
            <input type="text" id="editListWhatsapp" value="${l.whatsapp || ''}" />
          </div>

          <div class="form-group">
            <label>Descripción *</label>
            <textarea id="editListDescripcion" rows="3" required>${l.descripcion || ''}</textarea>
          </div>

          <div class="form-group" style="background: #f1f5f9; padding: 12px; border-radius: var(--radius-md);">
            <label style="font-weight: 700;">📷 Fotos para Plan Pago (Subir desde la compu)</label>
            <input type="file" id="listFotoFileInput" accept="image/*" onchange="window.handleListingFileUpload(event)" style="margin-bottom: 6px;" />
            <input type="text" id="editListFoto" value="${(l.fotos && l.fotos.length > 0) ? l.fotos.join(', ') : ''}" placeholder="URLs o imágenes subidas separadas por coma" />
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closeListingFormModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Guardar Cambios' : 'Crear Publicación'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderRubroFormModal() {
  const r = state.editingItem || {};
  const isEdit = !!r.id;

  return `
    <div class="modal-overlay">
      <div class="form-modal-content" style="max-width: 450px;">
        <button class="modal-close-btn" onclick="window.closeRubroFormModal()">✕</button>
        <h3>${isEdit ? 'Editar Categoría' : 'Nueva Categoría'}</h3>

        <form onsubmit="window.saveRubroForm(event)">
          <div class="form-group">
            <label>Nombre de la Categoría *</label>
            <input type="text" id="editRubroNombre" value="${r.nombre || ''}" required placeholder="Ej: Comisionistas & Fletes" />
          </div>

          <div class="form-group">
            <label>Ícono Emoji *</label>
            <input type="text" id="editRubroIcono" value="${r.icono || '📁'}" required placeholder="Ej: 🚚" />
          </div>

          <div class="form-group">
            <label>Color Distintivo (Ej: #0284c7)</label>
            <input type="color" id="editRubroColor" value="${r.color || '#0284c7'}" />
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closeRubroFormModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Guardar Cambios' : 'Crear Categoría'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPharmacyFormModal() {
  const f = state.editingItem || {};
  const isEdit = !!f.id;
  const diasAsignados = f.diasTurno || [];
  const fechasAsignadas = (f.fechasTurno || []).join(', ');

  return `
    <div class="modal-overlay">
      <div class="form-modal-content">
        <button class="modal-close-btn" onclick="window.closePharmacyFormModal()">✕</button>
        <h3>${isEdit ? 'Editar Farmacia' : 'Agregar Nueva Farmacia'}</h3>

        <form onsubmit="window.savePharmacyForm(event)">
          <div class="form-group">
            <label>Nombre de la Farmacia *</label>
            <input type="text" id="editPharmNombre" value="${f.nombre || ''}" required placeholder="Ej: Farmacia Pasteur" />
          </div>

          <div class="form-group">
            <label>Dirección en Chascomús *</label>
            <input type="text" id="editPharmDireccion" value="${f.direccion || ''}" required placeholder="Ej: Av. Lastra 234" />
          </div>

          <div class="form-group">
            <label>Teléfono de Contacto (Optativo)</label>
            <input type="tel" id="editPharmTelefono" value="${f.telefono || ''}" placeholder="Ej: 2241-421111 (Opcional)" />
          </div>

          <div class="form-group">
            <label>Horario de Guardia</label>
            <input type="text" id="editPharmHorario" value="${f.horario || 'Turno 24 hs (08:00 a 08:00 hs)'}" placeholder="Ej: Turno 24 hs (08:00 a 08:00 hs)" />
          </div>

          <div class="form-group" style="background: #fdf4ff; border: 1px solid #f5d0fe; padding: 14px; border-radius: var(--radius-md);">
            <label style="font-weight: 700; color: #86198f;">📅 Fechas del Mes (Podés poner 1, 2, 3 o las que quieras):</label>
            <input type="text" id="editPharmFechas" value="${fechasAsignadas}" placeholder="Ej: 13/08 (o 13/08, 20/08, 27/08)" style="margin-top: 6px;" />
            <small style="color: #701a75; display: block; margin-top: 4px;">Acepta formatos como 13/08, 13/8, 13 o 13/08/2026. Se activará automáticamente con la insignia verde ❇️ DE GUARDIA.</small>
          </div>

          <div class="form-group">
            <label style="font-weight: 700;">o Seleccioná Días de la Semana Fijos (Optativo):</label>
            <div class="days-checkbox-grid">
              ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => `
                <label class="day-checkbox-item">
                  <input type="checkbox" name="pharmDaysCheck" value="${dia}" ${diasAsignados.includes(dia) ? 'checked' : ''} />
                  <span>${dia}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closePharmacyFormModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Guardar Cambios' : 'Crear Farmacia'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPopupFormModal() {
  const p = state.editingItem || {};
  const isEdit = !!p.id;

  return `
    <div class="modal-overlay">
      <div class="form-modal-content">
        <button class="modal-close-btn" onclick="window.closePopupFormModal()">✕</button>
        <h3>${isEdit ? 'Editar Anuncio Pop-up' : 'Crear Nuevo Anuncio Pop-up'}</h3>

        <form onsubmit="window.savePopupForm(event)">
          <div class="form-group">
            <label>¿Dónde debe aparecer este Pop-up publicitario? *</label>
            <select id="editPopUbicacion" required>
              <option value="portada" ${p.ubicacion === 'portada' ? 'selected' : ''}>🏠 Portada Principal (Al abrir la aplicación)</option>
              <optgroup label="📁 Al entrar a una Categoría o Rubro específico">
                ${state.rubros.map(r => `<option value="${r.id}" ${p.ubicacion === r.id ? 'selected' : ''}>📁 Rubro: ${r.nombre}</option>`).join('')}
              </optgroup>
              <optgroup label="💊 Al consultar o ingresar a una Farmacia específica">
                ${state.farmacias.map(f => `<option value="pharmacy_${f.id}" ${p.ubicacion === 'pharmacy_' + f.id || p.ubicacion === f.id ? 'selected' : ''}>💊 Farmacia: ${f.nombre}</option>`).join('')}
              </optgroup>
            </select>
          </div>

          <div class="form-group">
            <label>Título del Anuncio *</label>
            <input type="text" id="editPopTitulo" value="${p.titulo || ''}" required placeholder="Ej: ¡PROMO 2X1 EN PIZZAS!" />
          </div>

          <div class="form-group">
            <label>Subtítulo / Promo</label>
            <input type="text" id="editPopSubtitulo" value="${p.subtitulo || ''}" placeholder="Ej: Pizzería La Laguna" />
          </div>

          <div class="form-group">
            <label>Descripción detallada</label>
            <textarea id="editPopDescripcion" rows="3">${p.descripcion || ''}</textarea>
          </div>

          <div class="form-group" style="background: #f1f5f9; padding: 14px; border-radius: var(--radius-md);">
            <label style="font-weight: 700;">📷 Imagen del Pop-up (Subir desde la compu)</label>
            <input type="file" id="popFileInput" accept="image/*" onchange="window.handlePopupFileUpload(event)" style="margin-top: 6px; margin-bottom: 8px;" />
            <input type="text" id="editPopImagen" value="${p.imagen || ''}" placeholder="/uploads/mi_foto.jpg o URL" />
          </div>

          <div class="form-group">
            <label>Texto del Botón</label>
            <input type="text" id="editPopBotonTexto" value="${p.botonTexto || 'Ver Promociones'}" />
          </div>

          <div class="form-group">
            <label>Enlace del Botón (WhatsApp / Web)</label>
            <input type="text" id="editPopLink" value="${p.link || 'https://wa.me/5492241527357'}" />
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="editPopActivo" ${p.activo !== false ? 'checked' : ''} />
              <strong>Anuncio Activo</strong>
            </label>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="window.closePopupFormModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Guardar Cambios' : 'Crear Pop-up'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderFooter() {
  return `
    <footer>
      <div style="max-width: 1200px; margin: 0 auto;">
        <h3 style="font-size: 1.3rem; margin-bottom: 8px;">Guía Digital de Chascomús</h3>
        <p>Conectando comercios, vecinos y visitantes en toda la ciudad.</p>
        
        <div class="footer-dev">
          Desarrollado por <span style="font-weight: 800; font-size: 1rem; color: #f59e0b;">rol<span style="font-size: 1.1rem;">ϕ</span></span>
        </div>

        <div style="margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
          <span style="font-size: 0.8rem; opacity: 0.6;">© 2026 Guía Chascomús. Todos los derechos reservados.</span>
          <span style="opacity: 0.3;">•</span>
          <a href="javascript:void(0)" onclick="window.toggleAdmin()" style="font-size: 0.78rem; color: rgba(255,255,255,0.4); text-decoration: none;">
            🔒 Acceso Administración
          </a>
        </div>
      </div>
    </footer>
  `;
}

// ---------------- ACCIONES GLOBALES Y MANEJADORES ---------------- //

window.handleWhatsAppImport = async function(e) {
  e.preventDefault();
  const channelUrl = document.getElementById('importChannelUrl').value;
  const rawText = document.getElementById('importRawText').value;

  if (!channelUrl.trim() && !rawText.trim()) {
    return alert('Por favor ingresá el link del canal o pegá el texto del comunicado.');
  }

  try {
    const res = await fetch('/api/admin/fetch-whatsapp-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify({ channelUrl, rawText })
    });
    const data = await res.json();
    if (data.success) {
      await loadAppData();
      renderApp();
      alert(data.message || '¡Publicación del canal importada con éxito!');
    } else {
      alert(data.error || 'Error al importar');
    }
  } catch (err) {
    alert('Error de conexión al importar del canal');
  }
};

window.filterRubro = function(rubroId) {
  state.selectedRubro = rubroId;
  state.searchQuery = '';
  renderApp();

  if (rubroId !== 'todos') {
    checkCategoryPopup(rubroId);
  }

  setTimeout(() => {
    const section = document.getElementById('listings-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
};

window.onSearchChange = function(e) {
  state.searchQuery = e.target.value;
  renderApp();
  const input = document.getElementById('searchInput');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
};

window.resetFilters = function() {
  state.selectedRubro = 'todos';
  state.searchQuery = '';
  renderApp();

  setTimeout(() => {
    const section = document.getElementById('rubros-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
};

window.openSubmitModal = function() {
  state.showSubmitModal = true;
  renderApp();
};

window.closeSubmitModal = function() {
  state.showSubmitModal = false;
  renderApp();
};

window.openWhatsAppAdmin = function() {
  window.open(`https://wa.me/5492241527357?text=Hola,%20quiero%20publicar%20mi%20comercio/servicio%20en%20la%20Guia%20Chascomus`, '_blank');
};

window.handlePublicSubmit = async function(e) {
  e.preventDefault();
  const body = {
    nombre: document.getElementById('subNombre').value,
    rubroId: document.getElementById('subRubroId').value,
    planDeseado: document.getElementById('subPlanDeseado').value,
    direccion: document.getElementById('subDireccion').value,
    telefono: document.getElementById('subTelefono').value,
    whatsapp: document.getElementById('subWhatsapp').value || '5492241527357',
    descripcion: document.getElementById('subDescripcion').value
  };

  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      state.showSubmitModal = false;

      if (state.isAdmin && state.adminToken) {
        await fetchPendingSubmissions();
      }
      renderApp();
    }
  } catch (err) {
    alert('Ocurrió un error al enviar el formulario.');
  }
};

// Admin Login & Navigation
window.toggleAdmin = async function() {
  state.showAdminModal = !state.showAdminModal;
  if (state.showAdminModal && state.isAdmin && state.adminToken) {
    await fetchPendingSubmissions();
  }
  renderApp();
};

window.closeAdminModal = function() {
  state.showAdminModal = false;
  renderApp();
};

window.handleAdminLogin = async function(e) {
  e.preventDefault();
  const password = document.getElementById('adminPassword').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      state.isAdmin = true;
      state.adminToken = data.token;
      await fetchPendingSubmissions();
      renderApp();
    } else {
      alert('Contraseña incorrecta');
    }
  } catch (err) {
    alert('Error al iniciar sesión');
  }
};

window.adminLogout = function() {
  state.isAdmin = false;
  state.adminToken = null;
  state.showAdminModal = false;
  renderApp();
};

window.setAdminTab = async function(tab) {
  state.adminTab = tab;
  if (tab === 'pending' && state.isAdmin && state.adminToken) {
    await fetchPendingSubmissions();
  }
  renderApp();
};

async function fetchPendingSubmissions() {
  if (!state.adminToken) return;
  try {
    const res = await fetch('/api/admin/pending', {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    state.pendingSubmissions = await res.json();
  } catch (err) {
    console.error('Error obteniendo solicitudes pendientes:', err);
  }
}

// Event Actions
window.openEventFormModal = function(id) {
  state.editingItem = id ? state.eventosMunicipales.find(e => e.id === id) : null;
  state.showEventFormModal = true;
  renderApp();
};

window.closeEventFormModal = function() {
  state.showEventFormModal = false;
  state.editingItem = null;
  renderApp();
};

window.saveEventForm = async function(e) {
  e.preventDefault();
  const isEdit = state.editingItem && state.editingItem.id;
  const body = {
    titulo: document.getElementById('editEvtTitulo').value,
    categoria: document.getElementById('editEvtCategoria').value,
    fecha: document.getElementById('editEvtFecha').value,
    lugar: document.getElementById('editEvtLugar').value,
    descripcion: document.getElementById('editEvtDescripcion').value,
    imagen: document.getElementById('editEvtImagen').value,
    oficialLink: document.getElementById('editEvtOficialLink').value
  };

  const url = isEdit ? `/api/admin/events/${state.editingItem.id}` : '/api/admin/events';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadAppData();
      window.closeEventFormModal();
      renderApp();
      alert('¡Evento municipal guardado!');
    }
  } catch (err) {
    alert('Error al guardar evento');
  }
};

window.deleteEvent = async function(id) {
  if (!confirm('¿Eliminar este evento municipal?')) return;
  try {
    await fetch(`/api/admin/events/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al eliminar evento');
  }
};

// Rubro Actions
window.openRubroFormModal = function(id) {
  state.editingItem = id ? state.rubros.find(r => r.id === id) : null;
  state.showRubroFormModal = true;
  renderApp();
};

window.closeRubroFormModal = function() {
  state.showRubroFormModal = false;
  state.editingItem = null;
  renderApp();
};

window.saveRubroForm = async function(e) {
  e.preventDefault();
  const isEdit = state.editingItem && state.editingItem.id;
  const body = {
    nombre: document.getElementById('editRubroNombre').value,
    icono: document.getElementById('editRubroIcono').value,
    color: document.getElementById('editRubroColor').value
  };

  const url = isEdit ? `/api/admin/rubros/${state.editingItem.id}` : '/api/admin/rubros';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadAppData();
      window.closeRubroFormModal();
    }
  } catch (err) {
    alert('Error al guardar categoría');
  }
};

window.deleteRubro = async function(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try {
    await fetch(`/api/admin/rubros/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al eliminar categoría');
  }
};

// Listing Actions
window.openListingFormModal = function(id) {
  state.editingItem = id ? state.listings.find(l => l.id === id) : null;
  state.showListingFormModal = true;
  renderApp();
};

window.closeListingFormModal = function() {
  state.showListingFormModal = false;
  state.editingItem = null;
  renderApp();
};

window.handleListingFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
        body: JSON.stringify({ filename: file.name, data: base64Data })
      });
      const data = await res.json();
      if (data.success && data.url) {
        const input = document.getElementById('editListFoto');
        const current = input.value ? input.value.split(',').map(s => s.trim()) : [];
        current.push(data.url);
        input.value = current.join(', ');
        alert('Foto subida con éxito');
      }
    } catch (err) {
      alert('Error subiendo foto');
    }
  };
  reader.readAsDataURL(file);
};

window.saveListingForm = async function(e) {
  e.preventDefault();
  const isEdit = state.editingItem && state.editingItem.id;
  const fotosStr = document.getElementById('editListFoto').value;
  const fotosArr = fotosStr ? fotosStr.split(',').map(f => f.trim()).filter(Boolean) : [];

  const body = {
    nombre: document.getElementById('editListNombre').value,
    rubroId: document.getElementById('editListRubroId').value,
    plan: document.getElementById('editListPlan').value,
    posicionTop: document.getElementById('editListPosicionTop').checked,
    colorPersonalizado: document.getElementById('editListColor').value,
    direccion: document.getElementById('editListDireccion').value,
    telefono: document.getElementById('editListTelefono').value,
    whatsapp: document.getElementById('editListWhatsapp').value || '5492241527357',
    descripcion: document.getElementById('editListDescripcion').value,
    fotos: fotosArr
  };

  const url = isEdit ? `/api/admin/listings/${state.editingItem.id}` : '/api/admin/listings';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadAppData();
      window.closeListingFormModal();
    }
  } catch (err) {
    alert('Error al guardar publicación');
  }
};

window.deleteListing = async function(id) {
  if (!confirm('¿Seguro que querés eliminar esta publicación?')) return;
  try {
    await fetch(`/api/admin/listings/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al eliminar');
  }
};

// Pharmacy Actions
window.openPharmacyFormModal = function(id) {
  state.editingItem = id ? state.farmacias.find(f => f.id === id) : null;
  state.showPharmacyFormModal = true;
  renderApp();
};

window.closePharmacyFormModal = function() {
  state.showPharmacyFormModal = false;
  state.editingItem = null;
  renderApp();
};

window.savePharmacyForm = async function(e) {
  e.preventDefault();
  const isEdit = state.editingItem && state.editingItem.id;
  
  const fechasStr = document.getElementById('editPharmFechas').value;
  const fechasArr = fechasStr ? fechasStr.split(',').map(d => d.trim()).filter(Boolean) : [];
  const selectedDays = Array.from(document.querySelectorAll('input[name="pharmDaysCheck"]:checked')).map(cb => cb.value);

  const body = {
    nombre: document.getElementById('editPharmNombre').value,
    direccion: document.getElementById('editPharmDireccion').value,
    telefono: document.getElementById('editPharmTelefono').value,
    horario: document.getElementById('editPharmHorario').value,
    fechasTurno: fechasArr,
    diasTurno: selectedDays
  };

  const url = isEdit ? `/api/admin/pharmacies/${state.editingItem.id}` : '/api/admin/pharmacies';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadAppData();
      window.closePharmacyFormModal();
      renderApp();
      alert('¡Farmacia guardada con éxito!');
    }
  } catch (err) {
    alert('Error al guardar farmacia');
  }
};

window.togglePharmacyTurn = async function(id) {
  const pharm = state.farmacias.find(f => f.id === id);
  if (!pharm) return;

  try {
    await fetch(`/api/admin/pharmacies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify({ deTurno: !pharm.deTurno })
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al actualizar farmacia');
  }
};

window.deletePharmacy = async function(id) {
  if (!confirm('¿Eliminar esta farmacia?')) return;
  try {
    await fetch(`/api/admin/pharmacies/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al eliminar farmacia');
  }
};

// Popup Actions
window.openPopupFormModal = function(id) {
  state.editingItem = id ? state.popups.find(p => p.id === id) : null;
  state.showPopupFormModal = true;
  renderApp();
};

window.closePopupFormModal = function() {
  state.showPopupFormModal = false;
  state.editingItem = null;
  renderApp();
};

window.handlePopupFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
        body: JSON.stringify({ filename: file.name, data: base64Data })
      });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('editPopImagen').value = data.url;
        alert('Imagen subida con éxito');
      }
    } catch (err) {
      alert('Error al subir imagen');
    }
  };
  reader.readAsDataURL(file);
};

window.savePopupForm = async function(e) {
  e.preventDefault();
  const isEdit = state.editingItem && state.editingItem.id;

  const body = {
    ubicacion: document.getElementById('editPopUbicacion').value,
    titulo: document.getElementById('editPopTitulo').value,
    subtitulo: document.getElementById('editPopSubtitulo').value,
    descripcion: document.getElementById('editPopDescripcion').value,
    imagen: document.getElementById('editPopImagen').value,
    botonTexto: document.getElementById('editPopBotonTexto').value,
    link: document.getElementById('editPopLink').value,
    activo: document.getElementById('editPopActivo').checked
  };

  const url = isEdit ? `/api/admin/popups/${state.editingItem.id}` : '/api/admin/popups';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadAppData();
      window.closePopupFormModal();
    }
  } catch (err) {
    alert('Error al guardar Pop-up');
  }
};

window.togglePopupActive = async function(id) {
  const pop = state.popups.find(p => p.id === id);
  if (!pop) return;

  try {
    await fetch(`/api/admin/popups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify({ activo: !pop.activo })
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al actualizar estado del Pop-up');
  }
};

window.deletePopup = async function(id) {
  if (!confirm('¿Eliminar este anuncio Pop-up?')) return;
  try {
    await fetch(`/api/admin/popups/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al eliminar Pop-up');
  }
};

window.approveSubmission = async function(id, plan) {
  try {
    const res = await fetch(`/api/admin/submissions/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify({ plan })
    });
    if (res.ok) {
      await loadAppData();
      await fetchPendingSubmissions();
      renderApp();
      alert('¡Solicitud aprobada y agregada al directorio!');
    }
  } catch (err) {
    alert('Error al aprobar');
  }
};

window.rejectSubmission = async function(id) {
  try {
    await fetch(`/api/admin/submissions/${id}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    await fetchPendingSubmissions();
    renderApp();
  } catch (err) {
    alert('Error al rechazar');
  }
};

window.handlePasswordChange = async function(e) {
  e.preventDefault();
  const p1 = document.getElementById('newAdminPassword').value;
  const p2 = document.getElementById('confirmAdminPassword').value;

  if (p1 !== p2) return alert('Las contraseñas no coinciden');

  try {
    const res = await fetch('/api/admin/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
      body: JSON.stringify({ newPassword: p1 })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      state.adminTab = 'pending';
      renderApp();
    } else {
      alert(data.error || 'Error al cambiar contraseña');
    }
  } catch (err) {
    alert('Error al cambiar clave');
  }
};
