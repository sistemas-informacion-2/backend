import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import type { DatosGraficoDto, GraficoGuardadoDto, GuardarGraficoDto } from '../dto/modelos.dto.js';
import { BiGrafico } from '../entities/bi-grafico.entity.js';
import type { ResultadoHerramienta } from '../herramientas/herramienta.js';
import { RegistroHerramientas } from '../herramientas/registro-herramientas.service.js';

const MAX_GRAFICOS_POR_USUARIO = 50;

/**
 * Graficos guardados desde el asistente. Cada uno es una definicion (herramienta + parametros): al abrirlo se vuelve a
 * consultar, asi que siempre refleja los datos actuales. Son de cada usuario dentro de su empresa.
 */
@Injectable()
export class GraficosService {
  constructor(
    @InjectRepository(BiGrafico) private readonly graficos: Repository<BiGrafico>,
    private readonly registro: RegistroHerramientas,
    private readonly tenant: TenantContext,
  ) {}

  async guardar(dto: GuardarGraficoDto, idUsuario: number): Promise<GraficoGuardadoDto> {
    const idEmpresa = this.tenant.empresaId();
    // Ejecutarla valida la herramienta y sus parametros: lo que entra aqui se puede volver a abrir.
    const ejecucion = await this.registro.ejecutar(dto.herramienta, dto.parametros, idEmpresa, fechaLocal());
    if (!ejecucion.ok) throw new BadRequestException((ejecucion.resultado as { error: string }).error);
    if (!ejecucion.grafico) throw new BadRequestException('Este resultado no se puede guardar como grafico');

    const guardados = await this.graficos.count({ where: { idEmpresa, idUsuario } });
    if (guardados >= MAX_GRAFICOS_POR_USUARIO) throw new ConflictException(`Ya tienes ${MAX_GRAFICOS_POR_USUARIO} graficos guardados; borra alguno para guardar otro`);

    const grafico = await this.graficos.save(
      this.graficos.create({ idUsuario, herramienta: dto.herramienta, parametros: dto.parametros, titulo: (dto.titulo?.trim() || ejecucion.grafico.titulo).slice(0, 100) }),
    );
    return this.aDto(grafico);
  }

  async listar(idUsuario: number): Promise<GraficoGuardadoDto[]> {
    const filas = await this.graficos.find({ where: { idEmpresa: this.tenant.empresaId(), idUsuario }, order: { fechaCreacion: 'DESC', id: 'DESC' } });
    return filas.map((fila) => this.aDto(fila));
  }

  async datos(id: number, idUsuario: number): Promise<DatosGraficoDto> {
    const grafico = await this.propio(id, idUsuario);
    const ejecucion = await this.registro.ejecutar(grafico.herramienta, grafico.parametros, this.tenant.empresaId(), fechaLocal());
    if (!ejecucion.ok) throw new ConflictException('Este grafico ya no se puede calcular; puedes borrarlo y crear otro desde el asistente');
    return { ...this.aDto(grafico), grafico: ejecucion.grafico, resultado: ejecucion.resultado as ResultadoHerramienta };
  }

  async borrar(id: number, idUsuario: number): Promise<void> {
    await this.propio(id, idUsuario);
    await this.graficos.delete({ id });
  }

  private async propio(id: number, idUsuario: number): Promise<BiGrafico> {
    const grafico = await this.graficos.findOne({ where: { id, idEmpresa: this.tenant.empresaId(), idUsuario } });
    if (!grafico) throw new NotFoundException('Grafico no encontrado');
    return grafico;
  }

  private aDto({ id, titulo, herramienta, parametros, fechaCreacion }: BiGrafico): GraficoGuardadoDto {
    return { id, titulo, herramienta, parametros, fechaCreacion };
  }
}
