import { Service, inject } from '@angular/core';
import {
  CreateShelfRequest,
  Service as ApiClient,
  UpdateShelfRequest,
} from '../../core/api/wms-api';

@Service()
export class ShelfService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.shelfAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged4(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.shelfGET(id);
  }

  create(body: CreateShelfRequest) {
    return this.api.shelfPOST(body);
  }

  update(id: number, body: UpdateShelfRequest) {
    return this.api.shelfPUT(id, body);
  }

  delete(id: number) {
    return this.api.shelfDELETE(id);
  }
}
