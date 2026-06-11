# 🍽️ Restaurant API

API REST + WebSocket para gestión de restaurantes.  
Construida con **FastAPI** + **PostgreSQL** + **SQLAlchemy async**.

---

## Estructura del proyecto

```
restaurant-api/
├── app/
│   ├── core/
│   │   ├── config.py       # Variables de entorno
│   │   ├── database.py     # Conexión async a PostgreSQL
│   │   └── security.py     # JWT, hash de contraseñas
│   ├── models/
│   │   └── models.py       # Tablas de la base de datos
│   ├── schemas/
│   │   └── schemas.py      # Validación de datos (Pydantic)
│   ├── routers/
│   │   ├── auth.py         # Registro y login
│   │   ├── menu.py         # Categorías y productos
│   │   ├── orders.py       # Pedidos y panel de cocina
│   │   ├── tables.py       # Mesas y códigos QR
│   │   ├── chat.py         # Chat cliente-mesero (REST + WebSocket)
│   │   └── loyalty.py      # Puntos de fidelización
│   └── main.py             # App principal
├── requirements.txt
└── .env.example
```

---

## Instalación

```bash
# 1. Clonar e instalar dependencias
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu URL de PostgreSQL y una SECRET_KEY segura

# 3. Iniciar el servidor
uvicorn app.main:app --reload
```

La API estará en `http://localhost:8000`  
Documentación automática: `http://localhost:8000/docs`

---

## Endpoints principales

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Login → JWT |

### Menú (público via QR)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/menu/` | Menú completo por categorías |
| GET | `/api/menu/featured` | Productos recomendados |
| GET | `/api/menu/promotions` | Productos en promoción |
| POST | `/api/menu/categories` | Crear categoría (admin) |
| POST | `/api/menu/products` | Agregar producto (admin) |
| PATCH | `/api/menu/products/{id}` | Editar producto (admin) |

### Pedidos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/orders/` | Crear pedido (cliente, sin login) |
| GET | `/api/orders/` | Listar pedidos (staff) |
| GET | `/api/orders/kitchen` | Panel de cocina |
| GET | `/api/orders/{id}` | Ver pedido (seguimiento) |
| PATCH | `/api/orders/{id}/status` | Cambiar estado |

### Mesas y QR
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/tables/` | Crear mesa + QR (admin) |
| GET | `/api/tables/` | Listar mesas (staff) |
| POST | `/api/tables/{id}/regenerate-qr` | Nuevo QR (admin) |

### Chat
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat/sessions/{table_qr}` | Abrir sesión de chat |
| POST | `/api/chat/sessions/{id}/messages` | Enviar mensaje (REST) |
| WS | `/api/chat/ws/{session_id}` | Chat en tiempo real |

### Fidelización
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/loyalty/me` | Ver mis puntos |
| POST | `/api/loyalty/add/{user_id}` | Agregar puntos (staff) |

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Todo |
| `waiter` | Confirmar pedidos, chat, ver mesas |
| `kitchen` | Ver pedidos confirmados, cambiar a preparing/ready |
| `customer` | Hacer pedidos y chatear (sin login) |

---

## WebSocket (chat en tiempo real)

```js
// Cliente (sin token)
const ws = new WebSocket("ws://localhost:8000/api/chat/ws/1")

// Mesero (con JWT)
const ws = new WebSocket("ws://localhost:8000/api/chat/ws/1?token=<JWT>")

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  console.log(msg.sender, msg.content)
}

ws.send("Hola, necesito ayuda con mi pedido")
```

---

## Flujo completo de un pedido

```
1. Admin crea mesa → se genera QR único
2. Cliente escanea QR → ve el menú
3. Cliente agrega al carrito y hace el pedido (POST /api/orders/)
4. Mesero ve pedido pendiente → lo confirma (PATCH status: confirmed)
5. Cocina ve el pedido → lo marca en preparación y luego listo
6. Mesero lo entrega → (status: delivered) → mesa se libera
```
