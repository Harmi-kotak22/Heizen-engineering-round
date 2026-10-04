import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateAllergenDto,
  CreateDietaryTagDto,
  CreatePortionSizeDto,
  CreateStationDto,
  UpdateAllergenDto,
  UpdateDietaryTagDto,
  UpdatePortionSizeDto,
  UpdateStationDto,
} from './dto/reference.dto.js';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async listStations() {
    return this.prisma.station.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createStation(dto: CreateStationDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.station.findUnique({ where: { name } });

    if (existing) {
      throw new BadRequestException('Station already exists');
    }

    return this.prisma.station.create({ data: { name, active: true } });
  }

  async updateStation(id: string, dto: UpdateStationDto) {
    await this.ensureStationExists(id);

    const data: Prisma.StationUpdateInput = {};
    if (dto.name) {
      data.name = dto.name.trim();
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    return this.prisma.station.update({
      where: { id },
      data,
    });
  }

  async setStationStatus(id: string, active: boolean) {
    await this.ensureStationExists(id);
    return this.prisma.station.update({
      where: { id },
      data: { active },
    });
  }

  async listAllergens() {
    return this.prisma.allergen.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createAllergen(dto: CreateAllergenDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.allergen.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Allergen already exists');
    }

    return this.prisma.allergen.create({
      data: { name },
    });
  }

  async updateAllergen(id: string, dto: UpdateAllergenDto) {
    await this.ensureAllergenExists(id);
    return this.prisma.allergen.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
  }

  async listDietaryTags() {
    return this.prisma.dietaryTag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createDietaryTag(dto: CreateDietaryTagDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.dietaryTag.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Dietary tag already exists');
    }

    return this.prisma.dietaryTag.create({
      data: { name },
    });
  }

  async updateDietaryTag(id: string, dto: UpdateDietaryTagDto) {
    await this.ensureDietaryTagExists(id);
    return this.prisma.dietaryTag.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
  }

  async listPortionSizes() {
    return this.prisma.portionSize.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createPortionSize(dto: CreatePortionSizeDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.portionSize.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Portion size already exists');
    }

    return this.prisma.portionSize.create({
      data: {
        name,
        displayOrder: dto.displayOrder,
        active: true,
      },
    });
  }

  async updatePortionSize(id: string, dto: UpdatePortionSizeDto) {
    await this.ensurePortionSizeExists(id);

    const data: Prisma.PortionSizeUpdateInput = {};
    if (dto.name) {
      data.name = dto.name.trim();
    }
    if (dto.displayOrder !== undefined) {
      data.displayOrder = dto.displayOrder;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    return this.prisma.portionSize.update({
      where: { id },
      data,
    });
  }

  async setPortionSizeStatus(id: string, active: boolean) {
    await this.ensurePortionSizeExists(id);

    return this.prisma.portionSize.update({
      where: { id },
      data: { active },
    });
  }

  private async ensureStationExists(id: string) {
    const station = await this.prisma.station.findUnique({ where: { id } });
    if (!station) {
      throw new NotFoundException('Station not found');
    }
  }

  private async ensureAllergenExists(id: string) {
    const allergen = await this.prisma.allergen.findUnique({ where: { id } });
    if (!allergen) {
      throw new NotFoundException('Allergen not found');
    }
  }

  private async ensureDietaryTagExists(id: string) {
    const dietaryTag = await this.prisma.dietaryTag.findUnique({ where: { id } });
    if (!dietaryTag) {
      throw new NotFoundException('Dietary tag not found');
    }
  }

  private async ensurePortionSizeExists(id: string) {
    const portionSize = await this.prisma.portionSize.findUnique({ where: { id } });
    if (!portionSize) {
      throw new NotFoundException('Portion size not found');
    }
  }
}
