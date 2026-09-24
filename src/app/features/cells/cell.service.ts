import { Service, inject } from '@angular/core';
import {
  CreateCellRequest,
  Service as ApiClient,
  UpdateCellRequest,
} from '../../core/api/wms-api';

@Service()
export class CellService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.cellAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.cellGET(id);
  }

  create(body: CreateCellRequest) {
    return this.api.cellPOST(body);
  }

  update(id: number, body: UpdateCellRequest) {
    return this.api.cellPUT(id, body);
  }

  delete(id: number) {
    return this.api.cellDELETE(id);
  }
}
