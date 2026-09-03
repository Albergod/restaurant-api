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

## Requisitos previos

- **Python 3.11+** → https://www.python.org/downloads/ (en Windows, marca *"Add Python to PATH"* al instalar)
- **Docker Desktop** → https://www.docker.com/products/docker-desktop/ (para levantar PostgreSQL sin instalarlo a mano)
- **Git** → https://git-scm.com/download/win

---

## Instalación (Windows · paso a paso)

Abre **PowerShell** y ejecuta:

```powershell
# 1. Clonar el proyecto
git clone https://github.com/Albergod/restaurant-api.git
cd restaurant-api

# 2. Levantar PostgreSQL con Docker (debe estar abierto Docker Desktop)
docker compose up -d
#    Esto crea una base de datos lista en localhost:5432
#    usuario: restaurant · contraseña: restaurant · base: restaurant_db

# 3. Crear y activar un entorno virtual de Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
#    Si PowerShell bloquea el script, ejecuta una vez:
#    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 4. Instalar las dependencias
pip install -r requirements.txt

# 5. Configurar variables de entorno
copy .env.example .env
#    El .env ya viene configurado para el Docker del paso 2.
#    Solo cambia SECRET_KEY por una clave larga y aleatoria.

# 6. Iniciar el servidor
uvicorn app.main:app --reload
```

La API estará en `http://localhost:8000`  
Documentación interactiva: `http://localhost:8000/docs`

> Las tablas de la base de datos se crean **automáticamente** la primera vez
> que arranca el servidor. No hace falta correr migraciones.

---

## Arranque local (Linux / NixOS)

Desde la raíz del repositorio, abre tres terminales:

```bash
# Terminal 1: PostgreSQL
docker compose up -d

# Terminal 2: API (entra primero al entorno Nix del proyecto)
nix-shell
uvicorn app.main:app --reload

# Terminal 3: frontend
cd frontend
npm install
npm run dev
```

Abre `http://localhost:3000`. La API queda en `http://localhost:8000` y su
documentación en `http://localhost:8000/docs`.

Si Docker responde `permission denied`, ejecuta temporalmente el comando con
`sudo` o agrega tu usuario al grupo `docker` y vuelve a iniciar sesión.

---

## Comandos útiles de Docker (la base de datos)

```powershell
docker compose up -d      # Encender PostgreSQL en segundo plano
docker compose stop       # Apagar (los datos se conservan)
docker compose start      # Volver a encender
docker compose down       # Apagar y borrar el contenedor (los datos se conservan en el volumen)
docker compose down -v    # Apagar y BORRAR TODO incluidos los datos
docker compose logs -f db # Ver qué hace la base de datos
```

Si cambiaste el usuario/contraseña en `docker-compose.yml`, recuerda
ajustar también `DATABASE_URL` en tu `.env`.

---

## Despliegue gratuito para demostración

La aplicación se divide entre servicios con planes gratuitos:

1. **Neon** aloja PostgreSQL.
2. **Render** ejecuta FastAPI usando `/render.yaml`.
3. **Vercel** ejecuta Next.js desde el directorio `/frontend`.
4. **Cloudinary** conserva las imágenes subidas por el administrador.

Variables del backend:

```text
DATABASE_URL=postgresql://...          # copiar directamente desde Neon
SECRET_KEY=<valor aleatorio largo>
BACKEND_CORS_ORIGINS=https://<dominio-del-frontend>
FRONTEND_URL=https://<dominio-del-frontend>
SEED_DEFAULT_USERS=true
ALLOW_PUBLIC_STAFF_REGISTRATION=false
DEFAULT_ADMIN_PASSWORD=<valor aleatorio>
DEFAULT_WAITER_PASSWORD=<valor aleatorio>
DEFAULT_KITCHEN_PASSWORD=<valor aleatorio>
MEDIA_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<API key>
CLOUDINARY_API_SECRET=<API secret>
```

En desarrollo `MEDIA_STORAGE=local` conserva el comportamiento original y
guarda los archivos en `/uploads`. En Render debe ser `cloudinary`, porque el
disco del plan gratuito se borra al suspender o reiniciar el servicio.

Variables del frontend (se aplican durante el build):

```text
NEXT_PUBLIC_API_URL=https://<dominio-del-backend>
NEXT_PUBLIC_WS_URL=wss://<dominio-del-backend>
```

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

---

## Dependencias (qué hace cada una y por qué está)

Estas son las librerías de `requirements.txt` y su rol en el proyecto:

| Paquete | ¿Para qué sirve? |
|---------|------------------|
| **fastapi** | El framework web. Define las rutas (`/api/...`), valida datos y genera la documentación automática en `/docs`. Es el corazón del proyecto. |
| **uvicorn[standard]** | El servidor que *ejecuta* la app de FastAPI. Es lo que arrancas con `uvicorn app.main:app`. El `[standard]` añade soporte rápido para WebSocket y recarga automática. |
| **sqlalchemy** | El ORM: permite trabajar con la base de datos usando clases de Python en vez de escribir SQL a mano. Define las tablas (`app/models/`). |
| **asyncpg** | El driver que conecta SQLAlchemy con PostgreSQL de forma **asíncrona** (rápida). Es el que usa la `DATABASE_URL` (`postgresql+asyncpg://...`). |
| **psycopg2-binary** | Driver de PostgreSQL **síncrono**. Lo usan herramientas como Alembic (migraciones) que no trabajan en modo async. |
| **alembic** | Herramienta de *migraciones*: versiona los cambios en la estructura de la base de datos. (Listo para usar a futuro; ahora las tablas se crean solas al arrancar.) |
| **pydantic** | Valida y da forma a los datos que entran y salen de la API (los "schemas" en `app/schemas/`). Si alguien manda datos mal formados, los rechaza. |
| **pydantic-settings** | Lee la configuración desde el archivo `.env` (la `DATABASE_URL`, `SECRET_KEY`, etc.) y la convierte en objetos de Python. |
| **python-jose[cryptography]** | Crea y verifica los **tokens JWT** del login. Es lo que mantiene la sesión segura del usuario. |
| **passlib[bcrypt]** | Cifra (hashea) las contraseñas antes de guardarlas. Nunca se guarda la contraseña en texto plano. |
| **python-multipart** | Necesario para que FastAPI pueda recibir formularios y subidas de archivos (por ejemplo, el formulario de login). |
| **websockets** | Soporte de bajo nivel para el **chat en tiempo real** (las rutas `WS /api/chat/ws/...`). |
| **httpx** | Cliente HTTP. Se usa para hacer peticiones a servicios externos y en las pruebas de la API. |
