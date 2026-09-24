import { Service, inject } from '@angular/core';
import {
  CreateRackRequest,
  Service as ApiClient,
  UpdateRackRequest,
} from '../../core/api/wms-api';

@Service()
export class RackService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.rackAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged3(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.rackGET(id);
  }

  create(body: CreateRackRequest) {
    return this.api.rackPOST(body);
  }

  update(id: number, body: UpdateRackRequest) {
    return this.api.rackPUT(id, body);
  }

  delete(id: number) {
    return this.api.rackDELETE(id);
  }
}
