import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const INITIAL_DATA = {
  rubros: [
    { id: 'farmacias', nombre: 'Farmacias de Turno', icono: '💊', color: '#e74c3c' },
    { id: 'gastronomia', nombre: 'Gastronomía & Comidas', icono: '🍽️', color: '#e67e22' },
    { id: 'carpinteria', nombre: 'Carpintería & Muebles', icono: '🪚', color: '#8e44ad' },
    { id: 'albanileria', nombre: 'Albañilería & Reformas', icono: '🧱', color: '#d35400' },
    { id: 'ferreteria', nombre: 'Ferreterías & Materiales', icono: '🔧', color: '#2980b9' },
    { id: 'plomeria', nombre: 'Plomería & Gas Matriculado', icono: '🚰', color: '#16a085' },
    { id: 'electricidad', nombre: 'Electricidad & Iluminación', icono: '⚡', color: '#f1c40f' },
    { id: 'mecanica', nombre: 'Mecánica & Repuestos', icono: '🚗', color: '#7f8c8d' },
    { id: 'remises', nombre: 'Remises & Traslados', icono: '🚕', color: '#f39c12' },
    { id: 'veterinarias', nombre: 'Veterinarias & Mascotas', icono: '🐶', color: '#2ecc71' },
    { id: 'inmobiliarias', nombre: 'Inmobiliarias & Alquileres', icono: '🏠', color: '#34495e' },
    { id: 'turismo', nombre: 'Cabañas, Hoteles & Turismo', icono: '🏨', color: '#9b59b6' },
    { id: 'salud', nombre: 'Salud & Médicos', icono: '🩺', color: '#1abc9c' },
    { id: 'servicios', nombre: 'Servicios para el Hogar', icono: '🛠️', color: '#34495e' }
  ],
  farmacias: [
    {
      id: 'f1',
      nombre: 'Farmacia Pasteur',
      direccion: 'Av. Lastra 234, Chascomús',
      telefono: '2241-421111',
      horario: 'Turno 24 hs (08:00 a 08:00 hs)',
      deTurno: false,
      fechasTurno: ['10/08', '13/08', '20/08', '27/08'],
      diasTurno: ['Lunes', 'Miércoles', 'Viernes', 'Domingo'],
      mapsUrl: 'https://maps.google.com/?q=Farmacia+Pasteur+Chascomus'
    },
    {
      id: 'f2',
      nombre: 'Farmacia San Martín',
      direccion: 'Calle Libres del Sur 145, Chascomús',
      telefono: '2241-432222',
      horario: 'Turno 24 hs (08:00 a 08:00 hs)',
      deTurno: false,
      fechasTurno: ['11/08', '18/08', '25/08'],
      diasTurno: ['Martes', 'Jueves', 'Sábado'],
      mapsUrl: 'https://maps.google.com/?q=Farmacia+San+Martin+Chascomus'
    },
    {
      id: 'f3',
      nombre: 'Farmacia Central',
      direccion: 'Av. Presidente Perón 89, Chascomús',
      telefono: '',
      horario: 'Atención Regular (08:00 a 20:00 hs)',
      deTurno: false,
      fechasTurno: [],
      diasTurno: [],
      mapsUrl: 'https://maps.google.com/?q=Farmacia+Central+Chascomus'
    }
  ],
  popups: [
    {
      id: 'pop_main',
      ubicacion: 'portada',
      activo: true,
      titulo: '¡SÚPER PROMO FIN DE SEMANA EN LAGUNA!',
      subtitulo: 'Heladería El Faro - 2x1 en Kilo de Helado',
      descripcion: 'Vení a disfrutar de la mejor vista a la laguna con nuestros helados artesanales. Presentá este anuncio y llevate 2x1 este sábado y domingo.',
      imagen: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=800&auto=format&fit=crop&q=80',
      botonTexto: 'Ver Promociones',
      link: 'https://wa.me/5492241527357?text=Hola,%20vi%20la%20promo%20en%20la%20Guia%20Chascomus'
    },
    {
      id: 'pop_gastro',
      ubicacion: 'gastronomia',
      activo: true,
      titulo: '🍕 NOCHE DE PIZZAS EN LA LAGUNA',
      subtitulo: '10% OFF en Delivery de Pizzas a la Piedra',
      descripcion: 'Pizzas caseras horneadas al momento. Pedí por WhatsApp ingresando tu dirección en Chascomús.',
      imagen: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
      botonTexto: 'Pedir por WhatsApp',
      link: 'https://wa.me/5492241527357?text=Hola,%20quiero%20pedir%20pizza'
    }
  ],
  listings: [
    {
      id: 'l1',
      nombre: 'Pizzería & Restaurante La Laguna',
      rubroId: 'gastronomia',
      rubroNombre: 'Gastronomía & Comidas',
      plan: 'oro',
      posicionTop: true,
      colorPersonalizado: '#f59e0b',
      direccion: 'Av. Costanera España 450, Chascomús',
      telefono: '2241-554433',
      whatsapp: '5492241527357',
      descripcion: 'Especialidad en pizzas a la piedra, empanadas caseras, minutas y la mejor vista a la laguna de Chascomús. Envíos a domicilio sin cargo.',
      horarios: 'Lunes a Domingo de 19:30 a 01:00 hs',
      redes: 'Instagram: @lalaguna.chascomus',
      fotos: [
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80'
      ],
      verificado: true,
      fechaAlta: '2026-08-01'
    },
    {
      id: 'l2',
      nombre: 'Carpintería El Roble - Muebles a Medida',
      rubroId: 'carpinteria',
      rubroNombre: 'Carpintería & Muebles',
      plan: 'plata',
      posicionTop: false,
      colorPersonalizado: '#0284c7',
      direccion: 'Calle Lincoln 320, Chascomús',
      telefono: '2241-667788',
      whatsapp: '5492241527357',
      descripcion: 'Diseño y fabricación de placares, muebles de cocina, aberturas y restauración de muebles antiguos. Presupuestos sin cargo en Chascomús.',
      horarios: 'Lunes a Viernes de 08:00 a 17:00 hs',
      redes: 'Facebook: Carpinteria El Roble Chascomus',
      fotos: [
        'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&auto=format&fit=crop&q=80'
      ],
      verificado: true,
      fechaAlta: '2026-08-02'
    },
    {
      id: 'l3',
      nombre: 'Ferretería & Construcción Chascomús',
      rubroId: 'ferreteria',
      rubroNombre: 'Ferreterías & Materiales',
      plan: 'gratuito',
      posicionTop: false,
      colorPersonalizado: '',
      direccion: 'Calle Italia 120, Chascomús',
      telefono: '2241-423344',
      whatsapp: '5492241423344',
      descripcion: 'Herramientas, buloneria, pintura, artículos de plomería y electricidad. Aceptamos todas las tarjetas y Cuenta DNI.',
      horarios: 'Lunes a Sábado de 08:00 a 19:30 hs',
      redes: '',
      fotos: [],
      verificado: true,
      fechaAlta: '2026-08-03'
    }
  ],
  submissions: [],
  adminPassword: 'admin123',
  whatsappAdmin: '5492241527357'
};

export function getDb() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.rubros || data.rubros.length === 0) data.rubros = INITIAL_DATA.rubros;
    if (!data.popups) data.popups = INITIAL_DATA.popups;
    return data;
  } catch (err) {
    console.error('Error al leer la base de datos:', err);
    return INITIAL_DATA;
  }
}

export function saveDb(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error al guardar la base de datos:', err);
    return false;
  }
}
