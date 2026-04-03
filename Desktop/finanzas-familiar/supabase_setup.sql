-- =====================================================
-- SCRIPT DE CONFIGURACIÓN - FINANZAS FAMILIAR
-- Pega este script completo en el SQL Editor de Supabase
-- =====================================================

-- 1. TABLA: perfiles
-- Guarda el perfil de cada usuario registrado
CREATE TABLE IF NOT EXISTS perfiles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA: categorias
-- Categorías de ingresos y gastos por usuario
CREATE TABLE IF NOT EXISTS categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  icono      TEXT,
  tipo       TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: cuentas
-- Cuentas bancarias (débito y crédito)
CREATE TABLE IF NOT EXISTS cuentas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('debito', 'credito', 'ahorro')),
  balance_inicial  NUMERIC(14,2) DEFAULT 0,
  limite_credito   NUMERIC(14,2) DEFAULT 0,
  dia_corte        INT,
  dia_pago         INT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: transacciones
-- Registro de todos los movimientos de dinero
CREATE TABLE IF NOT EXISTS transacciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cuenta_id    UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  monto        NUMERIC(14,2) NOT NULL,
  fecha        DATE NOT NULL,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA: presupuestos
-- Límites de gasto por categoría y mes
CREATE TABLE IF NOT EXISTS presupuestos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id      UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  categoria_id   UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  monto_limite   NUMERIC(14,2) NOT NULL,
  mes            DATE NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (perfil_id, categoria_id, mes)
);

-- =====================================================
-- SEGURIDAD: Activar Row Level Security (RLS)
-- Cada usuario solo ve SUS propios datos
-- =====================================================

ALTER TABLE perfiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos  ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS DE ACCESO
-- =====================================================

-- PERFILES
CREATE POLICY "perfiles: solo el propio usuario"
  ON perfiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CATEGORÍAS
CREATE POLICY "categorias: solo el propio perfil"
  ON categorias FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- CUENTAS
CREATE POLICY "cuentas: solo el propio perfil"
  ON cuentas FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- TRANSACCIONES
CREATE POLICY "transacciones: solo el propio perfil"
  ON transacciones FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- PRESUPUESTOS
CREATE POLICY "presupuestos: solo el propio perfil"
  ON presupuestos FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- =====================================================
-- ✅ LISTO. Tus 5 tablas están creadas y protegidas.
-- =====================================================

-- 6. TABLA: historial_fondo
-- Historial de actualizaciones del valor de fondos de inversión/ahorro
CREATE TABLE IF NOT EXISTS historial_fondo (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cuenta_id  UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL,
  valor      NUMERIC(14,2) NOT NULL,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE historial_fondo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_fondo: solo el propio perfil"
  ON historial_fondo FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- 7. TABLA: pagos_tarjeta
-- Registra pagos desde una cuenta hacia una tarjeta de crédito (no es un gasto, es una transferencia)
CREATE TABLE IF NOT EXISTS pagos_tarjeta (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cuenta_origen_id  UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  cuenta_destino_id UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  monto             NUMERIC(14,2) NOT NULL,
  fecha             DATE NOT NULL,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pagos_tarjeta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_tarjeta: solo el propio perfil"
  ON pagos_tarjeta FOR ALL
  USING (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()))
  WITH CHECK (perfil_id IN (SELECT id FROM perfiles WHERE user_id = auth.uid()));

-- =====================================================
-- MIGRACIÓN: Agregar tipo 'ahorro' a cuentas
-- Ejecuta esto si ya tienes la tabla creada:
-- =====================================================
-- ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_tipo_check;
-- ALTER TABLE cuentas ADD CONSTRAINT cuentas_tipo_check CHECK (tipo IN ('debito', 'credito', 'ahorro'));
