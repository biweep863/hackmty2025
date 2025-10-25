```markdown
# 🚗 Banco Carpool Platform — Backend Template

Este proyecto es un **template de backend** basado en **tRPC + Prisma (PostgreSQL)** para implementar una **plataforma interna de carpool** dentro de un banco.  
Permite conectar empleados que ofrecen y solicitan viajes entre sedes o rutas recurrentes.

---

## 🧩 Arquitectura general

El backend sigue la estructura modular de tRPC:
```

src/
server/
db.ts
trpc.ts
routers/
index.ts
sites.ts
carpooler.ts
routes.ts
availability.ts
trips.ts
bookings.ts

````

- **Prisma** se utiliza para la capa ORM (PostgreSQL).
- **tRPC** define routers y procedimientos tipados para el frontend.
- **Auth Context** asume que existe un sistema SSO del banco con `userId` y `roles`.

---

## 🧠 Flujos mínimos cubiertos

### 1️⃣ Carpoolero configura su perfil y ruta
- `carpooler.upsertProfile` → crea o actualiza su perfil de conductor.
- `routes.create` → define una ruta **A → B** (ej. Casa → Sede Centro).
- `availability.createOneOff` → declara disponibilidad puntual.
- `availability.createRecurring` → declara disponibilidad recurrente (por días de la semana y horarios).

### 2️⃣ Publicar un viaje concreto
- `trips.create` → instancia una salida específica con `departureAt`, número de asientos y punto de recogida.

### 3️⃣ Descubrir y reservar viajes
- `trips.discover` → lista viajes cercanos y disponibles en una fecha dada.
- `bookings.requestSeat` → el usuario solicita un asiento y selecciona un punto de recogida.
- `bookings.decide` → el conductor acepta o rechaza la solicitud.
- `bookings.cancelByRider` → el pasajero puede cancelar su reserva.

### 4️⃣ Infraestructura de sedes y puntos de recogida
- `sites.list` → lista sedes del banco y sus puntos activos.
- `sites.create` → crea una nueva sede.
- `sites.addPickupPoint` → agrega puntos de recogida asociados a una sede.

---

## ⚙️ Diseño de base de datos

- **PostgreSQL + Prisma**
- Modelos principales:
  `User`, `CarpoolerProfile`, `RouteTemplate`, `Availability`, `Trip`, `Booking`, `Site`, `PickupPoint`.

Cada `Trip` está vinculado a:
- Un `RouteTemplate` (definición A→B del carpoolero).
- Un `CarpoolerProfile` (quien maneja).
- Un `PickupPoint` (punto de encuentro).

---

## 🧱 Notas de diseño

### 🔹 Cercanía de rutas y puntos
La lógica de proximidad (GPS o mapas) **no está incluida**.
El esquema ya guarda coordenadas `lat/lng` y puntos predefinidos (`PickupPoint`), por lo que puedes integrar un servicio de proximidad más adelante.

### 🔹 Seguridad interna
- Solo el **conductor del viaje** puede decidir (`bookings.decide`) sobre sus solicitudes.
- Todos los endpoints usan autenticación por sesión (`ctx.session.userId`).

### 🔹 Índices y rendimiento
Ya existen índices en Prisma para las operaciones más comunes:
- `(status, departureAt)` — listados de viajes abiertos.
- `(driverId, departureAt)` — historial del conductor.
- `(tripId, riderId)` — evita duplicar reservas por usuario.

### 🔹 Recurrencia de disponibilidad
Las disponibilidades recurrentes se modelan con:
- `weekdayMask` → arreglo de días `[1,2,3,4,5]` (Lun–Vie).
- `timeWindowStart` / `timeWindowEnd` → rango horario (ej. “08:00”–“09:00”).

Puedes implementar un **cron job** que materialice viajes (`Trip`) futuros a partir de las disponibilidades `RECURRING`.

---

## 🛠️ Setup rápido

1. Instala dependencias:
   ```bash
   npm install
````

2. Configura tu base de datos en `.env`:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/carpool"
   ```

3. Ejecuta migraciones:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Genera el cliente Prisma:

   ```bash
   npx prisma generate
   ```

5. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

---

## 🚀 Próximos pasos

- Agregar autenticación real (SSO corporativo o JWT).
- Implementar lógica de cercanía (distancia entre `PickupPoint` y `RouteTemplate`).
- Crear tareas automáticas para viajes recurrentes.
- Integrar frontend con los routers tRPC expuestos.

---

## 📄 Licencia

Proyecto base interno del banco. Uso restringido y no destinado a distribución pública.

```

```
