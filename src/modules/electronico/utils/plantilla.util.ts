export interface ContextoPlantilla {
  nombre?: string;
  apellido?: string;
  email?: string;
}

/**
 * Reemplaza tokens `{{variable}}` del mensaje por los datos del destinatario
 * (CU19). Si una variable no existe en el contexto, se reemplaza por cadena
 * vacia para no exponer el token crudo al usuario.
 */
export function renderizarPlantilla(texto: string, contexto: ContextoPlantilla): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_coincidencia, clave: string) => {
    const valor = (contexto as Record<string, string | undefined>)[clave.toLowerCase()];
    return valor ?? '';
  });
}
