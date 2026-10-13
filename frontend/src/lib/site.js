// Configuración pública del sitio. El número de WhatsApp es un placeholder
// claramente marcado: reemplazar por el número real antes de producción.
// Formato internacional sin "+" ni espacios (ej: 573001234567).
export const WHATSAPP_NUMBER = "573001234567"; // TODO: número real de soporte/ventas

export function waLink(text) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
