import { NotificacionesController } from './notificaciones.controller.js';

describe('NotificacionesController', () => {
  // Nest registra las rutas en el orden en que se declaran los metodos. Si DELETE :id va primero,
  // DELETE /dispositivos cae ahi y ParseIntPipe responde 400.
  it('declara DELETE /dispositivos antes que DELETE /:id', () => {
    const metodos = Object.getOwnPropertyNames(NotificacionesController.prototype);

    expect(metodos).toContain('darDeBajaDispositivo');
    expect(metodos.indexOf('darDeBajaDispositivo')).toBeLessThan(metodos.indexOf('eliminar'));
  });
});
