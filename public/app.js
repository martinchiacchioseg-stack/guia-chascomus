// ==========================================================================
// GUÍA CHASCOMÚS - CLIENT APPLICATION LOGIC (v6.0 - Duty by Month Dates & Optional Phone)
// Branding: Desarrollado por rolϕ
// WhatsApp: 5492241527357
// ==========================================================================

const state = {
  rubros: [],
  farmacias: [],
  popups: [],
  activePopup: null,
  listings: [],
  selectedRubro: 'todos',
  searchQuery: '',
  showSubmitModal: false,
  showAdModal: false,
  showAdminModal: false,
  showListingFormModal: false,
  showPharmacyFormModal: false,
  showPopupFormModal: false,
  showRubroFormModal: false,
  editingItem: null,
  isAdmin: false,
  adminToken: null,
  adminTab: 'pending',
  pendingSubmissions: [],
  whatsappAdmin: '5492241527357'
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getPharmDutyDateInfo() {
  const now = new Date();
  const hours = now.getHours();

  let targetDate = new Date(now);
  // Si son antes de las 08:00 AM, el turno pertenece al día anterior
  if (hours < 8) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const y = targetDate.getFullYear();

  return {
    fullDate: `${d}/${m}/${y}`, // "13/08/2026"
    shortDate: `${d}/${m}`,     // "13/08"
    dayName: DIAS_SEMANA[targetDate.getDay()]
  };
}

function isPharmDeTurnoToday(f) {
  if (f.deTurno) return true;

  const dutyInfo = getPharmDutyDateInfo();

  // 1. Verificar fechas específicas del mes (ej: "10/08", "13/08", "25/08")
  if (f.fechasTurno && Array.isArray(f.fechasTurno) && f.fechasTurno.length > 0) {
    const isMatch = f.fechasTurno.some(fechaStr => {
      const clean = String(fechaStr).trim().replace(/-/g, '/');
      return clean === dutyInfo.fullDate || clean === dutyInfo.shortDate || clean.startsWith(dutyInfo.shortDate);
    });
    if (isMatch) return true;
  }

  // 2. Verificar por día de semana (ej: "Lunes", "Miércoles")
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
    const [rubrosRes, farmaciasRes, popupsRes, listingsRes] = await Promise.all([
      fetch('/api/rubros'),
      fetch('/api/pharmacies'),
      fetch('/api/popups'),
      fetch('/api/listings')
    ]);

    state.rubros = await rubrosRes.json();
    state.farmacias = await farmaciasRes.json();
    state.popups = await popupsRes.json();
    state.listings = await listingsRes.json();

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
      ${renderRubrosSection()}
      ${renderListingsSection()}
    </main>

    ${renderFooter()}
    
    ${state.showAdModal ? renderAdModal() : ''}
    ${state.showSubmitModal ? renderSubmitModal() : ''}
    ${state.showAdminModal ? renderAdminModal() : ''}
    ${state.showListingFormModal ? renderListingFormModal() : ''}
    ${state.showPharmacyFormModal ? renderPharmacyFormModal() : ''}
    ${state.showPopupFormModal ? renderPopupFormModal() : ''}
    ${state.showRubroFormModal ? renderRubroFormModal() : ''}
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
            <span>Comercio & Servicios <span class="dev-badge">Desarrollado por <span class="phi">rolϕ</span></span></span>
          </div>
        </div>
        
        <div class="nav-actions">
          <button class="btn btn-whatsapp" onclick="window.openWhatsAppAdmin()">
            💬 Publicá por WhatsApp
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
    <section class="hero">
      <div class="hero-bg-pattern"></div>
      <div class="hero-content">
        <div class="hero-badge">📍 Chascomús, Provincia de Buenos Aires</div>
        <h2>Encontrá todo en Chascomús</h2>
        <p>Farmacias de turno, profesionales, comercios y servicios al instante.</p>
        
        <div class="search-box">
          <input 
            type="text" 
            id="searchInput" 
            placeholder="¿Qué estás buscando? (Ej: Plomero, Remis, Pizzería, Ferretería...)"
            value="${state.searchQuery}"
            oninput="window.onSearchChange(event)"
          />
          <button class="btn btn-primary">🔍 Buscar</button>
        </div>
      </div>
    </section>
  `;
}

function renderFarmaciasSection() {
  const dutyInfo = getPharmDutyDateInfo();
  const deTurno = state.farmacias.filter(f => isPharmDeTurnoToday(f));
  if (deTurno.length === 0) return '';

  return `
    <section style="margin-bottom: 36px;">
      <div class="section-title">
        <h3>💊 Farmacias de Turno HOY (${dutyInfo.dayName} ${dutyInfo.shortDate})</h3>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Guardia 24hs: 08:00 AM a 08:00 AM del día siguiente</span>
      </div>
      
      <div class="pharmacy-card-grid">
        ${deTurno.map(f => {
          const hasAd = state.popups.some(p => (p.ubicacion === 'pharmacy_' + f.id || p.ubicacion === f.id) && p.activo);
          return `
            <div class="pharmacy-card" onclick="window.checkPharmacyPopup('${f.id}')" style="cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="pharmacy-badge">🔴 DE TURNO HOY (${dutyInfo.shortDate})</div>
                ${hasAd ? '<span style="font-size: 0.75rem; background: var(--accent-gold); color: white; padding: 2px 8px; border-radius: 99px; font-weight: 700;">📢 PROMO DISPONIBLE</span>' : ''}
              </div>
              <h4>${f.nombre}</h4>
              <div class="pharmacy-info">
                <span>📍 ${f.direccion}</span>
                ${f.telefono ? `<span>📞 Tel: <strong>${f.telefono}</strong></span>` : ''}
                <span>⏰ ${f.horario || 'Turno 24 hs (08:00 a 08:00 hs)'}</span>
                ${f.fechasTurno && f.fechasTurno.length > 0 ? `
                  <div style="margin-top: 4px;">
                    <strong>Fechas asignadas en el mes:</strong><br>
                    ${f.fechasTurno.map(fecha => `<span class="day-badge" style="${fecha.includes(dutyInfo.shortDate) ? 'background: #ef4444; color: white;' : ''}">${fecha}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="pharmacy-actions">
                ${f.telefono ? `<a href="tel:${f.telefono}" class="btn btn-outline" style="flex:1;" onclick="event.stopPropagation(); window.checkPharmacyPopup('${f.id}');">📞 Llamar</a>` : ''}
                <a href="${f.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(f.nombre)}+Chascomus`}" target="_blank" class="btn btn-primary" style="flex:1;" onclick="event.stopPropagation(); window.checkPharmacyPopup('${f.id}');">📍 Cómo llegar</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderRubrosSection() {
  return `
    <section style="margin-bottom: 30px;" id="rubros-section">
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
  let filtered = state.listings;
  let rubroObj = state.rubros.find(r => r.id === state.selectedRubro);

  if (state.selectedRubro !== 'todos') {
    filtered = filtered.filter(l => l.rubroId === state.selectedRubro);
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(l => 
      l.nombre.toLowerCase().includes(q) ||
      l.descripcion.toLowerCase().includes(q) ||
      l.rubroNombre.toLowerCase().includes(q) ||
      l.direccion.toLowerCase().includes(q)
    );
  }

  const tituloSeccion = state.selectedRubro === 'todos' 
    ? `Publicaciones y Clasificados (${filtered.length})` 
    : `${rubroObj ? rubroObj.icono + ' ' + rubroObj.nombre : 'Categoría'} (${filtered.length})`;

  return `
    <section id="listings-section" style="scroll-margin-top: 80px;">
      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <h3>${tituloSeccion}</h3>
        ${state.selectedRubro !== 'todos' ? `
          <button class="btn btn-outline" style="font-size: 0.82rem; padding: 6px 14px;" onclick="window.resetFilters()">
            ✕ Ver Todos los Rubros
          </button>
        ` : ''}
      </div>

      ${filtered.length === 0 ? `
        <div style="text-align: center; padding: 50px 20px; background: white; border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
          <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 12px;">
            ${state.selectedRubro !== 'todos' ? `Aún no hay publicaciones cargadas en <strong>${rubroObj ? rubroObj.nombre : 'esta categoría'}</strong>.` : 'No se encontraron publicaciones para tu búsqueda.'}
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.openSubmitModal()">➕ Sé el primero en publicar gratis</button>
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
                    ${(f.diasTurno || []).map(d => `<span class="day-badge" style="${d === dutyInfo.dayName ? 'background: #ef4444; color: white;' : ''}">${d}</span>`).join('')}
                    ${!fechasStr && (!f.diasTurno || f.diasTurno.length === 0) ? '<em>Sin fechas asignadas</em>' : ''}
                  </td>
                  <td>
                    <span style="color: ${deTurnoHoy ? 'green' : 'gray'}; font-weight: 700;">
                      ${deTurnoHoy ? `🔴 DE TURNO (Hoy ${dutyInfo.shortDate})` : '⚪ REGULAR'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.togglePharmacyTurn('${f.id}')">
                      ${f.deTurno ? 'Quitar Fuerza Turno' : 'Forzar Turno'}
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
            <label style="font-weight: 700; color: #86198f;">📅 Fechas Específicas del Mes (Ej: 10/08, 17/08, 24/08, 31/08):</label>
            <input type="text" id="editPharmFechas" value="${fechasAsignadas}" placeholder="Ej: 10/08, 17/08, 24/08, 31/08" style="margin-top: 6px;" />
            <small style="color: #701a75; display: block; margin-top: 4px;">Ingresá 3, 4 o todas las fechas separadas por coma. El sistema las activará de 08:00 AM a 08:00 AM del día siguiente.</small>
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

window.filterRubro = function(rubroId) {
  state.selectedRubro = rubroId;
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
      alert('¡Farmacia guardada con éxito! El sistema activará el turno de 08:00 AM a 08:00 AM según las fechas o días asignados.');
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
