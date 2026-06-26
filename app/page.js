"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Configuración de Supabase provista por el usuario
const NEXT_PUBLIC_SUPABASE_URL = "https://hvwrrtpisttpedoxtdgl.supabase.co";
const NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_7V6QpYYac2QVu0vIwSDrFQ_UVFmVrHj";
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

const DEFAULT_PASSWORD = "1234";

// Platos por defecto en caso de que la DB esté vacía o se desee sembrar
const DEFAULT_PLATOS = [
  { nombre: "Sopa de Maní", precio: 15, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80" },
  { nombre: "Chairo", precio: 18, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1607532941433-304659e8198a?auto=format&fit=crop&w=600&q=80" },
  { nombre: "Picante de Pollo", precio: 25, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
  { nombre: "Silpancho", precio: 22, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
  { nombre: "Completo", precio: 20, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1501200156827-0249b3c457d4?auto=format&fit=crop&w=600&q=80" },
  { nombre: "Refresco", precio: 5, disponible_hoy: true, imagen_url: "https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80" }
];

export default function Home() {
  // INGENIERO: Estado para evitar Hydration Mismatch en Vercel
  const [isMounted, setIsMounted] = useState(false);

  // Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState(DEFAULT_PASSWORD);
  const [loginError, setLoginError] = useState(false);
  const [showConfigClave, setShowConfigClave] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");

  // Pestaña Activa
  const [activeTab, setActiveTab] = useState("caja"); // 'menu', 'caja', 'cocina', 'config'

  // Datos
  const [platos, setPlatos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cart, setCart] = useState({}); // { [platoId]: cantidad }

  // Estados de carga y errores
  const [loadingPlatos, setLoadingPlatos] = useState(false);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Inicialización del estado de autenticación y claves
  useEffect(() => {
    setIsMounted(true); // Confirmamos que el componente montó en el navegador
    if (typeof window !== "undefined") {
      const auth = localStorage.getItem("jimena_auth") === "true";
      setIsAuthenticated(auth);

      const pwd = localStorage.getItem("jimena_password") || DEFAULT_PASSWORD;
      setCurrentPassword(pwd);
    }
  }, []);

  // Carga de Platos
  const fetchPlatos = async () => {
    setLoadingPlatos(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase
        .from("platos")
        .select("*")
        .order("nombre", { ascending: true });

      if (error) throw error;
      setPlatos(data || []);
    } catch (err) {
      console.log("Código:", err.code);
      console.log("Mensaje:", err.message);
      console.log("Detalles:", err.details);
      console.log("Hint:", err.hint);
      console.log(err);
    } finally {
      setLoadingPlatos(false);
    }
  };

  // Carga de Pedidos Pendientes
  const fetchPedidos = async () => {
    setLoadingPedidos(true);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("estado", "Pendiente")
        .order("id", { ascending: true });

      if (error) throw error;
      setPedidos(data || []);
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
      setErrorMsg("Error al conectar con la base de datos de pedidos.");
    } finally {
      setLoadingPedidos(false);
    }
  };

  // Cargar datos iniciales al autenticarse
  useEffect(() => {
    if (isAuthenticated) {
      fetchPlatos();
      fetchPedidos();
    }
  }, [isAuthenticated]);

  // SUSCRIPCIÓN EN TIEMPO REAL A LA TABLA DE PEDIDOS
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("Inicializando suscripción Realtime para pedidos...");
    const channel = supabase
      .channel("cambios-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        (payload) => {
          console.log("Cambio en pedidos recibido por Realtime:", payload);

          if (payload.eventType === "INSERT") {
            const nuevoPedido = payload.new;
            if (nuevoPedido.estado === "Pendiente") {
              setPedidos((prev) => {
                if (prev.some((p) => p.id === nuevoPedido.id)) return prev;
                return [...prev, nuevoPedido];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const pedidoActualizado = payload.new;
            if (pedidoActualizado.estado === "Servido") {
              setPedidos((prev) => prev.filter((p) => p.id !== pedidoActualizado.id));
            } else {
              setPedidos((prev) =>
                prev.map((p) => (p.id === pedidoActualizado.id ? pedidoActualizado : p))
              );
            }
          } else if (payload.eventType === "DELETE") {
            setPedidos((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Limpiando canal de tiempo real...");
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Login
  const handleLoginSubmit = (e) => {
    if (e) e.preventDefault();
    if (passwordInput === currentPassword) {
      setIsAuthenticated(true);
      setLoginError(false);
      localStorage.setItem("jimena_auth", "true");
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 500);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("jimena_auth");
    setPasswordInput("");
  };

  // Cambiar Contraseña Interna
  const handlePasswordChangeSubmit = (e) => {
    e.preventDefault();
    if (newPasswordVal === confirmPasswordVal) {
      if (newPasswordVal.trim().length > 0) {
        setCurrentPassword(newPasswordVal);
        localStorage.setItem("jimena_password", newPasswordVal);
        setShowConfigClave(false);
        setNewPasswordVal("");
        setConfirmPasswordVal("");
        alert("Contraseña cambiada exitosamente.");
      } else {
        alert("La contraseña no puede ser vacía.");
      }
    } else {
      alert("Las contraseñas no coinciden.");
    }
  };

  // Sembrar platos por defecto en la base de datos
  const handleSeedPlatos = async () => {
    setSeeding(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.from("platos").insert(DEFAULT_PLATOS);
      if (error) throw error;
      alert("Platos iniciales sembrados exitosamente en la base de datos.");
      fetchPlatos();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error al sembrar platos: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Resetear todos los pedidos de la jornada
  const handleResetearJornada = async () => {
    const confirmacion = window.confirm(
      "¿Resetear jornada? Se eliminarán TODOS los pedidos registrados y el contador volverá a #1."
    );
    if (!confirmacion) return;

    setResetting(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .delete()
        .neq("id", 0); // Borra todas las filas (ningún id real es 0)

      if (error) throw error;

      setPedidos([]);
      localStorage.removeItem("last_order_date");
      alert("✅ Jornada reseteada. El próximo pedido será el #1.");
    } catch (err) {
      console.error("Error al resetear jornada:", err);
      alert("Error al resetear: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  // Actualizar disponibilidad de plato en Supabase (Toggle)
  const handleToggleDisponibilidad = async (platoId, currentVal) => {
    const newVal = !currentVal;

    setPlatos((prev) =>
      prev.map((p) => (p.id === platoId ? { ...p, disponible_hoy: newVal } : p))
    );

    try {
      const { error } = await supabase
        .from("platos")
        .update({ disponible_hoy: newVal })
        .eq("id", platoId);

      if (error) throw error;
    } catch (err) {
      console.error("Error al actualizar plato:", err);
      setPlatos((prev) =>
        prev.map((p) => (p.id === platoId ? { ...p, disponible_hoy: currentVal } : p))
      );
      alert("No se pudo actualizar el plato en la base de datos. Intente de nuevo.");
    }
  };

  // Caja: Agregar Plato al Carrito
  const addToCart = (platoId) => {
    setCart((prev) => ({
      ...prev,
      [platoId]: (prev[platoId] || 0) + 1,
    }));
  };

  // Caja: Quitar/Restar Plato del Carrito
  const removeFromCart = (platoId) => {
    setCart((prev) => {
      const updated = { ...prev };
      if (updated[platoId] > 1) {
        updated[platoId] -= 1;
      } else {
        delete updated[platoId];
      }
      return updated;
    });
  };

  // Caja: Limpiar Carrito
  const clearCart = () => {
    setCart({});
  };

  // Caja: Enviar Pedido Completo
  const handleEnviarPedido = async () => {
    const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);
    if (cartEntries.length === 0) {
      alert("El carrito está vacío. Agregue algún plato.");
      return;
    }

    try {
      let proximoNumero = 1;

      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);

      const { data: ultimosPedidos, error: errorCorrelativo } = await supabase
        .from("pedidos")
        .select("numero_pedido")
        .gte("created_at", hoyInicio.toISOString())
        .order("numero_pedido", { ascending: false })
        .limit(1);

      if (errorCorrelativo) {
        console.warn("No se pudo obtener el correlativo con created_at, usando fallback.", errorCorrelativo);
        const { data: ultimosPedidosFallback, error: errorFallback } = await supabase
          .from("pedidos")
          .select("numero_pedido, hora")
          .order("id", { ascending: false })
          .limit(1);

        if (!errorFallback && ultimosPedidosFallback && ultimosPedidosFallback.length > 0) {
          const hoyStr = new Date().toLocaleDateString("es-ES");
          const ultFecha = localStorage.getItem("last_order_date");
          if (ultFecha === hoyStr) {
            proximoNumero = ultimosPedidosFallback[0].numero_pedido + 1;
          }
        }
      } else if (ultimosPedidos && ultimosPedidos.length > 0) {
        proximoNumero = ultimosPedidos[0].numero_pedido + 1;
      }

      const itemsJSON = cartEntries.map(([platoId, qty]) => {
        const plato = platos.find((p) => p.id === parseInt(platoId) || p.id === platoId);
        return {
          id: plato.id,
          nombre: plato.nombre,
          precio: plato.precio,
          cantidad: qty,
        };
      });

      const total = itemsJSON.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const hoyStr = ahora.toLocaleDateString("es-ES");
      localStorage.setItem("last_order_date", hoyStr);

      const nuevoPedidoObj = {
        numero_pedido: proximoNumero,
        items: itemsJSON,
        estado: "Pendiente",
        total: total,
        hora: horaStr,
      };

      const { data, error: insertError } = await supabase
        .from("pedidos")
        .insert(nuevoPedidoObj)
        .select();

      if (insertError) throw insertError;

      setSuccessAnimation(true);
      setCart({});
      setTimeout(() => {
        setSuccessAnimation(false);
      }, 1500);

    } catch (err) {
      console.error("Error al enviar el pedido:", err);
      alert("Error al enviar el pedido: " + err.message);
    }
  };

  // Cocina: Despachar / Pedido Servido
  const handleDespacharPedido = async (pedidoId) => {
    setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: "Servido" })
        .eq("id", pedidoId);

      if (error) throw error;
    } catch (err) {
      console.error("Error al despachar pedido:", err);
      alert("No se pudo despachar el pedido en el servidor. Intente de nuevo.");
      fetchPedidos();
    }
  };

  // INGENIERO: Retorno temprano SEGURO. Va después de todos los hooks (useEffect/useState).
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p>Cargando sistema...</p>
      </div>
    );
  }

  // Pantalla de Bloqueo / Contraseña
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 font-sans text-white">
        <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Regist-Demo
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Ingresa el código PIN para acceder al sistema táctil
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${loginError ? "border-red-500 animate-shake" : "border-gray-700"} bg-gray-950 p-4 text-center text-2xl font-bold tracking-widest text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                readOnly
              />
            </div>

            {/* Teclado Táctil Gigante */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPasswordInput((prev) => prev + num)}
                  className="flex h-16 items-center justify-center rounded-xl bg-gray-800 text-2xl font-bold text-white transition-all active:scale-95 active:bg-gray-700"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPasswordInput("")}
                className="flex h-16 items-center justify-center rounded-xl bg-red-950/40 text-lg font-semibold text-red-400 transition-all active:scale-95 active:bg-red-900/40"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setPasswordInput((prev) => prev + "0")}
                className="flex h-16 items-center justify-center rounded-xl bg-gray-800 text-2xl font-bold text-white transition-all active:scale-95 active:bg-gray-700"
              >
                0
              </button>
              <button
                type="submit"
                onClick={handleLoginSubmit}
                className="flex h-16 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white transition-all active:scale-95 active:bg-emerald-500"
              >
                OK
              </button>
            </div>

            {loginError && (
              <p className="text-center text-sm font-semibold text-red-500">
                Código incorrecto. Intenta de nuevo.
              </p>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowConfigClave(!showConfigClave)}
                className="text-xs text-gray-500 hover:text-emerald-400"
              >
                ⚙️ Configurar contraseña del sistema
              </button>
            </div>
          </form>

          {showConfigClave && (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <h2 className="mb-3 text-center text-sm font-bold text-gray-300">
                Cambio de Contraseña (Simulación)
              </h2>
              <form onSubmit={handlePasswordChangeSubmit} className="space-y-3">
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  value={confirmPasswordVal}
                  onChange={(e) => setConfirmPasswordVal(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white active:scale-95"
                  >
                    Guardar Nueva Clave
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("jimena_password", DEFAULT_PASSWORD);
                      setCurrentPassword(DEFAULT_PASSWORD);
                      alert("Clave restablecida a " + DEFAULT_PASSWORD);
                    }}
                    className="w-full rounded-lg bg-gray-800 py-2 text-xs font-bold text-gray-300 active:scale-95"
                  >
                    Restablecer Default
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard / App Principal
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 font-sans text-white antialiased">
      {/* Header Principal */}
      <header className="sticky top-0 z-40 border-b border-gray-900 bg-gray-950/80 px-4 py-3 shadow-md backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/20 text-white">R</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">Regist-Demo</h1>
              <p className="text-[10px] text-gray-500 font-medium">NextJS + Supabase Realtime</p>
            </div>
          </div>

          {/* Menú de Navegación de Pestañas (Optimizado Táctil) */}
          <nav className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setActiveTab("caja")}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${activeTab === "caja" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              💸 <span className="hidden sm:inline">Caja / Ventas</span>
            </button>
            <button
              onClick={() => setActiveTab("cocina")}
              className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${activeTab === "cocina" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              🍳 <span className="hidden sm:inline">Cocina (KDS)</span>
              {pedidos.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-gray-950 animate-pulse">
                  {pedidos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${activeTab === "menu" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              📋 <span className="hidden sm:inline">Menú Diario</span>
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${activeTab === "config" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              ⚙️ <span className="hidden sm:inline">Ajustes</span>
            </button>
          </nav>

          {/* Botón de Logout */}
          <button
            onClick={handleLogout}
            className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition-all hover:bg-gray-800 active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </header>

      {/* Alerta de Error de DB si existe */}
      {errorMsg && (
        <div className="bg-red-950/60 border-b border-red-900/50 text-red-200 px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
          ⚠️ {errorMsg}
          <button
            onClick={() => { fetchPlatos(); fetchPedidos(); }}
            className="underline ml-2 hover:text-white active:scale-95"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">

        {/* PESTAÑA 1: ADMINISTRACIÓN DEL MENÚ DIARIO */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-900 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Menú del Día</h2>
                <p className="text-sm text-gray-400">Activa o desactiva las comidas que están disponibles para la venta hoy.</p>
              </div>
              <button
                onClick={fetchPlatos}
                disabled={loadingPlatos}
                className="self-start rounded-xl bg-gray-900 border border-gray-800 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingPlatos ? "Cargando..." : "🔄 Actualizar Menú"}
              </button>
            </div>

            {platos.length === 0 && !loadingPlatos ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/20 p-12 text-center">
                <span className="text-4xl">🍽️</span>
                <h3 className="mt-4 text-lg font-bold text-white">No hay platos configurados</h3>
                <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
                  La base de datos de platos está vacía. Puedes sembrar los platos tradicionales haciendo clic en el botón de abajo.
                </p>
                <button
                  onClick={handleSeedPlatos}
                  disabled={seeding}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition-all active:scale-95 hover:bg-emerald-500 disabled:opacity-50"
                >
                  {seeding ? "Sembrando..." : "✨ Sembrar Platos de Prueba"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {platos.map((plato) => (
                  <div
                    key={plato.id}
                    className={`flex items-center justify-between rounded-2xl border bg-gray-900/50 p-4 transition-all ${plato.disponible_hoy ? "border-emerald-500/30 shadow-md shadow-emerald-950/20" : "border-gray-800/80 opacity-60"}`}
                  >
                    <div className="flex items-center gap-4">
                      {plato.imagen_url ? (
                        <img
                          src={plato.imagen_url}
                          alt={plato.nombre}
                          className="h-16 w-16 rounded-xl object-cover border border-gray-800 shadow-md"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80";
                          }}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-gray-800 flex items-center justify-center text-2xl border border-gray-700">🍛</div>
                      )}
                      <div>
                        <h4 className="font-bold text-lg text-white leading-tight">{plato.nombre}</h4>
                        <p className="text-sm font-semibold text-emerald-400 mt-1">{plato.precio} Bs.</p>
                      </div>
                    </div>

                    {/* Toggle Switch Gigante Táctil */}
                    <button
                      onClick={() => handleToggleDisponibilidad(plato.id, plato.disponible_hoy)}
                      className={`relative inline-flex h-10 w-18 items-center rounded-full transition-all duration-300 ${plato.disponible_hoy ? "bg-emerald-600" : "bg-gray-800"}`}
                    >
                      <span
                        className={`inline-block h-8 w-8 transform rounded-full bg-white transition-all duration-300 ${plato.disponible_hoy ? "translate-x-9" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: REGISTRO DE CAJA */}
        {activeTab === "caja" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

            {/* Listado de Platos Disponibles */}
            <div className="lg:col-span-8 space-y-4">
              <div className="border-b border-gray-900 pb-3">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>🛍️</span> Pedido Nuevo
                </h2>
                <p className="text-xs text-gray-400">Selecciona los platos disponibles para armar la comanda.</p>
              </div>

              {platos.filter(p => p.disponible_hoy).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/20 py-16 text-center">
                  <span className="text-4xl">📭</span>
                  <h3 className="mt-4 text-base font-bold text-white">Sin platos disponibles hoy</h3>
                  <p className="mt-2 text-xs text-gray-400 max-w-sm mx-auto">
                    Ve a la pestaña de <span className="text-emerald-400 font-semibold cursor-pointer underline" onClick={() => setActiveTab("menu")}>Menú Diario</span> para activar comidas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {platos
                    .filter((p) => p.disponible_hoy)
                    .map((plato) => {
                      const qtyInCart = cart[plato.id] || 0;
                      return (
                        <button
                          key={plato.id}
                          onClick={() => addToCart(plato.id)}
                          className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/40 text-left transition-all hover:border-emerald-500/50 active:scale-95 focus:outline-none"
                        >
                          {qtyInCart > 0 && (
                            <span className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white shadow-lg ring-4 ring-gray-950 animate-bounce">
                              {qtyInCart}
                            </span>
                          )}

                          {plato.imagen_url ? (
                            <img
                              src={plato.imagen_url}
                              alt={plato.nombre}
                              className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80";
                              }}
                            />
                          ) : (
                            <div className="h-28 w-full bg-gray-800 flex items-center justify-center text-3xl">🍛</div>
                          )}

                          <div className="p-3 bg-gray-900/90 flex-1 flex flex-col justify-between">
                            <span className="font-bold text-white text-base leading-tight block group-hover:text-emerald-400 transition-colors">
                              {plato.nombre}
                            </span>
                            <span className="font-extrabold text-emerald-400 mt-2 block text-sm">
                              {plato.precio} Bs.
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Panel del carrito de Compras (Caja) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4 shadow-xl flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                  <h3 className="font-bold text-lg text-white">Detalle de Comanda</h3>
                  {Object.keys(cart).length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 active:scale-95"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>

                {/* Lista del Carrito */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[250px] pr-1">
                  {Object.keys(cart).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 flex-1">
                      <span className="text-3xl">🛒</span>
                      <p className="mt-2 text-xs font-medium">Selecciona comidas del panel de la izquierda.</p>
                    </div>
                  ) : (
                    Object.entries(cart).map(([platoId, qty]) => {
                      const plato = platos.find((p) => p.id === parseInt(platoId) || p.id === platoId);
                      if (!plato) return null;
                      return (
                        <div
                          key={plato.id}
                          className="flex items-center justify-between rounded-xl bg-gray-950 p-2.5 border border-gray-900"
                        >
                          <div className="flex-1 pr-2">
                            <span className="font-bold text-white block text-sm leading-tight">{plato.nombre}</span>
                            <span className="text-xs text-gray-400">{plato.precio} Bs. c/u</span>
                          </div>

                          {/* Controles de Cantidad */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeFromCart(plato.id)}
                              className="h-8 w-8 rounded-lg bg-gray-800 text-white font-bold flex items-center justify-center active:scale-90 hover:bg-gray-700"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-sm text-white">{qty}</span>
                            <button
                              onClick={() => addToCart(plato.id)}
                              className="h-8 w-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center active:scale-90 hover:bg-emerald-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Animación de Éxito al guardar */}
                {successAnimation && (
                  <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-3 my-2 text-center text-emerald-300 font-bold text-xs animate-bounce flex items-center justify-center gap-2">
                    ✅ ¡Pedido mandado a cocina con éxito!
                  </div>
                )}

                {/* Subtotal y Envío */}
                {Object.keys(cart).length > 0 && (
                  <div className="border-t border-gray-800 pt-3 mt-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium text-sm">Total del Pedido</span>
                      <span className="font-black text-2xl text-emerald-400">
                        {Object.entries(cart).reduce((sum, [platoId, qty]) => {
                          const plato = platos.find((p) => p.id === parseInt(platoId) || p.id === platoId);
                          return sum + (plato ? plato.precio * qty : 0);
                        }, 0)}{" "}
                        Bs.
                      </span>
                    </div>

                    <button
                      onClick={handleEnviarPedido}
                      className="w-full rounded-xl bg-emerald-600 py-4 font-black text-lg tracking-wide text-white transition-all active:scale-95 active:bg-emerald-500 hover:bg-emerald-500 shadow-xl shadow-emerald-950/30 flex items-center justify-center gap-2"
                    >
                      🚀 Enviar Pedido Completo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: VISTA DE COCINA Y DESPACHO (KDS) */}
        {activeTab === "cocina" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-900 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>🍳</span> Panel de Cocina (KDS)
                </h2>
                <p className="text-sm text-gray-400">Monitoreo de comandas en tiempo real. Sírvelas rápidamente.</p>
              </div>
              <button
                onClick={fetchPedidos}
                className="self-start rounded-xl bg-gray-900 border border-gray-800 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 hover:bg-gray-800"
              >
                🔄 Recargar Pedidos
              </button>
            </div>

            {pedidos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/20 py-24 text-center">
                <span className="text-5xl animate-pulse inline-block mb-4">🧘</span>
                <h3 className="text-xl font-bold text-white">¡Cocina al día!</h3>
                <p className="mt-2 text-sm text-gray-400 max-w-sm mx-auto">No hay pedidos pendientes en la cola.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {pedidos.map((pedido) => (
                  <div
                    key={pedido.id}
                    className="flex flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900/70 shadow-2xl overflow-hidden hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center justify-between bg-gray-900 p-4 border-b border-gray-850">
                      <div>
                        <span className="text-2xl font-black tracking-wider text-emerald-400">
                          PEDIDO #{pedido.numero_pedido}
                        </span>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                          ID: {pedido.id}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="rounded-full bg-gray-950 border border-gray-850 px-3 py-1 text-xs font-black text-gray-300">
                          🕒 {pedido.hora}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 p-5 space-y-3 bg-gray-950/40">
                      {pedido.items &&
                        pedido.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between border-b border-gray-900 pb-2 last:border-b-0"
                          >
                            <div className="text-lg font-bold text-white flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-gray-800 text-sm font-black text-emerald-400">
                                {item.cantidad}x
                              </span>
                              <span>{item.nombre}</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="p-4 bg-gray-900 border-t border-gray-850 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-1">
                        <span>Total Comanda:</span>
                        <span className="text-white font-bold">{pedido.total} Bs.</span>
                      </div>
                      <button
                        onClick={() => handleDespacharPedido(pedido.id)}
                        className="w-full rounded-xl bg-emerald-600 py-4 font-black text-lg tracking-wide text-white transition-all active:scale-95 active:bg-emerald-500 hover:bg-emerald-500 shadow-lg flex items-center justify-center gap-2"
                      >
                        📢 Despachar / Pedido Servido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: CONFIGURACIÓN E HISTORIAL */}
        {activeTab === "config" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b border-gray-900 pb-3">
              <h2 className="text-2xl font-bold tracking-tight text-white">Ajustes del Sistema</h2>
              <p className="text-sm text-gray-400">Gestiona claves, reinicios y pruebas del prototipo.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">

              {/* Sección Contraseña */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🔑 Clave de Acceso
                </h3>
                <p className="text-xs text-gray-400">
                  Cambia la contraseña fija de la pantalla de bloqueo. Actualmente es: <span className="font-mono text-emerald-400 font-bold">{currentPassword}</span>
                </p>
                <form onSubmit={handlePasswordChangeSubmit} className="space-y-3 max-w-md">
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar nueva contraseña"
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white active:scale-95"
                    >
                      Actualizar PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem("jimena_password", DEFAULT_PASSWORD);
                        setCurrentPassword(DEFAULT_PASSWORD);
                        alert("Contraseña restablecida al valor por defecto.");
                      }}
                      className="rounded-lg bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-300 active:scale-95"
                    >
                      Restablecer Default
                    </button>
                  </div>
                </form>
              </div>

              {/* Acciones de Base de Datos */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🗄️ Sembrado y Datos
                </h3>
                <p className="text-xs text-gray-400">
                  Si tu base de datos de platos está vacía en Supabase, pulsa este botón para rellenarla con los platos tradicionales (Sopa de Maní, Chairo, Silpancho, etc.) que requiere el sistema.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSeedPlatos}
                    disabled={seeding}
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
                  >
                    {seeding ? "Sembrando..." : "✨ Sembrar Platos Tradicionales"}
                  </button>
                  <button
                    onClick={fetchPlatos}
                    className="rounded-lg bg-gray-800 px-4 py-2.5 text-xs font-bold text-white active:scale-95"
                  >
                    🔄 Recargar Platos
                  </button>
                </div>
              </div>

              {/* ✅ NUEVA SECCIÓN: Resetear Jornada */}
              <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-5 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🔁 Resetear Jornada
                </h3>
                <p className="text-xs text-gray-400">
                  Elimina <span className="text-red-400 font-semibold">todos los pedidos</span> registrados en la base de datos y reinicia el contador al #1. Úsalo al iniciar un nuevo turno o jornada.
                </p>
                <button
                  onClick={handleResetearJornada}
                  disabled={resetting}
                  className="rounded-lg bg-red-700 px-4 py-2.5 text-xs font-bold text-white active:scale-95 hover:bg-red-600 disabled:opacity-50 transition-all"
                >
                  {resetting ? "Reseteando..." : "🗑️ Resetear Jornada (borrar todos los pedidos)"}
                </button>
              </div>

              {/* Info y Estado de Conexión */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 space-y-2">
                <h3 className="text-sm font-bold text-gray-300">Detalles de Conexión</h3>
                <div className="space-y-1 font-mono text-[11px] text-gray-400 bg-gray-950 p-3 rounded-lg border border-gray-900">
                  <div>URL: {NEXT_PUBLIC_SUPABASE_URL}</div>
                  <div>Anon Key: {NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15)}...</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                    <span className="text-emerald-400 font-bold">Cliente Supabase Inicializado</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer Fijo */}
      <footer className="border-t border-gray-900 py-3 text-center text-[10px] text-gray-600 bg-gray-950">
        © 2026 Restaurante Regist-Demo. Desarrollado en NextJS & Tailwind CSS.
      </footer>
    </div>
  );
}