import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

async function requestHandler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  // ---------------- API PÚBLICAS ---------------- //

  if (pathname === '/api/rubros' && method === 'GET') {
    const db = getDb();
    return sendJson(res, db.rubros || []);
  }

  if (pathname === '/api/pharmacies' && method === 'GET') {
    const db = getDb();
    return sendJson(res, db.farmacias || []);
  }

  if (pathname === '/api/popups' && method === 'GET') {
    const db = getDb();
    const ubicacion = reqUrl.searchParams.get('ubicacion');
    let popups = db.popups || [];

    if (ubicacion) {
      popups = popups.filter(p => p.ubicacion === ubicacion && p.activo);
    } else {
      popups = popups.filter(p => p.activo);
    }
    return sendJson(res, popups);
  }

  if (pathname === '/api/ads' && method === 'GET') {
    const db = getDb();
    return sendJson(res, db.popups || []);
  }

  if (pathname === '/api/listings' && method === 'GET') {
    const db = getDb();
    let listings = db.listings || [];
    const rubro = reqUrl.searchParams.get('rubro');
    const q = reqUrl.searchParams.get('q');
    const plan = reqUrl.searchParams.get('plan');

    if (rubro && rubro !== 'todos') {
      listings = listings.filter(l => l.rubroId === rubro);
    }

    if (q) {
      const term = q.toLowerCase().trim();
      listings = listings.filter(l => 
        l.nombre.toLowerCase().includes(term) ||
        l.descripcion.toLowerCase().includes(term) ||
        (l.rubroNombre && l.rubroNombre.toLowerCase().includes(term)) ||
        (l.direccion && l.direccion.toLowerCase().includes(term))
      );
    }

    if (plan) {
      listings = listings.filter(l => l.plan === plan);
    }

    // Ordenar: Posición Top arriba -> Oro VIP -> Plata -> Gratuito
    listings.sort((a, b) => {
      if (a.posicionTop && !b.posicionTop) return -1;
      if (!a.posicionTop && b.posicionTop) return 1;

      const score = (p) => (p === 'oro' || p === 'destacado' ? 3 : p === 'plata' ? 2 : 1);
      const scoreA = score(a.plan);
      const scoreB = score(b.plan);

      if (scoreA !== scoreB) return scoreB - scoreA;
      return (b.id || '').localeCompare(a.id || '');
    });

    return sendJson(res, listings);
  }

  if (pathname === '/api/submissions' && method === 'POST') {
    const body = await getRequestBody(req);
    const { nombre, rubroId, direccion, telefono, whatsapp, contactoNombre, descripcion } = body;
    
    if (!nombre || !telefono) {
      return sendJson(res, { error: 'El nombre y teléfono son obligatorios.' }, 400);
    }

    const db = getDb();
    const rubroObj = db.rubros.find(r => r.id === rubroId) || { nombre: 'Otro' };

    const newSub = {
      id: 'sub_' + Date.now(),
      nombre,
      rubroId,
      rubroNombre: rubroObj.nombre,
      direccion: direccion || 'Chascomús',
      telefono,
      whatsapp: whatsapp || ('549' + telefono.replace(/\D/g, '')),
      contactoNombre: contactoNombre || nombre,
      descripcion: descripcion || '',
      planDeseado: body.planDeseado || 'gratuito',
      estado: 'pendiente',
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    db.submissions.unshift(newSub);
    saveDb(db);

    return sendJson(res, { success: true, message: '¡Solicitud recibida con éxito! El administrador la revisará a la brevedad.' });
  }

  // ---------------- API ADMIN ---------------- //

  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await getRequestBody(req);
    const db = getDb();

    // Acepta la clave guardada en DB, admin123, o la clave previa Chiacchio@1938
    const allowedPasswords = [db.adminPassword, 'admin123', 'Chiacchio@1938'].filter(Boolean);

    if (allowedPasswords.includes(body.password)) {
      return sendJson(res, { success: true, token: 'session_admin_chascomus_token_2026' });
    }
    return sendJson(res, { success: false, error: 'Contraseña incorrecta' }, 401);
  }

  const authHeader = req.headers.authorization;
  const isAdminAuthorized = authHeader === 'Bearer session_admin_chascomus_token_2026';

  if (pathname.startsWith('/api/admin/')) {
    if (!isAdminAuthorized) {
      return sendJson(res, { error: 'No autorizado' }, 403);
    }

    // CRUD RUBROS (Categorías)
    if (pathname === '/api/admin/rubros' && method === 'POST') {
      const body = await getRequestBody(req);
      const db = getDb();
      const idClean = (body.nombre || 'rubro').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
      const newRubro = {
        id: body.id || idClean,
        nombre: body.nombre || 'Nueva Categoría',
        icono: body.icono || '📁',
        color: body.color || '#0284c7'
      };
      if (!db.rubros) db.rubros = [];
      db.rubros.push(newRubro);
      saveDb(db);
      return sendJson(res, { success: true, rubro: newRubro });
    }

    if (pathname.startsWith('/api/admin/rubros/') && method === 'PUT') {
      const id = pathname.split('/')[4];
      const body = await getRequestBody(req);
      const db = getDb();
      const idx = db.rubros.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.rubros[idx] = { ...db.rubros[idx], ...body };
        saveDb(db);
        return sendJson(res, { success: true, rubro: db.rubros[idx] });
      }
      return sendJson(res, { error: 'Rubro no encontrado' }, 404);
    }

    if (pathname.startsWith('/api/admin/rubros/') && method === 'DELETE') {
      const id = pathname.split('/')[4];
      const db = getDb();
      db.rubros = db.rubros.filter(r => r.id !== id);
      saveDb(db);
      return sendJson(res, { success: true });
    }

    if (pathname === '/api/admin/upload' && method === 'POST') {
      const body = await getRequestBody(req);
      const { filename, data } = body;

      if (!data || !filename) {
        return sendJson(res, { error: 'Nombre y datos de archivo requeridos' }, 400);
      }

      try {
        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;

        if (matches && matches.length === 3) {
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(data, 'base64');
        }

        const ext = path.extname(filename) || '.jpg';
        const cleanName = 'img_' + Date.now() + ext;
        const savePath = path.join(UPLOADS_DIR, cleanName);

        fs.writeFileSync(savePath, buffer);

        const publicUrl = '/uploads/' + cleanName;
        return sendJson(res, { success: true, url: publicUrl });
      } catch (err) {
        console.error('Error guardando imagen subida:', err);
        return sendJson(res, { error: 'Error procesando la imagen' }, 500);
      }
    }

    if (pathname === '/api/admin/password' && method === 'PUT') {
      const body = await getRequestBody(req);
      if (!body.newPassword || body.newPassword.trim().length < 4) {
        return sendJson(res, { error: 'La nueva contraseña debe tener al menos 4 caracteres.' }, 400);
      }
      const db = getDb();
      db.adminPassword = body.newPassword.trim();
      saveDb(db);
      return sendJson(res, { success: true, message: '¡Contraseña actualizada correctamente!' });
    }

    if (pathname === '/api/admin/popups' && method === 'GET') {
      const db = getDb();
      return sendJson(res, db.popups || []);
    }

    if (pathname === '/api/admin/popups' && method === 'POST') {
      const body = await getRequestBody(req);
      const db = getDb();
      const newPopup = {
        id: 'pop_' + Date.now(),
        ubicacion: body.ubicacion || 'portada',
        tipo: body.tipo || 'popup', // 'popup' o 'banner_top'
        activo: body.activo !== undefined ? body.activo : true,
        titulo: body.titulo || 'Nueva Publicidad',
        subtitulo: body.subtitulo || '',
        descripcion: body.descripcion || '',
        imagen: body.imagen || '',
        botonTexto: body.botonTexto || 'Ver Promociones',
        link: body.link || 'https://wa.me/5492241527357'
      };
      if (!db.popups) db.popups = [];
      db.popups.unshift(newPopup);
      saveDb(db);
      return sendJson(res, { success: true, popup: newPopup });
    }

    if (pathname.startsWith('/api/admin/popups/') && method === 'PUT') {
      const id = pathname.split('/')[4];
      const body = await getRequestBody(req);
      const db = getDb();
      const idx = (db.popups || []).findIndex(p => p.id === id);
      if (idx !== -1) {
        db.popups[idx] = { ...db.popups[idx], ...body };
        saveDb(db);
        return sendJson(res, { success: true, popup: db.popups[idx] });
      }
      return sendJson(res, { error: 'Pop-up no encontrado' }, 404);
    }

    if (pathname.startsWith('/api/admin/popups/') && method === 'DELETE') {
      const id = pathname.split('/')[4];
      const db = getDb();
      db.popups = (db.popups || []).filter(p => p.id !== id);
      saveDb(db);
      return sendJson(res, { success: true });
    }

    if (pathname === '/api/admin/pharmacies' && method === 'POST') {
      const body = await getRequestBody(req);
      const db = getDb();
      const newPharm = {
        id: 'f_' + Date.now(),
        nombre: body.nombre || 'Nueva Farmacia',
        direccion: body.direccion || 'Chascomús',
        telefono: body.telefono || '',
        horario: body.horario || 'Atención Regular',
        deTurno: body.deTurno || false,
        diasTurno: body.diasTurno || [],
        mapsUrl: body.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(body.nombre || 'Farmacia')}+Chascomus`
      };
      if (!db.farmacias) db.farmacias = [];
      db.farmacias.push(newPharm);
      saveDb(db);
      return sendJson(res, { success: true, farmacia: newPharm });
    }

    if (pathname.startsWith('/api/admin/pharmacies/') && method === 'PUT') {
      const id = pathname.split('/')[4];
      const body = await getRequestBody(req);
      const db = getDb();
      const idx = db.farmacias.findIndex(f => f.id === id);
      if (idx !== -1) {
        db.farmacias[idx] = { ...db.farmacias[idx], ...body };
        saveDb(db);
        return sendJson(res, { success: true, farmacia: db.farmacias[idx] });
      }
      return sendJson(res, { error: 'Farmacia no encontrada' }, 404);
    }

    if (pathname.startsWith('/api/admin/pharmacies/') && method === 'DELETE') {
      const id = pathname.split('/')[4];
      const db = getDb();
      db.farmacias = db.farmacias.filter(f => f.id !== id);
      saveDb(db);
      return sendJson(res, { success: true });
    }

    if (pathname === '/api/admin/pending' && method === 'GET') {
      const db = getDb();
      const pending = (db.submissions || []).filter(s => s.estado === 'pendiente');
      return sendJson(res, pending);
    }

    if (pathname.startsWith('/api/admin/submissions/') && pathname.endsWith('/approve') && method === 'POST') {
      const parts = pathname.split('/');
      const id = parts[4];
      const body = await getRequestBody(req);
      const db = getDb();

      const subIndex = db.submissions.findIndex(s => s.id === id);
      if (subIndex !== -1) {
        const sub = db.submissions[subIndex];
        sub.estado = 'aprobado';

        const newListing = {
          id: 'l_' + Date.now(),
          nombre: sub.nombre,
          rubroId: sub.rubroId,
          rubroNombre: sub.rubroNombre,
          plan: body.plan || 'gratuito',
          posicionTop: body.posicionTop || false,
          colorPersonalizado: body.colorPersonalizado || '',
          direccion: sub.direccion,
          telefono: sub.telefono,
          whatsapp: sub.whatsapp,
          descripcion: sub.descripcion,
          horarios: 'Consultar por teléfono',
          redes: '',
          fotos: [],
          verificado: true,
          fechaAlta: new Date().toISOString().substring(0, 10)
        };

        db.listings.unshift(newListing);
        saveDb(db);
        return sendJson(res, { success: true, listing: newListing });
      }
      return sendJson(res, { error: 'No encontrado' }, 404);
    }

    if (pathname.startsWith('/api/admin/submissions/') && pathname.endsWith('/reject') && method === 'POST') {
      const parts = pathname.split('/');
      const id = parts[4];
      const db = getDb();
      const subIndex = db.submissions.findIndex(s => s.id === id);
      if (subIndex !== -1) {
        db.submissions[subIndex].estado = 'rechazado';
        saveDb(db);
      }
      return sendJson(res, { success: true });
    }

    if (pathname === '/api/admin/listings' && method === 'POST') {
      const body = await getRequestBody(req);
      const db = getDb();
      const rubroObj = db.rubros.find(r => r.id === body.rubroId) || { nombre: 'General' };

      const newListing = {
        id: 'l_' + Date.now(),
        nombre: body.nombre || 'Nuevo Comercio',
        rubroId: body.rubroId || 'servicios',
        rubroNombre: rubroObj.nombre,
        plan: body.plan || 'gratuito',
        posicionTop: body.posicionTop || false,
        resaltado: body.resaltado || false,
        colorPersonalizado: body.colorPersonalizado || '',
        direccion: body.direccion || 'Chascomús',
        telefono: body.telefono || '',
        whatsapp: body.whatsapp || ('549' + (body.telefono || '').replace(/\D/g, '')),
        descripcion: body.descripcion || '',
        horarios: body.horarios || '',
        redes: body.redes || '',
        fotos: body.fotos || [],
        verificado: true,
        fechaAlta: new Date().toISOString().substring(0, 10)
      };

      db.listings.unshift(newListing);
      saveDb(db);
      return sendJson(res, { success: true, listing: newListing });
    }

    if (pathname.startsWith('/api/admin/listings/') && method === 'PUT') {
      const id = pathname.split('/')[4];
      const body = await getRequestBody(req);
      const db = getDb();
      const idx = db.listings.findIndex(l => l.id === id);
      if (idx !== -1) {
        const rubroObj = db.rubros.find(r => r.id === body.rubroId) || { nombre: db.listings[idx].rubroNombre };
        db.listings[idx] = { ...db.listings[idx], ...body, rubroNombre: rubroObj.nombre };
        saveDb(db);
        return sendJson(res, { success: true, listing: db.listings[idx] });
      }
      return sendJson(res, { error: 'No encontrado' }, 404);
    }

    if (pathname.startsWith('/api/admin/listings/') && method === 'DELETE') {
      const id = pathname.split('/')[4];
      const db = getDb();
      db.listings = db.listings.filter(l => l.id !== id);
      saveDb(db);
      return sendJson(res, { success: true });
    }

    if (pathname === '/api/admin/pharmacies' && method === 'PUT') {
      const body = await getRequestBody(req);
      const db = getDb();
      db.farmacias = body.farmacias || [];
      saveDb(db);
      return sendJson(res, { success: true, farmacias: db.farmacias });
    }
  }

  // ---------------- ARCHIVOS ESTÁTICOS FRONTEND ---------------- //

  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.join(PUBLIC_DIR, relPath);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    let rootPath = path.join(__dirname, relPath);
    if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
      filePath = rootPath;
    } else {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'index.html');
      }
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (readErr, content) => {
    if (readErr) {
      res.writeHead(500);
      return res.end('Error del servidor');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function listenOnAvailablePort(currentPort) {
  const srv = http.createServer(requestHandler);
  srv.listen(currentPort, () => {
    console.log(`====================================================`);
    console.log(`🚀 GUÍA CHASCOMÚS CORRIENDO EN PUERTO ${currentPort}`);
    console.log(`👉 http://localhost:${currentPort}`);
    console.log(`====================================================`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      listenOnAvailablePort(currentPort + 1);
    } else {
      console.error('Error en el servidor:', err);
    }
  });
}

listenOnAvailablePort(Number(DEFAULT_PORT));
