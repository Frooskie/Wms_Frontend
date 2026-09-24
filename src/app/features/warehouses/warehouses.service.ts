import { Service, inject } from '@angular/core';
import {
  CreateWarehouseRequest,
  Service as ApiClient,
  UpdateWarehouseRequest,
} from '../../core/api/wms-api';

@Service()
export class WarehouseService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.warehouseAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged5(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.warehouseGET(id);
  }

  create(body: CreateWarehouseRequest) {
    return this.api.warehousePOST(body);
  }

  update(id: number, body: UpdateWarehouseRequest) {
    return this.api.warehousePUT(id, body);
  }

  delete(id: number) {
    return this.api.warehouseDELETE(id);
  }
}
