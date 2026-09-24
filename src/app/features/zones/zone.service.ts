import { Service, inject } from '@angular/core';
import {
  CreateZoneRequest,
  Service as ApiClient,
  UpdateZoneRequest,
} from '../../core/api/wms-api';

@Service()
export class ZoneService {
  private readonly api = inject(ApiClient);

  getAll() {
    return this.api.zoneAll();
  }

  getPaged(pageNumber: number, pageSize: number) {
    return this.api.paged6(pageNumber, pageSize);
  }

  getById(id: number) {
    return this.api.zoneGET(id);
  }

  create(body: CreateZoneRequest) {
    return this.api.zonePOST(body);
  }

  update(id: number, body: UpdateZoneRequest) {
    return this.api.zonePUT(id, body);
  }

  delete(id: number) {
    return this.api.zoneDELETE(id);
  }
}
