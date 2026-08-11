// ==========================================================================
// GUÍA CHASCOMÚS - CLIENT APPLICATION LOGIC
// Branding: Desarrollado por rolϕ
// WhatsApp: 5492241527357
// ==========================================================================

const state = {
  rubros: [],
  farmacias: [],
  anuncios: {},
  listings: [],
  selectedRubro: 'todos',
  searchQuery: '',
  showSubmitModal: false,
  showAdModal: false,
  showAdminModal: false,
  isAdmin: false,
  adminToken: null,
  adminTab: 'pending', // 'pending', 'listings', 'pharmacies', 'ads', 'security'
  pendingSubmissions: [],
  whatsappAdmin: '5492241527357'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadAppData();
  renderApp();
  checkAdPopup();
});

async function loadAppData() {
  try {
    const [rubrosRes, farmaciasRes, anunciosRes, listingsRes] = await Promise.all([
      fetch('/api/rubros'),
      fetch('/api/pharmacies'),
      fetch('/api/ads'),
      fetch('/api/listings')
    ]);

    state.rubros = await rubrosRes.json();
    state.farmacias = await farmaciasRes.json();
    state.anuncios = await anunciosRes.json();
    state.listings = await listingsRes.json();

    if (state.isAdmin && state.adminToken) {
      await fetchPendingSubmissions();
    }
  } catch (err) {
    console.error('Error cargando datos de la API:', err);
  }
}

function checkAdPopup() {
  if (state.anuncios?.popup?.activo && !sessionStorage.getItem('ad_closed')) {
    state.showAdModal = true;
    renderApp();
  }
}

window.closeAdModal = function() {
  state.showAdModal = false;
  sessionStorage.setItem('ad_closed', 'true');
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
  const deTurno = state.farmacias.filter(f => f.deTurno);
  if (deTurno.length === 0) return '';

  return `
    <section style="margin-bottom: 36px;">
      <div class="section-title">
        <h3>💊 Farmacias de Turno en Chascomús</h3>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Cronograma de atención rotativo</span>
      </div>
      
      <div class="pharmacy-card-grid">
        ${deTurno.map(f => `
          <div class="pharmacy-card">
            <div class="pharmacy-badge">🔴 DE TURNO HOY</div>
            <h4>${f.nombre}</h4>
            <div class="pharmacy-info">
              <span>📍 ${f.direccion}</span>
              <span>📞 Tel: <strong>${f.telefono}</strong></span>
              <span>⏰ ${f.horario || 'Atención 24 hs'}</span>
              ${f.diasTurno && f.diasTurno.length > 0 ? `
                <div style="margin-top: 4px;">
                  <strong>Días asignados:</strong><br>
                  ${f.diasTurno.map(d => `<span class="day-badge">${d}</span>`).join('')}
                </div>
              ` : ''}
            </div>
            <div class="pharmacy-actions">
              <a href="tel:${f.telefono}" class="btn btn-outline" style="flex:1;">📞 Llamar</a>
              <a href="${f.mapsUrl}" target="_blank" class="btn btn-primary" style="flex:1;">📍 Cómo llegar</a>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderRubrosSection() {
  return `
    <section style="margin-bottom: 30px;">
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

  return `
    <section>
      <div class="section-title">
        <h3>Publicaciones y Clasificados (${filtered.length})</h3>
      </div>

      ${filtered.length === 0 ? `
        <div style="text-align: center; padding: 50px 20px; background: white; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <p style="font-size: 1.2rem; color: var(--text-muted);">No se encontraron publicaciones para tu búsqueda.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="window.resetFilters()">Ver todos los rubros</button>
        </div>
      ` : `
        <div class="listings-grid">
          ${filtered.map(l => l.plan === 'destacado' ? renderVipCard(l) : renderFreeCard(l)).join('')}
        </div>
      `}
    </section>
  `;
}

function renderVipCard(l) {
  const mainFoto = (l.fotos && l.fotos.length > 0) ? l.fotos[0] : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=600&auto=format&fit=crop&q=80';

  return `
    <div class="card-vip">
      <div class="vip-badge-ribbon">⭐ DESTACADO</div>
      <img src="${mainFoto}" alt="${l.nombre}" class="card-vip-image" />
      <div class="card-vip-body">
        <span class="card-category">${l.rubroNombre}</span>
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
  const ad = state.anuncios?.popup;
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
        <h3>Publicá tu Comercio o Servicio Gratis</h3>
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
              ${state.rubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('')}
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

  return `
    <div class="modal-overlay">
      <div class="form-modal-content" style="max-width: 950px; width: 95%;">
        <button class="modal-close-btn" onclick="window.closeAdminModal()">✕</button>

        <div class="admin-header">
          <div>
            <h3 style="color: white; margin: 0;">Panel de Administración</h3>
            <span style="font-size: 0.85rem; opacity: 0.8;">Gestión de Guía Chascomús</span>
          </div>
          <button class="btn btn-outline" style="color: white; border-color: rgba(255,255,255,0.3);" onclick="window.adminLogout()">Cerrar Sesión</button>
        </div>

        <div class="admin-tabs">
          <button class="tab-btn ${state.adminTab === 'pending' ? 'active' : ''}" onclick="window.setAdminTab('pending')">
            📩 Solicitudes Pendientes (${state.pendingSubmissions.length})
          </button>
          <button class="tab-btn ${state.adminTab === 'listings' ? 'active' : ''}" onclick="window.setAdminTab('listings')">
            📖 Publicaciones (${state.listings.length})
          </button>
          <button class="tab-btn ${state.adminTab === 'pharmacies' ? 'active' : ''}" onclick="window.setAdminTab('pharmacies')">
            💊 Farmacias (Semanal / Rotativas)
          </button>
          <button class="tab-btn ${state.adminTab === 'ads' ? 'active' : ''}" onclick="window.setAdminTab('ads')">
            📢 Anuncios & Pop-up
          </button>
          <button class="tab-btn ${state.adminTab === 'security' ? 'active' : ''}" onclick="window.setAdminTab('security')">
            🔒 Cambiar Contraseña
          </button>
        </div>

        <div>
          ${state.adminTab === 'pending' ? renderAdminPendingTab() : ''}
          ${state.adminTab === 'listings' ? renderAdminListingsTab() : ''}
          ${state.adminTab === 'pharmacies' ? renderAdminPharmaciesTab() : ''}
          ${state.adminTab === 'ads' ? renderAdminAdsTab() : ''}
          ${state.adminTab === 'security' ? renderAdminSecurityTab() : ''}
        </div>
      </div>
    </div>
  `;
}

function renderAdminPendingTab() {
  if (state.pendingSubmissions.length === 0) {
    return `<div style="text-align: center; padding: 40px; color: var(--text-muted); background: #f8fafc; border-radius: var(--radius-md);">No hay solicitudes pendientes en este momento.</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Comercio / Nombre</th>
            <th>Rubro</th>
            <th>Contacto / Teléfono</th>
            <th>Descripción</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${state.pendingSubmissions.map(s => `
            <tr>
              <td><strong>${s.nombre}</strong><br><small>${s.direccion}</small></td>
              <td>${s.rubroNombre}</td>
              <td>📞 ${s.telefono}</td>
              <td><small>${s.descripcion}</small></td>
              <td>
                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.approveSubmission('${s.id}', 'gratuito')">Aprobar Gratis</button>
                <button class="btn btn-whatsapp" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.approveSubmission('${s.id}', 'destacado')">Aprobar Destacado VIP</button>
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; color: red;" onclick="window.rejectSubmission('${s.id}')">Rechazar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminListingsTab() {
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4>Todas las Publicaciones Activas</h4>
        <button class="btn btn-primary" onclick="window.showCreateListingPrompt()">+ Nueva Publicación</button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rubro</th>
              <th>Plan</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.listings.map(l => `
              <tr>
                <td><strong>${l.nombre}</strong></td>
                <td>${l.rubroNombre}</td>
                <td>
                  <span style="padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; background: ${l.plan === 'destacado' ? 'var(--accent-gold-light)' : '#f1f5f9'}; color: ${l.plan === 'destacado' ? 'var(--accent-gold)' : 'var(--text-muted)'}">
                    ${l.plan === 'destacado' ? '⭐ DESTACADO' : 'GRATIS'}
                  </span>
                </td>
                <td>${l.telefono}</td>
                <td>
                  <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.toggleListingPlan('${l.id}')">
                    Cambiar a ${l.plan === 'destacado' ? 'Gratis' : 'Destacado'}
                  </button>
                  <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: red;" onclick="window.deleteListing('${l.id}')">
                    Eliminar
                  </button>
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
  return `
    <div>
      <h4 style="margin-bottom: 8px;">Carga Semanal & Rotación de Farmacias de Turno</h4>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
        Podés activar/desactivar quién está de turno hoy o asignarles días específicos de la semana para una carga masiva.
      </p>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Farmacia</th>
              <th>Dirección & Teléfono</th>
              <th>Días Asignados en la Semana</th>
              <th>De Turno Hoy</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${state.farmacias.map(f => `
              <tr>
                <td><strong>${f.nombre}</strong></td>
                <td>📍 ${f.direccion}<br>📞 ${f.telefono}</td>
                <td>
                  ${(f.diasTurno || []).map(d => `<span class="day-badge">${d}</span>`).join('') || '<em>Sin días asignados</em>'}
                </td>
                <td>
                  <span style="color: ${f.deTurno ? 'green' : 'gray'}; font-weight: 700;">
                    ${f.deTurno ? '🔴 DE TURNO' : '⚪ REGULAR'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.togglePharmacyTurn('${f.id}')">
                    ${f.deTurno ? 'Quitar Turno' : 'Poner De Turno'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Tab Anuncios con Selector de Archivos Locales desde la Compu
function renderAdminAdsTab() {
  const ad = state.anuncios?.popup || {};

  return `
    <div>
      <h4 style="margin-bottom: 16px;">Configuración de Anuncio Emergente (Pop-up de Bienvenida)</h4>
      
      <form onsubmit="window.saveAdsConfig(event)">
        <div class="form-group">
          <label>
            <input type="checkbox" id="adActivo" ${ad.activo ? 'checked' : ''} /> 
            <strong>Mostrar Pop-up de Publicidad al ingresar al sitio</strong>
          </label>
        </div>

        <div class="form-group">
          <label>Título del Anuncio</label>
          <input type="text" id="adTitulo" value="${ad.titulo || ''}" required />
        </div>

        <div class="form-group">
          <label>Subtítulo / Promo</label>
          <input type="text" id="adSubtitulo" value="${ad.subtitulo || ''}" />
        </div>

        <div class="form-group">
          <label>Descripción detallada</label>
          <textarea id="adDescripcion" rows="3">${ad.descripcion || ''}</textarea>
        </div>

        <div class="form-group" style="background: #f1f5f9; padding: 16px; border-radius: var(--radius-md); border: 1px dashed var(--primary);">
          <label style="font-weight: 700; color: var(--primary-dark);">📷 Imagen del Anuncio (Subir desde la Compu)</label>
          <input type="file" id="adFileInput" accept="image/*" onchange="window.handleAdFileUpload(event)" style="margin-top: 6px; margin-bottom: 10px;" />
          <p style="font-size: 0.8rem; color: var(--text-muted);">Elegí una imagen (JPG, PNG, WEBP) desde tus archivos. Se guardará en la app automáticamente.</p>
          
          <div style="margin-top: 10px;">
            <label style="font-size: 0.8rem;">URL actual de la imagen:</label>
            <input type="text" id="adImagen" value="${ad.imagen || ''}" readonly style="background: white;" />
          </div>

          ${ad.imagen ? `
            <div style="margin-top: 12px; text-align: center;">
              <span style="font-size: 0.8rem; display: block; margin-bottom: 4px; font-weight: 600;">Vista Previa de la Imagen:</span>
              <img id="adImagePreview" src="${ad.imagen}" style="max-height: 140px; border-radius: var(--radius-sm); border: 1px solid var(--border); box-shadow: var(--shadow-sm);" />
            </div>
          ` : ''}
        </div>

        <div class="form-group">
          <label>Enlace del Botón (WhatsApp / Web)</label>
          <input type="text" id="adLink" value="${ad.link || ''}" />
        </div>

        <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Guardar Cambios de Publicidad</button>
      </form>
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

// ---------------- ACCIONES GLOBALES Y SUBIDA DE ARCHIVOS ---------------- //

window.handleAdFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.adminToken}` 
        },
        body: JSON.stringify({
          filename: file.name,
          data: base64Data
        })
      });
      const data = await res.json();

      if (data.success && data.url) {
        document.getElementById('adImagen').value = data.url;
        
        const preview = document.getElementById('adImagePreview');
        if (preview) {
          preview.src = data.url;
        }
        alert('¡Imagen subida correctamente desde tu computadora!');
      } else {
        alert(data.error || 'Error al subir la imagen.');
      }
    } catch (err) {
      alert('Error de conexión al subir la imagen.');
    }
  };

  reader.readAsDataURL(file);
};

window.filterRubro = function(rubroId) {
  state.selectedRubro = rubroId;
  renderApp();
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

// Admin Actions
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

window.approveSubmission = async function(id, plan) {
  try {
    const res = await fetch(`/api/admin/submissions/${id}/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
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

window.toggleListingPlan = async function(id) {
  const listing = state.listings.find(l => l.id === id);
  if (!listing) return;

  const newPlan = listing.plan === 'destacado' ? 'gratuito' : 'destacado';

  try {
    await fetch(`/api/admin/listings/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
      body: JSON.stringify({ plan: newPlan })
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al actualizar plan');
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

window.togglePharmacyTurn = async function(id) {
  const updatedFarmacias = state.farmacias.map(f => {
    if (f.id === id) return { ...f, deTurno: !f.deTurno };
    return f;
  });

  try {
    await fetch('/api/admin/pharmacies', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
      body: JSON.stringify({ farmacias: updatedFarmacias })
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al actualizar farmacias');
  }
};

window.saveAdsConfig = async function(e) {
  e.preventDefault();
  const newAds = {
    ...state.anuncios,
    popup: {
      activo: document.getElementById('adActivo').checked,
      titulo: document.getElementById('adTitulo').value,
      subtitulo: document.getElementById('adSubtitulo').value,
      descripcion: document.getElementById('adDescripcion').value,
      imagen: document.getElementById('adImagen').value,
      link: document.getElementById('adLink').value,
      botonTexto: 'Ver Ubicación & Promociones'
    }
  };

  try {
    await fetch('/api/admin/ads', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
      body: JSON.stringify({ anuncios: newAds })
    });
    await loadAppData();
    renderApp();
    alert('¡Configuración de anuncios guardada!');
  } catch (err) {
    alert('Error al guardar anuncios');
  }
};

window.handlePasswordChange = async function(e) {
  e.preventDefault();
  const p1 = document.getElementById('newAdminPassword').value;
  const p2 = document.getElementById('confirmAdminPassword').value;

  if (p1 !== p2) {
    return alert('Las contraseñas no coinciden');
  }

  try {
    const res = await fetch('/api/admin/password', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
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
    alert('Error de conexión al cambiar la clave');
  }
};

window.showCreateListingPrompt = async function() {
  const nombre = prompt('Nombre del comercio o servicio:');
  if (!nombre) return;
  const telefono = prompt('Teléfono de contacto:');
  if (!telefono) return;
  const descripcion = prompt('Descripción breve:');
  
  try {
    await fetch('/api/admin/listings', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}` 
      },
      body: JSON.stringify({
        nombre,
        telefono,
        rubroId: 'servicios',
        descripcion: descripcion || '',
        plan: 'gratuito'
      })
    });
    await loadAppData();
    renderApp();
  } catch (err) {
    alert('Error al crear publicación');
  }
};
