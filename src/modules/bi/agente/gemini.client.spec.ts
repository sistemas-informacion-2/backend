import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiBiClient } from './gemini.client.js';

const generateContent = vi.fn();
const constructor = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(opciones: unknown) {
      constructor(opciones);
    }
  },
}));

function cliente(bi: Partial<{ iaProveedor: string; modelo: string; vertexProyecto: string; vertexRegion: string }>, apiKey = '') {
  const valores: Record<string, unknown> = {
    bi: { iaProveedor: 'auto', modelo: '', vertexProyecto: '', vertexRegion: 'us-central1', ...bi },
    'gemini.apiKey': apiKey,
    'gemini.model': 'modelo-reportes',
  };
  return new GeminiBiClient({ get: (clave: string) => valores[clave] } as never);
}

describe('GeminiBiClient', () => {
  beforeEach(() => {
    generateContent.mockReset().mockResolvedValue({ text: 'hola' });
    constructor.mockReset();
  });

  it('auto: Vertex si hay proyecto de Google Cloud, si no la API key, si no nada', () => {
    expect(cliente({ vertexProyecto: 'mi-proyecto' }, 'clave').modo()).toBe('VERTEX');
    expect(cliente({}, 'clave').modo()).toBe('API_KEY');
    expect(cliente({}).modo()).toBe('SIN_CONFIGURAR');
  });

  it('respeta el proveedor forzado aunque haya credenciales del otro', () => {
    expect(cliente({ iaProveedor: 'api-key', vertexProyecto: 'mi-proyecto' }, 'clave').modo()).toBe('API_KEY');
    expect(cliente({ iaProveedor: 'vertex' }, 'clave').modo()).toBe('SIN_CONFIGURAR');
  });

  it('con Vertex crea el SDK con proyecto y region, sin API key', async () => {
    await cliente({ vertexProyecto: 'mi-proyecto', vertexRegion: 'southamerica-east1' }, 'clave').generar({ contents: 'hola' });
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ vertexai: true, project: 'mi-proyecto', location: 'southamerica-east1' }));
    expect(constructor.mock.calls[0][0]).not.toHaveProperty('apiKey');
  });

  it('con API key usa el modelo del BI o, si no hay, el de los reportes', async () => {
    await cliente({}, 'clave').generar({ contents: 'hola' });
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'clave' }));
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-reportes', contents: 'hola' }));

    await cliente({ modelo: 'modelo-bi' }, 'clave').generar({ contents: 'hola' });
    expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'modelo-bi' }));
  });

  it('sin configuracion responde 503 sin llamar a Google', async () => {
    await expect(cliente({}).generar({ contents: 'hola' })).rejects.toThrow(ServiceUnavailableException);
    expect(constructor).not.toHaveBeenCalled();
  });
});
