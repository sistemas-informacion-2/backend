/** Datos de la tienda de demostracion que usa el generador de historia (R10). */

export type Temporada = 'INVIERNO' | 'VERANO' | 'TODO';

export interface PrendaDemo {
  codigo: string;
  nombre: string;
  /** Slug de la subcategoria que siembra CategoriaSeederService. */
  categoria: string;
  precio: number;
  tallas: string[];
  colores: string[];
  corte: string;
  temporada: Temporada;
  /** Peso relativo de demanda (mas alto = se vende mas). */
  popularidad: number;
  /** Indice en PROVEEDORES_DEMO. */
  proveedor: number;
  /** Costo de compra como fraccion del precio. */
  margenCosto: number;
}

export const PROVEEDORES_DEMO = [
  { empresa: 'Textiles Andinos SRL', nit: '1023456019', nombreContacto: 'Rosa Mamani' },
  { empresa: 'Denim Bolivia SA', nit: '2034567021', nombreContacto: 'Jorge Vargas' },
  { empresa: 'Moda Express Importaciones', nit: '3045678022', nombreContacto: 'Lucia Rojas' },
] as const;

export const SUCURSALES_DEMO = [
  { nombre: 'Demo Centro', ciudadPreferida: 'La Paz', ubicacion: 'Av. 16 de Julio 1450', factor: 1 },
  { nombre: 'Demo Equipetrol', ciudadPreferida: 'Santa Cruz', ubicacion: 'Av. San Martin 820', factor: 0.75 },
] as const;

export const PRENDAS_DEMO: PrendaDemo[] = [
  { codigo: 'POL-BAS', nombre: 'Polera básica de algodón', categoria: 'poleras', precio: 79, tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris'], corte: 'Regular', temporada: 'VERANO', popularidad: 3, proveedor: 0, margenCosto: 0.42 },
  { codigo: 'POL-EST', nombre: 'Polera estampada urbana', categoria: 'poleras', precio: 99, tallas: ['S', 'M', 'L'], colores: ['Negro', 'Azul'], corte: 'Oversize', temporada: 'VERANO', popularidad: 2, proveedor: 0, margenCosto: 0.45 },
  { codigo: 'BLU-SED', nombre: 'Blusa de seda', categoria: 'blusas', precio: 159, tallas: ['S', 'M', 'L'], colores: ['Beige', 'Blanco'], corte: 'Regular', temporada: 'TODO', popularidad: 1.5, proveedor: 2, margenCosto: 0.5 },
  { codigo: 'BLU-CAM', nombre: 'Blusa campesina', categoria: 'blusas', precio: 129, tallas: ['S', 'M'], colores: ['Blanco', 'Rosa'], corte: 'Holgado', temporada: 'VERANO', popularidad: 1.2, proveedor: 2, margenCosto: 0.48 },
  { codigo: 'CAM-OXF', nombre: 'Camisa Oxford', categoria: 'camisas', precio: 189, tallas: ['M', 'L', 'XL'], colores: ['Celeste', 'Blanco'], corte: 'Slim', temporada: 'TODO', popularidad: 1.5, proveedor: 0, margenCosto: 0.47 },
  { codigo: 'CAM-FRA', nombre: 'Camisa de franela', categoria: 'camisas', precio: 169, tallas: ['M', 'L', 'XL'], colores: ['Rojo', 'Verde'], corte: 'Regular', temporada: 'INVIERNO', popularidad: 1.3, proveedor: 0, margenCosto: 0.46 },
  { codigo: 'ABR-PAN', nombre: 'Abrigo de paño', categoria: 'abrigos', precio: 549, tallas: ['S', 'M', 'L'], colores: ['Camel', 'Negro'], corte: 'Largo', temporada: 'INVIERNO', popularidad: 0.8, proveedor: 2, margenCosto: 0.52 },
  { codigo: 'ABR-PAR', nombre: 'Parka acolchada', categoria: 'abrigos', precio: 459, tallas: ['M', 'L', 'XL'], colores: ['Negro', 'Verde oliva'], corte: 'Regular', temporada: 'INVIERNO', popularidad: 1, proveedor: 2, margenCosto: 0.5 },
  { codigo: 'CHA-JEA', nombre: 'Chaqueta de jean', categoria: 'chaquetas', precio: 289, tallas: ['S', 'M', 'L'], colores: ['Azul'], corte: 'Regular', temporada: 'TODO', popularidad: 1, proveedor: 1, margenCosto: 0.48 },
  { codigo: 'CHA-COR', nombre: 'Chaqueta cortaviento', categoria: 'chaquetas', precio: 249, tallas: ['M', 'L'], colores: ['Negro', 'Azul'], corte: 'Regular', temporada: 'INVIERNO', popularidad: 0.9, proveedor: 2, margenCosto: 0.5 },
  { codigo: 'SUE-ALP', nombre: 'Suéter de alpaca', categoria: 'sueteres', precio: 329, tallas: ['S', 'M', 'L'], colores: ['Gris', 'Beige'], corte: 'Regular', temporada: 'INVIERNO', popularidad: 1.2, proveedor: 0, margenCosto: 0.55 },
  { codigo: 'SUE-CAR', nombre: 'Cárdigan tejido', categoria: 'sueteres', precio: 219, tallas: ['S', 'M', 'L'], colores: ['Crema', 'Negro'], corte: 'Holgado', temporada: 'INVIERNO', popularidad: 1, proveedor: 0, margenCosto: 0.5 },
  { codigo: 'PAN-VES', nombre: 'Pantalón de vestir', categoria: 'pantalones', precio: 229, tallas: ['S', 'M', 'L'], colores: ['Negro', 'Gris'], corte: 'Recto', temporada: 'TODO', popularidad: 1.1, proveedor: 1, margenCosto: 0.47 },
  { codigo: 'PAN-JOG', nombre: 'Jogger deportivo', categoria: 'pantalones', precio: 149, tallas: ['S', 'M', 'L'], colores: ['Gris', 'Negro'], corte: 'Jogger', temporada: 'TODO', popularidad: 1.5, proveedor: 1, margenCosto: 0.44 },
  { codigo: 'JEA-SKI', nombre: 'Jean skinny', categoria: 'jeans', precio: 259, tallas: ['28', '30', '32'], colores: ['Azul', 'Negro'], corte: 'Skinny', temporada: 'TODO', popularidad: 2, proveedor: 1, margenCosto: 0.45 },
  { codigo: 'JEA-MOM', nombre: 'Jean mom fit', categoria: 'jeans', precio: 279, tallas: ['26', '28', '30'], colores: ['Celeste'], corte: 'Mom', temporada: 'TODO', popularidad: 1.3, proveedor: 1, margenCosto: 0.46 },
  { codigo: 'FAL-PLI', nombre: 'Falda plisada', categoria: 'faldas', precio: 159, tallas: ['S', 'M'], colores: ['Negro', 'Beige'], corte: 'Midi', temporada: 'VERANO', popularidad: 0.8, proveedor: 2, margenCosto: 0.48 },
  { codigo: 'FAL-JEA', nombre: 'Falda de jean', categoria: 'faldas', precio: 139, tallas: ['S', 'M', 'L'], colores: ['Azul'], corte: 'Corta', temporada: 'VERANO', popularidad: 0.7, proveedor: 1, margenCosto: 0.46 },
  { codigo: 'SHO-LIN', nombre: 'Short de lino', categoria: 'shorts', precio: 119, tallas: ['S', 'M', 'L'], colores: ['Beige', 'Blanco'], corte: 'Regular', temporada: 'VERANO', popularidad: 1, proveedor: 2, margenCosto: 0.45 },
  { codigo: 'SHO-DEP', nombre: 'Short deportivo', categoria: 'shorts', precio: 89, tallas: ['M', 'L'], colores: ['Negro'], corte: 'Regular', temporada: 'VERANO', popularidad: 0.9, proveedor: 1, margenCosto: 0.42 },
  { codigo: 'VES-FLO', nombre: 'Vestido floral', categoria: 'vestidos', precio: 239, tallas: ['S', 'M', 'L'], colores: ['Floral azul', 'Floral rojo'], corte: 'Midi', temporada: 'VERANO', popularidad: 1.2, proveedor: 2, margenCosto: 0.49 },
  { codigo: 'VES-PUN', nombre: 'Vestido de punto', categoria: 'vestidos', precio: 269, tallas: ['S', 'M'], colores: ['Negro', 'Vino'], corte: 'Ajustado', temporada: 'INVIERNO', popularidad: 0.8, proveedor: 2, margenCosto: 0.5 },
];

/** Prendas que se suelen llevar juntas (por codigo), para que la canasta de mercado tenga que descubrir. */
export const COMPANERAS_DEMO: Record<string, string> = {
  'JEA-SKI': 'POL-BAS',
  'BLU-SED': 'FAL-PLI',
  'CAM-OXF': 'PAN-VES',
  'PAN-JOG': 'POL-EST',
  'ABR-PAR': 'SUE-ALP',
};

export const NOMBRES_DEMO = ['Ana', 'Luis', 'Carla', 'Jorge', 'Maria', 'Diego', 'Lucia', 'Pablo', 'Sofia', 'Mateo', 'Valeria', 'Andres', 'Camila', 'Rodrigo', 'Paola', 'Miguel', 'Daniela', 'Fernando', 'Gabriela', 'Ricardo', 'Natalia', 'Sergio', 'Andrea', 'Marco'];
export const APELLIDOS_DEMO = ['Mamani', 'Quispe', 'Flores', 'Vargas', 'Rojas', 'Gutierrez', 'Choque', 'Lopez', 'Torrez', 'Rodriguez', 'Fernandez', 'Mendoza', 'Condori', 'Arce', 'Suarez', 'Salazar', 'Guzman', 'Rivera'];

/** Demanda por mes (enero = 0): campana de fin de ano, invierno con vacaciones en julio, bajon de febrero. */
export const FACTOR_MES = [0.9, 0.78, 0.9, 0.92, 1, 1.08, 1.2, 1.05, 0.95, 1, 1.15, 1.7];
/** Demanda por dia de la semana (domingo = 0). */
export const FACTOR_DIA = [0.75, 0.7, 0.8, 0.9, 1, 1.3, 1.6];

/** Peso de una prenda segun la temporada del mes (hemisferio sur: invierno de mayo a agosto). */
export function factorTemporada(temporada: Temporada, mes: number): number {
  if (temporada === 'TODO') return 1;
  const invierno = mes >= 4 && mes <= 7;
  const verano = mes >= 9 || mes <= 2;
  if (temporada === 'INVIERNO') return invierno ? 2.4 : verano ? 0.25 : 0.8;
  return verano ? 2 : invierno ? 0.35 : 0.9;
}
